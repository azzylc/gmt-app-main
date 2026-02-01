import { NextRequest, NextResponse } from 'next/server';
import { fullSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';
import { verifyAdminAuth } from '@/app/lib/auth';

export async function POST(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;

  try {
    console.log('🔄 Full sync başlatılıyor...');
    
    const result = await fullSync();
    
    // SyncToken'ı Firestore'a kaydet
    await adminDb.collection('system').doc('sync').set({
      lastSyncToken: result.syncToken || null,
      lastFullSync: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      totalEvents: result.totalEvents,
      added: result.added,
      skipped: result.skipped,
      syncToken: result.syncToken,
      message: `✅ ${result.added} gelin eklendi, ${result.skipped} atlandı (finansal veri yok)`
    });

  } catch (error: any) {
    console.error('❌ Full sync hatası:', error);
    return NextResponse.json(
      { error: 'Full sync failed', details: error.message },
      { status: 500 }
    );
  }
}