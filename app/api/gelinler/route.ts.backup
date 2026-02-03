import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firestore-admin';
import { verifyAdminAuth } from '@/app/lib/auth';

// OPERASYON PANELİ: Tüm gelinleri listele
export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;

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

    return NextResponse.json({
      success: true,
      count: gelinler.length,
      gelinler
    });
  } catch (error: any) {
    console.error('Gelinler listesi hatası:', error);
    return NextResponse.json(
      { error: 'Failed to fetch gelinler', details: error.message },
      { status: 500 }
    );
  }
}