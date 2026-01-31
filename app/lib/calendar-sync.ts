import { google } from 'googleapis';
import { adminDb } from './firestore-admin';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

// Google Calendar API client
export function getCalendarClient() {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  return google.calendar({ version: 'v3', auth });
}

// Description'dan tüm bilgileri parse et (DÜZELTME: \n korunuyor!)
function parseDescription(description: string) {
  // NBSP temizle, normalize et, ama \n'leri KORUYALIM!
  const lines = description
    .replace(/\u00A0/g, ' ')  // NBSP → normal boşluk
    .normalize('NFKC')         // Unicode normalize
    .split('\n')               // Satırlara böl
    .map(line => line.replace(/ +/g, ' ').trim());  // Her satırı temizle

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

    // Kına Günü
    if (!result.kinaGunu && line.includes('Kına') && !line.includes(':')) {
      result.kinaGunu = line.trim();
    }

    // Tel No
    if (lower.includes('tel no:') && !lower.includes('eşi')) {
      result.telefon = line.split(':')[1]?.trim() || '';
    }

    // Eşi Tel No
    if (lower.includes('eşi tel no:')) {
      result.esiTelefon = line.split(':')[1]?.trim() || '';
    }

    // Instagram
    if (lower.includes('ig:')) {
      result.instagram = line.split(':')[1]?.trim() || '';
    }

    // Fotoğrafçı
    if (lower.includes('fotoğrafçı:')) {
      result.fotografci = line.split(':')[1]?.trim() || '';
    }

    // Modaevi
    if (lower.includes('modaevi:')) {
      result.modaevi = line.split(':')[1]?.trim() || '';
    }

    // Anlaşılan Ücret (DÜZELTME: sadece ":" dan sonrasını parse et!)
    if (line.includes('Anlaşılan Ücret:')) {
      const value = line.split(':')[1]?.trim() || '';
      if (value.toUpperCase().includes('X')) {
        result.ucret = -1;
      } else {
        const nums = value.replace(/[^0-9]/g, '');
        result.ucret = parseInt(nums) || 0;
      }
    }

    // Kapora (DÜZELTME: sadece ":" dan sonrasını parse et!)
    if (line.includes('Kapora:')) {
      const value = line.split(':')[1]?.trim() || '';
      const nums = value.replace(/[^0-9]/g, '');
      result.kapora = parseInt(nums) || 0;
    }

    // Kalan (DÜZELTME: sadece ":" dan sonrasını parse et!)
    if (line.includes('Kalan:')) {
      const value = line.split(':')[1]?.trim() || '';
      if (value.toUpperCase().includes('X')) {
        result.kalan = -1;
      } else {
        const nums = value.replace(/[^0-9]/g, '');
        result.kalan = parseInt(nums) || 0;
      }
    }

    // Anlaştığı Tarih - ISO formatına çevir
    if (lower.includes('anlaştığı tarih:')) {
      const dateStr = line.split(':').slice(1).join(':').trim();
      const match = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
      if (match) {
        const [_, day, month, year, hour, minute] = match;
        result.anlasildigiTarih = `${year}-${month}-${day}T${hour}:${minute}:00`;
      }
    }

    // Checkboxlar
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

    // Gelin Notu
    if (lower.includes('varsa gelin notu:')) {
      result.gelinNotu = line.split(':').slice(1).join(':').trim();
    }

    // Dekont Görseli
    if (lower.includes('dekont görseli:')) {
      result.dekontGorseli = line.split(':').slice(1).join(':').trim();
    }
  });

  return result;
}

// Personel bilgisini parse et
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

// Event'i Firestore formatına çevir (FİLTRELER KALDIRILDI!)
function eventToGelin(event: any) {
  const title = event.summary || '';
  const description = event.description || '';
  const startDate = event.start?.dateTime || event.start?.date;

  if (!startDate) {
    console.warn('[SKIP] startDate yok:', { id: event.id, title });
    return null;
  }

  const date = new Date(startDate);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].substring(0, 5);

  const parsedData = parseDescription(description);
  const { isim, makyaj, turban } = parsePersonel(title);

  // ❌ ARTIK FİLTRE YOK! TÜM GELİNLER EKLENİYOR!
  // (İptal olanlar da, ücret 0 olanlar da dahil)

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

