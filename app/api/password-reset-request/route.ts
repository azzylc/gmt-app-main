// app/api/password-reset-request/route.ts
// Şifre sıfırlama talebi oluştur

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firestore-admin';
import { sendEmail } from '@/app/lib/email';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email gerekli' }, { status: 400 });
    }

    // Personeli bul
    const personnelSnapshot = await adminDb
      .collection('personnel')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (personnelSnapshot.empty) {
      // Güvenlik için aynı mesajı göster (email var mı yok mu belli etme)
      return NextResponse.json({ 
        success: true, 
        message: 'Talebiniz alındı. Yöneticiniz en kısa sürede size dönüş yapacak.' 
      });
    }

    const personelDoc = personnelSnapshot.docs[0];
    const personelData = personelDoc.data();
    const personelId = personelDoc.id;
    const personelName = `${personelData.ad} ${personelData.soyad}`;

    // Bekleyen talep var mı kontrol et
    const existingRequest = await adminDb
      .collection('passwordResetRequests')
      .where('personelId', '==', personelId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingRequest.empty) {
      return NextResponse.json({ 
        success: true, 
        message: 'Talebiniz zaten alındı. Yöneticiniz en kısa sürede size dönüş yapacak.' 
      });
    }

    // Yeni talep oluştur
    const requestRef = await adminDb.collection('passwordResetRequests').add({
      personelId: personelId,
      personelName: personelName,
      email: email.toLowerCase().trim(),
      status: 'pending', // pending, approved, rejected
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Admin'e email gönder
    const adminEmail = 'azizerkanyolcu@outlook.com'; // Admin email
    await sendEmail({
      to: adminEmail,
      subject: '🔐 Şifre Sıfırlama Talebi - Mgt App',
      text: `
Yeni şifre sıfırlama talebi:

Personel: ${personelName}
Email: ${email}
Tarih: ${new Date().toLocaleString('tr-TR')}

Onaylamak için: https://gys.mgtapp.com/personel

İyi çalışmalar,
Mgt App
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <tr>
            <td style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #1e293b;">Mgt App</h1>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 40px;">
              <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 15px; color: #92400e; font-weight: 600;">
                  🔐 Yeni Şifre Sıfırlama Talebi
                </p>
              </div>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">Personel</p>
                    <p style="margin: 0 0 16px 0; font-size: 16px; color: #1e293b; font-weight: 600;">${personelName}</p>
                    
                    <p style="margin: 0 0 12px 0; font-size: 14px; color: #64748b;">Email</p>
                    <p style="margin: 0; font-size: 16px; color: #1e293b; font-weight: 600;">${email}</p>
                  </td>
                </tr>
              </table>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://gys.mgtapp.com/personel" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                      Talepleri Görüntüle
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                Mgt App
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim(),
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Talebiniz alındı. Yöneticiniz en kısa sürede size dönüş yapacak.' 
    });

  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}

// Talepleri listele (admin için)
export async function GET(req: NextRequest) {
  try {
    const requestsSnapshot = await adminDb
      .collection('passwordResetRequests')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    const requests = requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get password reset requests error:', error);
    return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 });
  }
}