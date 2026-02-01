import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/app/lib/auth';
import * as Sentry from '@sentry/nextjs';

export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;

  try {
    // Compare-gelinler endpoint'ini çağır
    const compareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/compare-gelinler`;
    const compareResponse = await fetch(compareUrl, {
      headers: {
        'x-admin-key': process.env.ADMIN_KEY!,
      },
    });

    if (!compareResponse.ok) {
      throw new Error('Compare-gelinler request failed');
    }

    const result = await compareResponse.json();

    // Drift varsa alarm
    if (result.differences && result.differences.length > 0) {
      const driftCount = result.differences.length;
      
      console.error(`DRIFT DETECTED: ${driftCount} differences between Calendar and Firestore`);
      
      // 🔒 PII-SAFE: Sadece event ID'leri ve count gönder
      const eventIds = result.differences
        .map((d: any) => d.calendarEvent?.id || d.firestoreEvent?.id)
        .filter(Boolean)
        .slice(0, 10);
      
      // Sentry'ye PII olmadan gönder
      Sentry.captureMessage(`Drift Detection: ${driftCount} differences found`, {
        level: 'warning',
        extra: {
          count: driftCount,
          eventIds: eventIds, // Sadece ID'ler (PII yok)
          timestamp: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        status: 'drift_detected',
        message: `Found ${driftCount} differences`,
        count: driftCount,
        action: 'notification_sent_to_sentry',
      });
    }

    // Drift yok
    return NextResponse.json({
      status: 'ok',
      message: 'No drift detected',
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Drift detection error:', error);
    
    Sentry.captureException(error);
    
    return NextResponse.json(
      { error: 'Drift detection failed', details: error.message },
      { status: 500 }
    );
  }
}