// Incremental sync - syncToken kullanarak
export async function incrementalSync(syncToken?: string) {
  const calendar = getCalendarClient();

  const params: any = {
    calendarId: CALENDAR_ID,
    singleEvents: true,
    showDeleted: true,
  };

  if (syncToken) {
    params.syncToken = syncToken;
  } else {
    params.timeMin = new Date('2025-01-01').toISOString();
    params.timeMax = new Date('2030-12-31').toISOString();
  }

  try {
    const response = await calendar.events.list(params);
    const events = response.data.items || [];
    const newSyncToken = response.data.nextSyncToken;

    const batch = adminDb.batch();
    let updateCount = 0;

    for (const event of events) {
      if (event.status === 'cancelled') {
        const docRef = adminDb.collection('gelinler').doc(event.id!);
        batch.delete(docRef);
        updateCount++;
      } else {
        const gelin = eventToGelin(event);
        if (gelin) {
          const docRef = adminDb.collection('gelinler').doc(gelin.id);
          batch.set(docRef, gelin, { merge: true });
          updateCount++;
        }
      }
    }

    if (updateCount > 0) {
      await batch.commit();
    }

    return { success: true, updateCount, syncToken: newSyncToken };
  } catch (error: any) {
    if (error.code === 410) {
      return { success: false, error: 'SYNC_TOKEN_INVALID' };
    }
    throw error;
  }
}

// Full sync - Önce temizle sonra yaz (PAGINATION İLE + BATCH LİMİTLERİ!)
export async function fullSync() {
  const calendar = getCalendarClient();

  // 1. ÖNCE TÜM GELİNLERİ SİL (500'LÜK BATCH'LERLE!)
  console.log('🗑️ Firestore temizleniyor...');
  const allDocs = await adminDb.collection('gelinler').get();
  
  // 500'lük gruplar halinde sil
  for (let i = 0; i < allDocs.docs.length; i += 500) {
    const deleteBatch = adminDb.batch();
    const chunk = allDocs.docs.slice(i, i + 500);
    chunk.forEach(doc => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    console.log(`🗑️ ${i + chunk.length} / ${allDocs.docs.length} gelin silindi...`);
  }
  
  console.log(`✅ Toplam ${allDocs.size} gelin silindi`);

  // 2. CALENDAR'DAN TÜM GELİNLERİ ÇEK (PAGINATION İLE!)
  console.log('📥 Calendar\'dan çekiliyor...');
  let allEvents: any[] = [];
  let pageToken: string | null | undefined = undefined;

  do {
    const response: any = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date('2025-01-01').toISOString(),
      timeMax: new Date('2030-12-31').toISOString(),
      singleEvents: true,
      maxResults: 2500,  // Her sayfada max 2500
      pageToken: pageToken || undefined
    });

    const events = response.data.items || [];
    allEvents = allEvents.concat(events);
    pageToken = response.data.nextPageToken;

    console.log(`📦 ${events.length} event çekildi (Toplam: ${allEvents.length})`);
  } while (pageToken);

  console.log(`✅ Toplam ${allEvents.length} event çekildi`);

  // 3. FIRESTORE'A YAZ (100'LÜK BATCH'LERLE - DAHA KÜÇÜK!)
  console.log('📝 Firestore\'a yazılıyor...');
  let addedCount = 0;
  let batch = adminDb.batch();
  let batchCount = 0;

  for (const event of allEvents) {
    const gelin = eventToGelin(event);
    if (gelin) {
      const docRef = adminDb.collection('gelinler').doc(gelin.id);
      batch.set(docRef, gelin);
      addedCount++;
      batchCount++;

      // Firestore batch limiti: 100'E DÜŞÜRÜLDÜ (description'lar uzun!)
      if (batchCount >= 100) {
        await batch.commit();
        console.log(`💾 ${addedCount} gelin yazıldı...`);
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
  }

  // Son batch'i commit et
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ Toplam ${addedCount} gelin eklendi`);

  return { 
    success: true, 
    deleted: allDocs.size,
    totalEvents: allEvents.length,
    added: addedCount
  };
}