import { NextRequest, NextResponse } from 'next/server';
import { incrementalSync } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';

export async function POST(req: NextRequest) {
  try {
    // Google Calendar webhook headers
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const resourceState = req.headers.get('x-goog-resource-state');
    const channelToken = req.headers.get('x-goog-channel-token');
    const messageNumber = req.headers.get('x-goog-message-number');

    console.log('Webhook received:', { 
      channelId, 
      resourceId, 
      resourceState, 
      messageNumber 
    });

    // 🔥 GRACE PERIOD: Çoklu kanal validation (son 2-3 kanal)
    const channelsSnapshot = await adminDb
      .collection('webhookChannels')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    if (channelsSnapshot.empty) {
      console.warn('No webhook channels found in Firestore');
      return NextResponse.json({ status: 'no_channels_configured' });
    }

    // Valid channels (15dk grace period)
    const now = Date.now();
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 dakika
    
    let isValidChannel = false;
    let validChannelData: any = null;

    for (const doc of channelsSnapshot.docs) {
      const data = doc.data();
      const channelAge = now - new Date(data.createdAt).getTime();
      
      // Grace period içinde mi?
      if (channelAge <= GRACE_PERIOD_MS) {
        // Token + channelId + resourceId doğrula
        if (
          data.webhookToken === channelToken &&
          data.channelId === channelId &&
          data.resourceId === resourceId
        ) {
          isValidChannel = true;
          validChannelData = data;
          break;
        }
      }
    }

    if (!isValidChannel) {
      console.warn('Webhook validation failed (no valid channel in grace period)');
      return NextResponse.json({ status: 'validation_failed' });
    }

    // 🔥 MESSAGE-NUMBER TRACKING: Duplicate guard
    if (messageNumber && validChannelData.lastMessageNumber) {
      const lastNum = parseInt(validChannelData.lastMessageNumber);
      const currentNum = parseInt(messageNumber);
      
      if (currentNum <= lastNum) {
        console.log(`Duplicate/old message detected: ${currentNum} <= ${lastNum}`);
        return NextResponse.json({ status: 'duplicate_message_ignored' });
      }
    }

    // Update last message number
    if (messageNumber) {
      await adminDb
        .collection('webhookChannels')
        .where('channelId', '==', channelId)
        .get()
        .then(snapshot => {
          if (!snapshot.empty) {
            snapshot.docs[0].ref.update({
              lastMessageNumber: messageNumber,
              lastMessageAt: new Date().toISOString()
            });
          }
        });
    }

    // sync resourceState - ilk webhook
    if (resourceState === 'sync') {
      return NextResponse.json({ status: 'sync_acknowledged' });
    }

    if (resourceState === 'exists') {
      // Calendar'da değişiklik var!
      
      // syncToken'ı al
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
        // 🔥 410 ERROR: Flag-based full sync (daha güvenli)
        console.log('SyncToken invalid, flagging for full sync...');
        
        await adminDb.collection('system').doc('sync').set({
          needsFullSync: true,
          fullSyncReason: '410_sync_token_invalid',
          flaggedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({ 
          status: 'sync_token_invalid', 
          action: 'full_sync_flagged' 
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
