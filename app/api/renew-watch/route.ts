import { NextRequest, NextResponse } from 'next/server';
import { getCalendarClient } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';
import { v4 as uuidv4 } from 'uuid';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const WEBHOOK_URL = 'https://gmt-app-main.vercel.app/api/calendar-webhook';

export async function POST(req: NextRequest) {
  try {
    const calendar = getCalendarClient();

    // Eski channel'ı durdur
    const oldChannelDoc = await adminDb.collection('system').doc('webhookChannel').get();
    
    if (oldChannelDoc.exists) {
      const oldData = oldChannelDoc.data()!;
      
      try {
        await calendar.channels.stop({
          requestBody: {
            id: oldData.channelId,
            resourceId: oldData.resourceId,
          },
        });
        console.log('Old webhook stopped:', oldData.channelId);
      } catch (error) {
        console.warn('Could not stop old webhook (may already be expired):', error);
      }
    }

    // Yeni channel oluştur
    const channelId = uuidv4();
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 gün

    const response = await calendar.events.watch({
      calendarId: CALENDAR_ID,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        expiration: expiration.toString(),
      },
    });

    // Yeni channel bilgilerini kaydet
    await adminDb.collection('system').doc('webhookChannel').set({
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
      renewedAt: new Date().toISOString(),
    });

    console.log('Webhook renewed successfully:', {
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook renewed',
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
    });
  } catch (error: any) {
    console.error('Webhook renewal error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook renewal failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
