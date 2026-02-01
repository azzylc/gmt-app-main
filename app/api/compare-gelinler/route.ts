import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firestore-admin';
import { getCalendarClient } from '@/app/lib/calendar-sync';
import { verifyAdminAuth } from '@/app/lib/auth';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;

/**
 * ADMIN TOOL: Firestore vs Google Calendar Karşılaştırma
 * 
 * Detaylı analiz:
 * - İsim bazlı analiz (İptal, Ertelendi, İzin, Tatil, REF)
 * - Tarih grupları
 * - Fazla/eksik gelinler
 * - Neden analizi
 */
export async function GET(req: NextRequest) {
  // Verify admin authentication
  const authError = verifyAdminAuth(req);
  if (authError) return authError;

  try {
    console.log('🔍 Firestore vs Google Calendar Karşılaştırma Başlıyor...');
    
    // 1. FIRESTORE'DAN GELİNLERİ ÇEK
    console.log('1️⃣ Firestore\'dan gelinler çekiliyor...');
    
    const snapshot = await adminDb
      .collection('gelinler')
      .orderBy('tarih', 'asc')
      .get();
    
    const firestoreGelinler: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      firestoreGelinler.push({
        id: doc.id,
        isim: data.isim || '',
        tarih: data.tarih || '',
        saat: data.saat || '',
        makyaj: data.makyaj || '',
        turban: data.turban || ''
      });
    });
    
    console.log(`   ✅ ${firestoreGelinler.length} gelin bulundu (Firestore)`);
    
    // 2. GOOGLE CALENDAR'DAN GELİNLERİ ÇEK
    console.log('2️⃣ Google Calendar\'dan gelinler çekiliyor...');
    
    const calendar = getCalendarClient();
    const calendarResponse = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: new Date('2025-01-01').toISOString(),
      timeMax: new Date('2030-12-31').toISOString(),
      singleEvents: true,
      maxResults: 2500,
    });

    const calendarEvents = calendarResponse.data.items || [];
    
    // Calendar'daki finansal eventleri filtrele (Firestore'dakilerle aynı mantık)
    const calendarGelinler = calendarEvents
      .filter(event => {
        const summary = event.summary || '';
        const description = event.description || '';
        
        // REF veya finansal veri içeren eventler
        return (
          summary.toUpperCase().includes('REF') ||
          description.includes('Anlaşılan Ücret:') ||
          description.includes('Kapora:') ||
          description.includes('Kalan:')
        );
      })
      .map(event => ({
        id: event.id,
        isim: event.summary || '',
        tarih: event.start?.dateTime 
          ? new Date(event.start.dateTime).toISOString().split('T')[0]
          : event.start?.date || '',
        saat: event.start?.dateTime
          ? new Date(event.start.dateTime).toLocaleTimeString('tr-TR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Europe/Istanbul'
            })
          : '',
      }));
    
    console.log(`   ✅ ${calendarGelinler.length} gelin bulundu (Calendar)`);
    
    // 3. KARŞILAŞTIRMA YAP
    console.log('3️⃣ Karşılaştırma yapılıyor...');
    
    // Calendar'daki gelinlerin key'lerini oluştur
    const calendarKeys = new Set<string>();
    calendarGelinler.forEach(gelin => {
      const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
      const key2 = `${gelin.isim}|${gelin.tarih}`;
      calendarKeys.add(key1);
      calendarKeys.add(key2);
    });
    
    // Firestore'da olup Calendar'da olmayanları bul
    const fazlaGelinler = firestoreGelinler.filter(gelin => {
      const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
      const key2 = `${gelin.isim}|${gelin.tarih}`;
      return !calendarKeys.has(key1) && !calendarKeys.has(key2);
    });
    
    // 4. ANALİZ YAP
    const analiz: any = {
      toplam: {
        firestore: firestoreGelinler.length,
        calendar: calendarGelinler.length,
        fark: firestoreGelinler.length - calendarGelinler.length
      },
      fazlaGelinler: fazlaGelinler,
      fazlaGelinlerSayisi: fazlaGelinler.length,
      nedenler: {}
    };
    
    // REF kontrolü
    const refGelinler = fazlaGelinler.filter(g => g.isim.toUpperCase().includes('REF'));
    if (refGelinler.length > 0) {
      analiz.nedenler.ref = {
        adet: refGelinler.length,
        aciklama: 'Calendar\'da REF filtrelenmiş olabilir'
      };
    }
    
    // İsim analizi
    const isimAnaliz: any = {
      'İptal': 0,
      'Ertelendi': 0,
      'İzin': 0,
      'Tatil': 0,
      'REF': 0,
      'Diğer': 0
    };
    
    fazlaGelinler.forEach(gelin => {
      const isimLower = gelin.isim.toLowerCase();
      if (isimLower.includes('iptal')) isimAnaliz['İptal']++;
      else if (isimLower.includes('ertelendi')) isimAnaliz['Ertelendi']++;
      else if (isimLower.includes('izinli') || isimLower.includes('izin')) isimAnaliz['İzin']++;
      else if (isimLower.includes('tatil')) isimAnaliz['Tatil']++;
      else if (isimLower.includes('ref')) isimAnaliz['REF']++;
      else isimAnaliz['Diğer']++;
    });
    
    analiz.nedenler.isimAnaliz = isimAnaliz;
    
    // Tarihe göre grupla
    const tarihGruplari: any = {};
    fazlaGelinler.forEach(gelin => {
      if (!tarihGruplari[gelin.tarih]) {
        tarihGruplari[gelin.tarih] = [];
      }
      tarihGruplari[gelin.tarih].push(gelin);
    });
    
    analiz.tarihGruplari = tarihGruplari;
    
    console.log('✅ Analiz tamamlandı!');
    
    return NextResponse.json(analiz);
    
  } catch (error: any) {
    console.error('❌ Karşılaştırma hatası:', error);
    return NextResponse.json({ 
      error: 'Karşılaştırma başarısız',
      details: error.message 
    }, { status: 500 });
  }
}