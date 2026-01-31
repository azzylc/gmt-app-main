import { NextResponse } from 'next/server';
import { getCalendarClient } from '../../lib/calendar-sync';
import { adminDb } from '../../lib/firestore-admin';

// Sadece test için - parseDescription fonksiyonunu kopyalıyoruz
function parseDescription(description: string) {
  const lines = description
    .replace(/\u00A0/g, ' ')
    .normalize('NFKC')
    .split('\n')
    .map(line => line.replace(/ +/g, ' ').trim());

  const result: any = {
    kinaGunu: '',
    telefon: '',
    esiTelefon: '',
    instagram: '',
    fotografci: '',
    modaevi: '',
    anlasildigiTarih: '',
    bilgilendirmeGonderildi: false,
    ucretYazildi: false,
    malzemeListesiGonderildi: false,
    paylasimIzni: false,
    yorumIstesinMi: '',
    yorumIstendiMi: false,
    gelinNotu: '',
    dekontGorseli: '',
    ucret: 0,
    kapora: 0,
    kalan: 0
  };

  lines.forEach(line => {
    const lower = line.toLowerCase().trim();

    if (!result.kinaGunu && line.includes('Kına') && !line.includes(':')) {
      result.kinaGunu = line.trim();
    }

    if (lower.includes('tel no:') && !lower.includes('eşi')) {
      result.telefon = line.split(':')[1]?.trim() || '';
    }

    if (lower.includes('eşi tel no:')) {
      result.esiTelefon = line.split(':')[1]?.trim() || '';
    }

    if (lower.includes('ig:')) {
      result.instagram = line.split(':')[1]?.trim() || '';
    }

    if (lower.includes('fotoğrafçı:')) {
      result.fotografci = line.split(':')[1]?.trim() || '';
    }

    if (lower.includes('modaevi:')) {
      result.modaevi = line.split(':')[1]?.trim() || '';
    }

    if (line.includes('Anlaşılan Ücret:')) {
      const value = line.split(':')[1]?.trim() || '';
      if (value.toUpperCase().includes('X')) {
        result.ucret = -1;
      } else {
        const nums = value.replace(/[^0-9]/g, '');
        result.ucret = parseInt(nums) || 0;
      }
    }

    if (line.includes('Kapora:')) {
      const value = line.split(':')[1]?.trim() || '';
      const nums = value.replace(/[^0-9]/g, '');
      result.kapora = parseInt(nums) || 0;
    }

    if (line.includes('Kalan:')) {
      const value = line.split(':')[1]?.trim() || '';
      if (value.toUpperCase().includes('X')) {
        result.kalan = -1;
      } else {
        const nums = value.replace(/[^0-9]/g, '');
        result.kalan = parseInt(nums) || 0;
      }
    }

    if (lower.includes('anlaştığı tarih:')) {
      const dateStr = line.split(':').slice(1).join(':').trim();
      const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
      if (match) {
        const [_, day, month, year, hour, minute] = match;
        result.anlasildigiTarih = `${year}-${month}-${day}T${hour}:${minute}:00`;
      }
    }

    if (lower.includes('bilgilendirme metni gönderildi mi')) {
      result.bilgilendirmeGonderildi = line.includes('✔️') || line.includes('✓');
    }

    if (lower.includes('anlaşılan ve kalan ücret yazıldı mı')) {
      result.ucretYazildi = line.includes('✔️') || line.includes('✓');
    }

    if (lower.includes('malzeme listesi gönderildi mi')) {
      result.malzemeListesiGonderildi = line.includes('✔️') || line.includes('✓');
    }

    if (lower.includes('paylaşım izni var mı')) {
      result.paylasimIzni = line.includes('✔️') || line.includes('✓');
    }

    if (lower.includes('yorum istensin mi') && !lower.includes('istendi')) {
      result.yorumIstesinMi = line.includes('✔️') || line.includes('✓') ? 'Evet' : '';
    }

    if (lower.includes('yorum istendi mi')) {
      result.yorumIstendiMi = line.includes('✔️') || line.includes('✓');
    }

    if (lower.includes('varsa gelin notu:')) {
      result.gelinNotu = line.split(':').slice(1).join(':').trim();
    }

    if (lower.includes('dekont görseli:')) {
      result.dekontGorseli = line.split(':').slice(1).join(':').trim();
    }
  });

  return result;
}

