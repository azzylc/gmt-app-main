import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/app/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/app/lib/email';
import { corsPreflight, withCors } from '@/app/lib/cors';
import { verifyUserAuth, verifyAdminAuth } from '@/app/lib/auth';

// Rastgele şifre üret
function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// OPTIONS - Preflight handler (iOS Capacitor için)
export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  // 🔥 YENİ: Kullanıcı authentication - Kurucu veya Yönetici gerekli
  const { error: authError, user } = await verifyUserAuth(req, ['Kurucu', 'Yönetici']);
  if (authError) return withCors(req, authError);

  try {
    const body = await req.json();
    const { 
      email, 
      password, 
      ad, 
      soyad, 
      sicilNo, 
      telefon,
      kisaltma,
      calismaSaati,
      iseBaslama,
      kullaniciTuru,
      yoneticiId,
      grupEtiketleri,
      yetkiliGruplar,
      aktif,
      ayarlar,
      foto
    } = body;

    console.log(`[POST /api/personel] Yeni personel ekleniyor: ${ad} ${soyad} (${email}) - İsteği yapan: ${user?.email}`);

    // Validasyon - şifre artık zorunlu değil
    if (!email || !ad || !soyad || !sicilNo || !telefon) {
      const response = NextResponse.json(
        { error: 'Zorunlu alanlar eksik: email, ad, soyad, sicilNo, telefon' },
        { status: 400 }
      );
      return withCors(req, response);
    }

    // Şifre yoksa otomatik oluştur
    const finalPassword = password || generatePassword(8);

    // 1. Firebase Auth'da kullanıcı oluştur
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: email,
        password: finalPassword,
        displayName: `${ad} ${soyad}`,
        disabled: !aktif
      });
      console.log(`✅ Firebase Auth kullanıcı oluşturuldu: ${userRecord.uid}`);
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        const response = NextResponse.json(
          { error: 'Bu email adresi zaten kayıtlı' },
          { status: 400 }
        );
        return withCors(req, response);
      }
      throw authError;
    }

    // 2. Firestore'a personel bilgilerini yaz (Auth UID = Doc ID)
    const personelData = {
      email,
      ad,
      soyad,
      sicilNo,
      telefon,
      kisaltma: kisaltma || '',
      calismaSaati: calismaSaati || 'serbest',
      iseBaslama: iseBaslama || '',
      istenAyrilma: '',
      kullaniciTuru: kullaniciTuru || 'Personel',
      yoneticiId: yoneticiId || '',
      grup: '',
      grupEtiketleri: grupEtiketleri || [],
      yetkiliGruplar: yetkiliGruplar || [],
      aktif: aktif !== false,
      foto: foto || '',
      ayarlar: ayarlar || {
        otoCikis: false,
        qrKamerali: false,
        konumSecim: false,
        qrCihazModu: false,
        girisHatirlatici: false,
        mazeretEkran: false,
        konumDisi: false,
      },
      createdAt: new Date().toISOString(),
      createdBy: user?.email || '',
      authUid: userRecord.uid
    };

    // Auth UID'yi doc ID olarak kullan
    await adminDb.collection('personnel').doc(userRecord.uid).set(personelData);
    console.log(`✅ Firestore'a personel kaydedildi: ${userRecord.uid}`);

    // ✅ ŞİFREYİ MAİL İLE GÖNDER
    try {
      const mailSent = await sendPasswordResetEmail(
        email,
        `${ad} ${soyad}`,
        finalPassword
      );
      
      if (mailSent) {
        console.log(`✅ Şifre maili gönderildi: ${email}`);
      } else {
        console.error(`❌ Mail gönderilemedi: ${email}`);
      }
    } catch (emailError) {
      console.error('Mail gönderme hatası:', emailError);
      // Mail hatası personel oluşturmayı engellemez
    }

    const response = NextResponse.json({
      success: true,
      message: 'Personel başarıyla oluşturuldu',
      uid: userRecord.uid,
      email: email,
      password: finalPassword  // ✅ Şifreyi de döndür (güvenlik için production'da kaldırılabilir)
    });
    return withCors(req, response);

  } catch (error: any) {
    console.error('Personel oluşturma hatası:', error);
    const response = NextResponse.json(
      { error: 'Personel oluşturulamadı', details: error.message },
      { status: 500 }
    );
    return withCors(req, response);
  }
}

