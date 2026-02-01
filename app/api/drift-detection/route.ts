// app/api/drift-detection/route.ts - PII-SAFE VERSION (FIXED v2)

import { NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firestore-admin';  // ✅ adminDb
import { google } from 'googleapis';
import * as Sentry from '@sentry/nextjs';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

export async function GET(request: Request) {
  // Cron auth check
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Firestore'dan tüm gelinleri çek
    const firestoreSnapshot = await adminDb.collection('gelinler').get();
    const firestoreMap = new Map<string, FirebaseFirestore.DocumentData>();
    
    firestoreSnapshot.docs.forEach((doc) => {
      firestoreMap.set(doc.id, doc.data());
    });

    // 2. Google Calendar'dan eventleri çek
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    const calendarEvents: { id?: string | null }[] = [];
    let pageToken: string | undefined;
    
    do {
      const response = await calendar.events.list({
        calendarId: CALENDAR_ID,
        maxResults: 2500,
        pageToken,
        singleEvents: true,
      });
      
      calendarEvents.push(...(response.data.items || []));
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    // 3. Drift analizi - SADECE ID'leri topla, PII yok!
    const driftResults = {
      missingInFirestore: [] as string[],
      missingInCalendar: [] as string[],
      totalCalendar: calendarEvents.length,
      totalFirestore: firestoreSnapshot.size,
    };

    // Calendar'da olup Firestore'da olmayan
    calendarEvents.forEach(event => {
      if (event.id && !firestoreMap.has(event.id)) {
        driftResults.missingInFirestore.push(event.id);
      }
    });

    // Firestore'da olup Calendar'da olmayan
    const calendarIds = new Set(calendarEvents.map(e => e.id));
    firestoreSnapshot.docs.forEach((doc) => {
      if (!calendarIds.has(doc.id)) {
        driftResults.missingInCalendar.push(doc.id);
      }
    });

    const totalDrift = driftResults.missingInFirestore.length + driftResults.missingInCalendar.length;

    // 4. Drift varsa Sentry'ye bildir - PII-SAFE!
    if (totalDrift > 0) {
      Sentry.captureMessage('Calendar drift detected', {
        level: 'warning',
        extra: {
          missingInFirestoreCount: driftResults.missingInFirestore.length,
          missingInCalendarCount: driftResults.missingInCalendar.length,
          missingInFirestoreIds: driftResults.missingInFirestore.slice(0, 10),
          missingInCalendarIds: driftResults.missingInCalendar.slice(0, 10),
          totalCalendar: driftResults.totalCalendar,
          totalFirestore: driftResults.totalFirestore,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 5. Response - PII-SAFE!
    return NextResponse.json({
      status: totalDrift > 0 ? 'drift_detected' : 'in_sync',
      summary: {
        totalCalendar: driftResults.totalCalendar,
        totalFirestore: driftResults.totalFirestore,
        missingInFirestoreCount: driftResults.missingInFirestore.length,
        missingInCalendarCount: driftResults.missingInCalendar.length,
      },
      sampleIds: totalDrift > 0 ? {
        missingInFirestore: driftResults.missingInFirestore.slice(0, 10),
        missingInCalendar: driftResults.missingInCalendar.slice(0, 10),
      } : null,
      checkedAt: new Date().toISOString(),
    });

  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json(
      { error: 'Drift detection failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}