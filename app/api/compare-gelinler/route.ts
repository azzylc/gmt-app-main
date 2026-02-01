// app/api/compare-gelinler/route.ts
// 
// Firestore vs Apps Script karşılaştırma endpoint'i
// Kullanım: http://localhost:3000/api/compare-gelinler

import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, orderBy as firestoreOrderBy, query } from 'firebase/firestore';

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";

export async function GET() {
  try {
    console.log('🔍 Firestore vs Excel Karşılaştırma Başlıyor...');
    
    // 1. FIRESTORE'DAN GELİNLERİ ÇEK
    console.log('1️⃣ Firestore\'dan gelinler çekiliyor...');
    
    const q = query(collection(db, 'gelinler'), firestoreOrderBy('tarih', 'asc'));
    const snapshot = await getDocs(q);
    
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
    
    // 2. APPS SCRIPT'TEN GELİNLERİ ÇEK
    console.log('2️⃣ Apps Script\'ten gelinler çekiliyor...');
    
    const response = await fetch(`${APPS_SCRIPT_URL}?action=gelinler`);
    const appsScriptGelinler = await response.json();
    
    console.log(`   ✅ ${appsScriptGelinler.length} gelin bulundu (Apps Script)`);
    
    // 3. KARŞILAŞTIRMA YAP
    console.log('3️⃣ Karşılaştırma yapılıyor...');
    
    // Apps Script'teki gelinlerin key'lerini oluştur
    const appsScriptKeys = new Set<string>();
    appsScriptGelinler.forEach((gelin: any) => {
      const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
      const key2 = `${gelin.isim}|${gelin.tarih}`;
      appsScriptKeys.add(key1);
      appsScriptKeys.add(key2);
    });
    
    // Firestore'da olup Apps Script'te olmayanları bul
    const fazlaGelinler = firestoreGelinler.filter(gelin => {
      const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
      const key2 = `${gelin.isim}|${gelin.tarih}`;
      return !appsScriptKeys.has(key1) && !appsScriptKeys.has(key2);
    });
    
    // 4. ANALİZ YAP
    const analiz: any = {
      toplam: {
        firestore: firestoreGelinler.length,
        appsScript: appsScriptGelinler.length,
        fark: firestoreGelinler.length - appsScriptGelinler.length
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
        aciklama: 'Apps Script\'te REF filtrelenmiş olabilir'
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