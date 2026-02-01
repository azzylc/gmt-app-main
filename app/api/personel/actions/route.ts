// app/api/personel/actions/route.ts
// Personel işlemleri: şifre sıfırla, devre dışı bırak, telefon bağını kopar

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/app/lib/firestore-admin';

// Rastgele şifre üret
function generatePassword(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, personelId, email } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action gerekli' }, { status: 400 });
    }

    switch (action) {
      // =====================
      // 🔑 ŞİFRE SIFIRLA
      // =====================
      case 'reset-password': {
        if (!personelId) {
          return NextResponse.json({ error: 'personelId gerekli' }, { status: 400 });
        }

        // Personel bilgilerini al
        const personelDoc = await adminDb.collection('personnel').doc(personelId).get();
        if (!personelDoc.exists) {
          return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 });
        }

        const personelData = personelDoc.data()!;
        const authUid = personelData.authUid;
        const personelEmail = personelData.email;

        if (!authUid) {
          return NextResponse.json({ error: 'Bu personelin auth kaydı yok' }, { status: 400 });
        }

        // Yeni şifre üret
        const newPassword = generatePassword(8);

        // Firebase Auth'da şifreyi güncelle
        await adminAuth.updateUser(authUid, { password: newPassword });

        // Firestore'a kaydet (log için)
        await adminDb.collection('personnel').doc(personelId).update({
          lastPasswordReset: new Date().toISOString(),
          passwordResetBy: 'admin'
        });

        return NextResponse.json({
          success: true,
          message: 'Şifre sıfırlandı',
          newPassword: newPassword,
          email: personelEmail,
          // Not: Gerçek uygulamada şifreyi email ile gönder, response'da gösterme
        });
      }

      // =====================
      // 🔗 ŞİFRE SIFIRLAMA LİNKİ GÖNDER
      // =====================
      case 'send-reset-link': {
        if (!email) {
          return NextResponse.json({ error: 'Email gerekli' }, { status: 400 });
        }

        // Firebase Auth şifre sıfırlama linki
        const resetLink = await adminAuth.generatePasswordResetLink(email);

        // TODO: Email gönderme servisi eklenecek (SendGrid, Resend, vs.)
        // Şimdilik linki dönüyoruz
        
        return NextResponse.json({
          success: true,
          message: 'Şifre sıfırlama linki oluşturuldu',
          resetLink: resetLink,
          // Not: Gerçek uygulamada bu linki email ile gönder
        });
      }

      // =====================
      // 🚫 DEVRE DIŞI BIRAK / AKTİF ET
      // =====================
      case 'toggle-status': {
        if (!personelId) {
          return NextResponse.json({ error: 'personelId gerekli' }, { status: 400 });
        }

        const personelDoc = await adminDb.collection('personnel').doc(personelId).get();
        if (!personelDoc.exists) {
          return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 });
        }

        const personelData = personelDoc.data()!;
        const currentStatus = personelData.aktif;
        const newStatus = !currentStatus;
        const authUid = personelData.authUid;

        // Firebase Auth'da hesabı disable/enable et
        if (authUid) {
          await adminAuth.updateUser(authUid, { disabled: !newStatus });
        }

        // Firestore'u güncelle
        await adminDb.collection('personnel').doc(personelId).update({
          aktif: newStatus,
          statusChangedAt: new Date().toISOString(),
          ...(newStatus === false && { istenAyrilma: new Date().toISOString().split('T')[0] })
        });

        return NextResponse.json({
          success: true,
          message: newStatus ? 'Personel aktif edildi' : 'Personel devre dışı bırakıldı',
          newStatus: newStatus
        });
      }

      // =====================
      // 📱 TELEFON BAĞINI KOPAR
      // =====================
      case 'unbind-device': {
        if (!personelId) {
          return NextResponse.json({ error: 'personelId gerekli' }, { status: 400 });
        }

        const personelDoc = await adminDb.collection('personnel').doc(personelId).get();
        if (!personelDoc.exists) {
          return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 });
        }

        // Cihaz bilgilerini temizle
        await adminDb.collection('personnel').doc(personelId).update({
          deviceId: null,
          deviceName: null,
          deviceBoundAt: null,
          deviceUnboundAt: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          message: 'Telefon bağı koparıldı. Personel yeni cihazla giriş yapabilir.'
        });
      }

      // =====================
      // ❌ BİLİNMEYEN ACTION
      // =====================
      default:
        return NextResponse.json({ error: `Bilinmeyen action: ${action}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Personel action error:', error);
    return NextResponse.json(
      { error: 'İşlem başarısız', details: error.message },
      { status: 500 }
    );
  }
}