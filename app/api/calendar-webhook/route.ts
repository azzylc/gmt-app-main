import { NextRequest, NextResponse } from 'next/server';
import { incrementalSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    // Google Calendar webhook header'ları
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');

    console.log('Webhook received:', { channelId, resourceState });

    // sync resourceState geldiğinde - Calendar değişti
    if (resourceState === 'sync') {
      // İlk webhook - sadece log
      return NextResponse.json({ status: 'sync acknowledged' });
    }

    if (resourceState === 'exists') {
      // Calendar'da değişiklik var!
      
      // syncToken'ı al (Firestore'da saklıyoruz)
      const syncTokenDoc = await adminDb.collection('system').doc('calendarSync').get();
      const syncToken = syncTokenDoc.data()?.syncToken;

      // Incremental sync yap
      const result = await incrementalSync(syncToken);

      if (result.success) {
        // Yeni syncToken'ı kaydet
        if (result.syncToken) {
          await adminDb.collection('system').doc('calendarSync').set({
            syncToken: result.syncToken,
            lastSync: new Date().toISOString()
          });
        }

        console.log('Incremental sync completed:', result.updateCount, 'updates');
        return NextResponse.json({ 
          status: 'success', 
          updates: result.updateCount 
        });
      } else if (result.error === 'SYNC_TOKEN_INVALID') {
        // syncToken geçersiz - full sync gerekir
        console.log('SyncToken invalid, triggering full sync...');
        
        // Full sync'i tetikle (async olarak, bekleme)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/full-sync`, {
          method: 'POST',
        }).catch(err => console.error('Full sync trigger failed:', err));

        return NextResponse.json({ 
          status: 'sync_token_invalid', 
          action: 'full_sync_triggered' 
        });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// GET - Webhook test endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar-webhook`
  });
}
