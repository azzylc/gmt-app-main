import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/app/lib/firestore-admin';
import { sendPasswordResetEmail } from '@/app/lib/email';

// Rastgele şifre üret
function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: NextRequest) {
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

    // Validasyon - şifre artık zorunlu değil
    if (!email || !ad || !soyad || !sicilNo || !telefon) {
      return NextResponse.json(
        { error: 'Zorunlu alanlar eksik: email, ad, soyad, sicilNo, telefon' },
        { status: 400 }
      );
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
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'Bu email adresi zaten kayıtlı' },
          { status: 400 }
        );
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
      authUid: userRecord.uid
    };

    // Auth UID'yi doc ID olarak kullan
    await adminDb.collection('personnel').doc(userRecord.uid).set(personelData);

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

    return NextResponse.json({
      success: true,
      message: 'Personel başarıyla oluşturuldu',
      uid: userRecord.uid,
      email: email,
      password: finalPassword  // ✅ Şifreyi de döndür (güvenlik için production'da kaldırılabilir)
    });

  } catch (error: any) {
    console.error('Personel oluşturma hatası:', error);
    return NextResponse.json(
      { error: 'Personel oluşturulamadı', details: error.message },
      { status: 500 }
    );
  }
}

// Personel güncelleme
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Personel ID gerekli' },
        { status: 400 }
      );
    }

    // Şifre değişikliği varsa Auth'u güncelle
    if (password && password.length >= 6) {
      try {
        await adminAuth.updateUser(id, { password });
      } catch (authError: any) {
        console.error('Auth güncelleme hatası:', authError);
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
      } catch (authError: any) {
        console.error('Auth aktiflik güncelleme hatası:', authError);
      }
    }

    // Firestore'u güncelle
    await adminDb.collection('personnel').doc(id).update({
      ...updateData,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Personel başarıyla güncellendi'
    });

  } catch (error: any) {
    console.error('Personel güncelleme hatası:', error);
    return NextResponse.json(
      { error: 'Personel güncellenemedi', details: error.message },
      { status: 500 }
    );
  }
}

// Personel silme (soft delete - pasif yapma)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hardDelete = searchParams.get('hardDelete') === 'true';

    if (!id) {
      return NextResponse.json(
        { error: 'Personel ID gerekli' },
        { status: 400 }
      );
    }

    if (hardDelete) {
      // Kalıcı silme
      await adminAuth.deleteUser(id);
      await adminDb.collection('personnel').doc(id).delete();
      
      return NextResponse.json({
        success: true,
        message: 'Personel kalıcı olarak silindi'
      });
    } else {
      // Soft delete - pasif yap
      await adminAuth.updateUser(id, { disabled: true });
      await adminDb.collection('personnel').doc(id).update({
        aktif: false,
        istenAyrilma: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Personel pasif yapıldı'
      });
    }

  } catch (error: any) {
    console.error('Personel silme hatası:', error);
    return NextResponse.json(
      { error: 'Personel silinemedi', details: error.message },
      { status: 500 }
    );
  }
}