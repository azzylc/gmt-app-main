import { NextRequest, NextResponse } from 'next/server';
import { fullSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';
import { verifyAdminAuth } from '@/app/lib/auth';

// Vercel function configuration
export const maxDuration = 60; // 60 seconds for large syncs

export async function POST(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;

  try {
    // 🔒 CONCURRENCY LOCK: Full-sync overlap önle
    const lockRef = adminDb.collection('system').doc('locks').collection('jobs').doc('fullSync');
    
    // Transaction ile lock al
    const lockAcquired = await adminDb.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      const now = Date.now();
      
      if (lockDoc.exists) {
        const lockData = lockDoc.data()!;
        const lockedUntil = new Date(lockData.lockedUntil).getTime();
        
        // Lock hala geçerli mi?
        if (lockedUntil > now) {
          const remainingMs = lockedUntil - now;
          console.log(`⏸️ Full-sync zaten çalışıyor (${Math.round(remainingMs / 1000)}s kaldı)`);
          return false;
        }
      }
      
      // Lock al (60 saniye TTL)
      transaction.set(lockRef, {
        lockedAt: new Date().toISOString(),
        lockedUntil: new Date(now + 60000).toISOString(), // 60s TTL
        lockedBy: 'full-sync-cron'
      });
      
      return true;
    });
    
    // Lock alınamadı
    if (!lockAcquired) {
      return NextResponse.json({
        status: 'locked',
        message: 'Full-sync already running, skipping this invocation'
      });
    }
    
    console.log('🔄 Full sync başlatılıyor...');
    
    try {
      const result = await fullSync();
      
      // SyncToken'ı kaydet
      await adminDb.collection('system').doc('sync').set({
        lastSyncToken: result.syncToken || null,
        lastFullSync: new Date().toISOString(),
        needsFullSync: false // Flag'i temizle
      }, { merge: true });
      
      // Lock'u temizle
      await lockRef.delete();
      
      return NextResponse.json({
        success: true,
        totalEvents: result.totalEvents,
        added: result.added,
        skipped: result.skipped,
        syncToken: result.syncToken,
        message: `✅ ${result.added} gelin eklendi, ${result.skipped} atlandı`
      });
      
    } catch (syncError: any) {
      // Sync hatası olsa bile lock'u temizle
      await lockRef.delete();
      throw syncError;
    }

  } catch (error: any) {
    console.error('❌ Full sync hatası:', error);
    return NextResponse.json(
      { error: 'Full sync failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET method (Vercel Cron için)
export async function GET(req: NextRequest) {
  return POST(req);
}