function parsePersonel(title: string) {
  const kisaltmaMap: { [key: string]: string } = {
    "SA": "Saliha",
    "SE": "Selen",
    "T": "Tansu",
    "K": "Kübra",
    "R": "Rümeysa",
    "B": "Bahar",
    "Z": "Zehra"
  };

  const temizleVeEsle = (str: string) => {
    const temiz = str.replace(/[-–—]/g, '').trim().toUpperCase();
    return kisaltmaMap[temiz] || temiz;
  };

  const parts = title.split('✅');
  const isim = (parts[0] || '').trim();
  const personelStr = (parts[1] || '').replace(/[-–—]/g, ' ').trim();

  let makyaj = '';
  let turban = '';

  if (personelStr.includes('&')) {
    const kisiler = personelStr.split('&').map(x => temizleVeEsle(x.trim()));
    makyaj = kisiler[0] || '';
    turban = kisiler[1] || '';
  } else if (personelStr) {
    const kisi = temizleVeEsle(personelStr);
    makyaj = kisi;
    turban = kisi;
  }

  return { isim, makyaj, turban };
}

function eventToGelin(event: any) {
  const title = event.summary || '';
  const description = event.description || '';
  const startDate = event.start?.dateTime || event.start?.date;

  if (!startDate) return null;

  const date = new Date(startDate);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].substring(0, 5);

  const parsedData = parseDescription(description);
  const { isim, makyaj, turban } = parsePersonel(title);

  return {
    id: event.id,
    isim,
    tarih: dateStr,
    saat: timeStr,
    ucret: parsedData.ucret,
    kapora: parsedData.kapora,
    kalan: parsedData.kalan,
    makyaj,
    turban,
    kinaGunu: parsedData.kinaGunu,
    telefon: parsedData.telefon,
    esiTelefon: parsedData.esiTelefon,
    instagram: parsedData.instagram,
    fotografci: parsedData.fotografci,
    modaevi: parsedData.modaevi,
    anlasildigiTarih: parsedData.anlasildigiTarih,
    bilgilendirmeGonderildi: parsedData.bilgilendirmeGonderildi,
    ucretYazildi: parsedData.ucretYazildi,
    malzemeListesiGonderildi: parsedData.malzemeListesiGonderildi,
    paylasimIzni: parsedData.paylasimIzni,
    yorumIstesinMi: parsedData.yorumIstesinMi,
    yorumIstendiMi: parsedData.yorumIstendiMi,
    gelinNotu: parsedData.gelinNotu,
    dekontGorseli: parsedData.dekontGorseli,
    updatedAt: new Date().toISOString()
  };
}

export async function POST() {
  try {
    console.log('📅 Ocak 2026 test sync başlıyor...');
    
    const calendar = getCalendarClient();

    // Sadece Ocak 2026
    const response: any = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID!,
      timeMin: new Date('2026-02-01T00:00:00Z').toISOString(),
      timeMax: new Date('2026-02-28T23:59:59Z').toISOString(),
      singleEvents: true,
      maxResults: 500
    });

    const events = response.data.items || [];
    console.log(`📦 ${events.length} event bulundu`);

    const parseResults = [];
    const batch = adminDb.batch();
    let addedCount = 0;

    for (const event of events) {
      const gelin = eventToGelin(event);
      
      if (gelin) {
        // Firestore'a ekle
        const docRef = adminDb.collection('gelinler').doc(gelin.id);
        batch.set(docRef, gelin);
        addedCount++;

        // Parse sonucunu kaydet
        parseResults.push({
          isim: gelin.isim,
          tarih: gelin.tarih,
          ucret: gelin.ucret,
          kapora: gelin.kapora,
          kalan: gelin.kalan,
          telefon: gelin.telefon,
          fotografci: gelin.fotografci,
          modaevi: gelin.modaevi,
          sorunlu: gelin.ucret > 1000000 || gelin.kapora > 1000000 // Çok büyük sayı var mı?
        });
      }
    }

    // Firestore'a yaz
    await batch.commit();
    console.log(`✅ ${addedCount} gelin eklendi`);

    // Sorunlu parse'ları bul
    const sorunluGelinler = parseResults.filter(g => g.sorunlu);

    return NextResponse.json({
      success: true,
      totalEvents: events.length,
      addedCount,
      parseResults,
      sorunluGelinler,
      message: sorunluGelinler.length > 0 
        ? `⚠️ ${sorunluGelinler.length} gelin sorunlu parse edildi!`
        : '✅ Tüm gelinler başarıyla parse edildi!'
    });

  } catch (error: any) {
    console.error('Test sync error:', error);
    return NextResponse.json({ 
      error: 'Test sync failed', 
      details: error.message 
    }, { status: 500 });
  }
}