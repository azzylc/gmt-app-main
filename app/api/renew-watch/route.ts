import { NextRequest, NextResponse } from 'next/server';
import { getCalendarClient } from '@/app/lib/calendar-sync';
import { adminDb } from '@/app/lib/firestore-admin';
import { v4 as uuidv4 } from 'uuid';
import { verifyAdminAuth } from '@/app/lib/auth';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
const WEBHOOK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar-webhook`;

export async function POST(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;
  
  return renewWebhook();
}

// Vercel Cron job için GET method desteği
export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;
  
  return renewWebhook();
}

async function renewWebhook() {
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

    // Yeni channel oluştur (token ile)
    const channelId = uuidv4();
    const webhookToken = uuidv4(); // Güvenli token
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 gün

    const response = await calendar.events.watch({
      calendarId: CALENDAR_ID,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        token: webhookToken, // Token ekle
        expiration: expiration.toString(),
      },
    });

    // Yeni channel bilgilerini kaydet (token ile)
    await adminDb.collection('system').doc('webhookChannel').set({
      channelId,
      resourceId: response.data.resourceId,
      webhookToken, // Token'ı kaydet
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