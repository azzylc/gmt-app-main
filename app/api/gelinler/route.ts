import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firestore-admin';
import { verifyAdminAuth } from '@/app/lib/auth';
import { corsPreflight, withCors } from '@/app/lib/cors';

// OPTIONS - Preflight handler (iOS Capacitor için)
export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

// OPERASYON PANELİ: Tüm gelinleri listele
export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return withCors(req, authError);

  try {
    const snapshot = await adminDb
      .collection('gelinler')
      .orderBy('tarih', 'desc')
      .limit(100) // İlk 100 gelin
      .get();

    const gelinler = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const response = NextResponse.json({
      success: true,
      count: gelinler.length,
      gelinler
    });

    return withCors(req, response);
  } catch (error: any) {
    console.error('Gelinler listesi hatası:', error);
    const response = NextResponse.json(
      { error: 'Failed to fetch gelinler', details: error.message },
      { status: 500 }
    );
    return withCors(req, response);
  }
}
