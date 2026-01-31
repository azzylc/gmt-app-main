import { NextRequest, NextResponse } from 'next/server';
import { fullSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    console.log('Full sync started...');

    // Full sync yap
    const result = await fullSync();

    // syncToken'ı kaydet
    if (result.syncToken) {
      await adminDb.collection('system').doc('calendarSync').set({
        syncToken: result.syncToken,
        lastFullSync: new Date().toISOString(),
      });
    }

    console.log('Full sync completed:', result.count, 'gelinler synced');

    return NextResponse.json({
      success: true,
      count: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Full sync error:', error);
    return NextResponse.json(
      { 
        error: 'Full sync failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET - Son sync durumunu göster
export async function GET() {
  try {
    const syncDoc = await adminDb.collection('system').doc('calendarSync').get();
    
    if (!syncDoc.exists) {
      return NextResponse.json({ 
        status: 'No sync performed yet',
        action: 'POST to this endpoint to perform full sync'
      });
    }

    const data = syncDoc.data()!;

    return NextResponse.json({
      status: 'Sync info',
      lastFullSync: data.lastFullSync,
      lastIncrementalSync: data.lastSync,
      syncToken: data.syncToken ? 'exists' : 'none',
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
