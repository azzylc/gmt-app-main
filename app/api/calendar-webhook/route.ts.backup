import { NextRequest, NextResponse } from 'next/server';
import { incrementalSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    // Google Calendar webhook header'ları
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const channelToken = req.headers.get('x-goog-channel-token');

    console.log('Webhook received:', { channelId, resourceId, resourceState });

    // Webhook validation: Channel bilgilerini Firestore'dan al ve doğrula
    const webhookDoc = await adminDb.collection('system').doc('webhookChannel').get();
    
    if (webhookDoc.exists) {
      const webhookData = webhookDoc.data()!;
      
      // Token, channelId ve resourceId doğrulaması
      if (
        webhookData.webhookToken !== channelToken ||
        webhookData.channelId !== channelId ||
        webhookData.resourceId !== resourceId
      ) {
        console.warn('Webhook validation failed:', {
          expectedToken: webhookData.webhookToken ? 'exists' : 'missing',
          receivedToken: channelToken ? 'exists' : 'missing',
          expectedChannelId: webhookData.channelId,
          receivedChannelId: channelId,
          expectedResourceId: webhookData.resourceId,
          receivedResourceId: resourceId,
        });
        
        // 200 dön (Google retry yapmasın) ama işleme devam etme
        return NextResponse.json({ status: 'validation_failed' });
      }
    } else {
      console.warn('Webhook channel data not found in Firestore');
      return NextResponse.json({ status: 'channel_not_found' });
    }

    // sync resourceState geldiğinde - Calendar değişti
    if (resourceState === 'sync') {
      // İlk webhook - sadece log
      return NextResponse.json({ status: 'sync acknowledged' });
    }

    if (resourceState === 'exists') {
      // Calendar'da değişiklik var!
      
      // syncToken'ı al (Firestore'da saklıyoruz)
      const syncTokenDoc = await adminDb.collection('system').doc('sync').get();
      const syncToken = syncTokenDoc.data()?.lastSyncToken;

      // Incremental sync yap
      const result = await incrementalSync(syncToken);

      if (result.success) {
        // Yeni syncToken'ı kaydet
        if (result.syncToken) {
          await adminDb.collection('system').doc('sync').set({
            lastSyncToken: result.syncToken,
            lastSync: new Date().toISOString()
          }, { merge: true });
        }

        console.log('Incremental sync completed:', result.updateCount, 'updates');
        return NextResponse.json({ 
          status: 'success', 
          updates: result.updateCount 
        });
      } else if (result.error === 'SYNC_TOKEN_INVALID') {
        // syncToken geçersiz - full sync gerekir
        console.log('SyncToken invalid, triggering full sync...');
        
        // Full sync'i tetikle (async olarak, auth ile)
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/full-sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          }
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