// Personel güncelleme
export async function PUT(req: NextRequest) {
  // 🔥 YENİ: Kullanıcı authentication - Kurucu veya Yönetici gerekli
  const { error: authError, user } = await verifyUserAuth(req, ['Kurucu', 'Yönetici']);
  if (authError) return withCors(req, authError);

  try {
    const body = await req.json();
    const { id, password, ...updateData } = body;

    console.log(`[PUT /api/personel] Personel güncelleniyor: ${id} - İsteği yapan: ${user?.email}`);

    if (!id) {
      const response = NextResponse.json(
        { error: 'Personel ID gerekli' },
        { status: 400 }
      );
      return withCors(req, response);
    }

    // Şifre değişikliği varsa Auth'u güncelle
    if (password && password.length >= 6) {
      try {
        await adminAuth.updateUser(id, { password });
        console.log(`✅ Şifre güncellendi: ${id}`);
      } catch (authError: any) {
        console.error('Auth güncelleme hatası:', authError);
      }
    }

    // ✅ EMAIL DEĞİŞİKLİĞİ VARSA AUTH'U GÜNCELLE
    if (updateData.email) {
      try {
        await adminAuth.updateUser(id, { email: updateData.email });
        console.log(`✅ Email güncellendi: ${id} → ${updateData.email}`);
      } catch (authError: any) {
        console.error('Auth email güncelleme hatası:', authError);
        const response = NextResponse.json(
          { error: 'Email güncellenemedi: ' + authError.message },
          { status: 400 }
        );
        return withCors(req, response);
      }
    }

    // ✅ İŞTEN AYRILMA TARİHİ KONTROLÜ
    // istenAyrilma doluysa → aktif: false
    // istenAyrilma boşsa → aktif: true
    if (updateData.istenAyrilma !== undefined) {
      updateData.aktif = !updateData.istenAyrilma || updateData.istenAyrilma === '';
    }

    // Aktiflik durumu değiştiyse Auth'u güncelle
    if (updateData.aktif !== undefined) {
      try {
        await adminAuth.updateUser(id, { disabled: !updateData.aktif });
        console.log(`✅ Aktiflik durumu güncellendi: ${id} → ${updateData.aktif ? 'Aktif' : 'Pasif'}`);
      } catch (authError: any) {
        console.error('Auth aktiflik güncelleme hatası:', authError);
      }
    }

    // Firestore'u güncelle
    await adminDb.collection('personnel').doc(id).update({
      ...updateData,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || ''
    });

    console.log(`✅ Personel güncellendi: ${id}`);

    const response = NextResponse.json({
      success: true,
      message: 'Personel başarıyla güncellendi'
    });
    return withCors(req, response);

  } catch (error: any) {
    console.error('Personel güncelleme hatası:', error);
    const response = NextResponse.json(
      { error: 'Personel güncellenemedi', details: error.message },
      { status: 500 }
    );
    return withCors(req, response);
  }
}

// Personel silme (soft delete - pasif yapma)
export async function DELETE(req: NextRequest) {
  // 🔥 DELETE için admin auth kullan (güvenlik)
  const adminAuthError = verifyAdminAuth(req);
  if (adminAuthError) return withCors(req, adminAuthError);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hardDelete') === 'true';

    console.log(`[DELETE /api/personel] Personel silme: ${id} (hard: ${hardDelete})`);

    if (!id) {
      const response = NextResponse.json(
        { error: 'Personel ID gerekli' },
        { status: 400 }
      );
      return withCors(req, response);
    }

    if (hardDelete) {
      // Kalıcı silme
      await adminAuth.deleteUser(id);
      await adminDb.collection('personnel').doc(id).delete();
      
      console.log(`✅ Personel kalıcı olarak silindi: ${id}`);
      
      const response = NextResponse.json({
        success: true,
        message: 'Personel kalıcı olarak silindi'
      });
      return withCors(req, response);
    } else {
      // Soft delete - pasif yap
      await adminAuth.updateUser(id, { disabled: true });
      await adminDb.collection('personnel').doc(id).update({
        aktif: false,
        istenAyrilma: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      });

      console.log(`✅ Personel pasif yapıldı: ${id}`);

      const response = NextResponse.json({
        success: true,
        message: 'Personel pasif yapıldı'
      });
      return withCors(req, response);
    }

  } catch (error: any) {
    console.error('Personel silme hatası:', error);
    const response = NextResponse.json(
      { error: 'Personel silinemedi', details: error.message },
      { status: 500 }
    );
    return withCors(req, response);
  }
}