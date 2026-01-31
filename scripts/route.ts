import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Firebase Admin SDK başlatma (sadece bir kez)
if (!admin.apps.length) {
  const serviceAccount = require('../../scripts/serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec';

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization header kontrolü
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Token gerekli' },
        { status: 401 }
      );
    }

    // 2. Token'ı al
    const token = authHeader.split('Bearer ')[1];

    // 3. Firebase Admin SDK ile token doğrulama
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Token doğrulama hatası:', error);
      return NextResponse.json(
        { error: 'Unauthorized - Geçersiz token' },
        { status: 401 }
      );
    }

    // 4. Role kontrolü (opsiyonel - tüm authenticated kullanıcılar erişebilir)
    // Eğer sadece Kurucu/Yönetici erişebilsin istersen:
    /*
    const kullaniciTuru = decodedToken.kullaniciTuru;
    if (kullaniciTuru !== 'Kurucu' && kullaniciTuru !== 'Yönetici') {
      return NextResponse.json(
        { error: 'Forbidden - Yeterli yetki yok' },
        { status: 403 }
      );
    }
    */

    console.log('✅ Token doğrulandı:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      kullaniciTuru: decodedToken.kullaniciTuru || 'Belirtilmemiş',
    });

    // 5. Apps Script'e istek at
    const response = await fetch(`${APPS_SCRIPT_URL}?action=gelinler`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Apps Script hatası: ${response.status}`);
    }

    const data = await response.json();

    // 6. Cache header ekle (30 dakika)
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    });

  } catch (error) {
    console.error('Gelin verisi çekme hatası:', error);
    return NextResponse.json(
      { error: 'Veri çekilemedi' },
      { status: 500 }
    );
  }
}