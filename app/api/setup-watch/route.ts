import { NextRequest, NextResponse } from 'next/server';
import { getCalendarClient } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';
import { v4 as uuidv4 } from 'uuid';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const WEBHOOK_URL = 'https://gmt-app-main.vercel.app/api/calendar-webhook';

export async function POST(req: NextRequest) {
  try {
    const calendar = getCalendarClient();

    // Unique channel ID oluştur
    const channelId = uuidv4();
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 gün

    // Watch request
    const response = await calendar.events.watch({
      calendarId: CALENDAR_ID,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        expiration: expiration.toString(),
      },
    });

    // Channel bilgilerini Firestore'a kaydet
    await adminDb.collection('system').doc('webhookChannel').set({
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
      createdAt: new Date().toISOString(),
    });

    console.log('Webhook setup successful:', {
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
    });

    return NextResponse.json({
      success: true,
      channelId,
      resourceId: response.data.resourceId,
      expiration: new Date(expiration).toISOString(),
      webhookUrl: WEBHOOK_URL,
    });
  } catch (error: any) {
    console.error('Webhook setup error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook setup failed', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// GET - Mevcut webhook durumunu göster
export async function GET() {
  try {
    const channelDoc = await adminDb.collection('system').doc('webhookChannel').get();
    
    if (!channelDoc.exists) {
      return NextResponse.json({ 
        status: 'No webhook configured',
        action: 'POST to this endpoint to setup webhook'
      });
    }

    const data = channelDoc.data()!;
    const expiresIn = new Date(data.expiration).getTime() - Date.now();
    const hoursLeft = Math.floor(expiresIn / (1000 * 60 * 60));

    return NextResponse.json({
      status: 'Webhook active',
      channelId: data.channelId,
      resourceId: data.resourceId,
      expiration: data.expiration,
      hoursLeft,
      needsRenewal: hoursLeft < 24,
    });
  } catch (error) {
    console.error('Error fetching webhook status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch webhook status' },
      { status: 500 }
    );
  }
}
