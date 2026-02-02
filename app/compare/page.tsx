"use client";
import { useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, orderBy as firestoreOrderBy, query } from "firebase/firestore";

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";

export default function CompareGelinlerPage() {
  const [loading, setLoading] = useState(false);
  const [sonuc, setSonuc] = useState<any>(null);

  const karsilastir = async () => {
    setLoading(true);
    setSonuc(null);

    try {
      console.log('🔍 Firestore vs Excel Karşılaştırma Başlıyor...');
      
      // ✅ TARİH FİLTRESİ - 2025-01-01 VE SONRASI
      const MIN_TARIH = '2025-01-01';
      console.log(`📅 Tarih Filtresi: ${MIN_TARIH} ve sonrası\n`);
      
      // 🧹 İSİM NORMALİZASYON FONKSİYONU
      // Her iki kaynaktan da ✅ ve sonrasını temizle
      const normalizeIsim = (isim: string): string => {
        if (!isim) return '';
        // ✅ işaretine kadar olan kısmı al
        const temiz = isim.split('✅')[0].trim();
        return temiz;
      };
      
      // 1. FIRESTORE'DAN GELİNLERİ ÇEK
      console.log('1️⃣ Firestore\'dan gelinler çekiliyor...');
      
      const q = query(collection(db, 'gelinler'), firestoreOrderBy('tarih', 'asc'));
      const snapshot = await getDocs(q);
      
      const firestoreGelinlerTum: any[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        firestoreGelinlerTum.push({
          id: doc.id,
          isim: normalizeIsim(data.isim || ''), // 🧹 TEMİZLE!
          tarih: data.tarih || '',
          saat: data.saat || '',
          makyaj: data.makyaj || '',
          turban: data.turban || ''
        });
      });
      
      // ✅ TARİH FİLTRESİ UYGULA
      const firestoreGelinler = firestoreGelinlerTum.filter(g => g.tarih >= MIN_TARIH);
      
      console.log(`   📦 ${firestoreGelinlerTum.length} gelin çekildi (toplam)`);
      console.log(`   ✅ ${firestoreGelinler.length} gelin (${MIN_TARIH} ve sonrası)\n`);
      
      // 2. EXCEL'DEN GELİNLERİ ÇEK (Apps Script - Excel endpoint)
      console.log('2️⃣ Excel\'den gelinler çekiliyor...');
      
      const response = await fetch(`${APPS_SCRIPT_URL}?action=excel`);
      const responseData = await response.json();
      
      // Hata kontrolü
      if (responseData.error) {
        throw new Error('Excel\'den veri çekilemedi: ' + responseData.error);
      }
      
      // ✅ API response'dan gelinler array'ini al VE NORMALİZE ET
      const excelGelinlerTum = (responseData.gelinler || []).map((g: any) => ({
        ...g,
        isim: normalizeIsim(g.isim || '') // 🧹 TEMİZLE!
      }));
      
      // ✅ TARİH FİLTRESİ UYGULA
      const excelGelinler = excelGelinlerTum.filter((g: any) => g.tarih >= MIN_TARIH);
      
      console.log(`   📦 ${responseData.count || excelGelinlerTum.length} gelin çekildi (Excel toplam)`);
      console.log(`   ✅ ${excelGelinler.length} gelin (${MIN_TARIH} ve sonrası)\n`);
      
      // 🔍 DEBUG: İlk 5 kaydı göster
      console.log('🔍 DEBUG - Firestore ilk 5:');
      firestoreGelinler.slice(0, 5).forEach((g, i) => {
        console.log(`   ${i+1}. ${g.isim} | ${g.tarih} | "${g.saat}"`);
      });
      
      console.log('\n🔍 DEBUG - Excel ilk 5:');
      excelGelinler.slice(0, 5).forEach((g: any, i: number) => {
        console.log(`   ${i+1}. ${g.isim} | ${g.tarih} | "${g.saat}"`);
      });
      console.log('');
      
      // 3. KARŞILAŞTIRMA YAP
      console.log('3️⃣ Karşılaştırma yapılıyor...');
      
      // Excel'deki gelinlerin key'lerini oluştur
      const excelKeys = new Set<string>();
      excelGelinler.forEach((gelin: any) => {
        const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
        const key2 = `${gelin.isim}|${gelin.tarih}`;
        excelKeys.add(key1);
        excelKeys.add(key2);
      });
      
      console.log(`   📊 Excel'de ${excelKeys.size} benzersiz key oluşturuldu\n`);
      
      // Firestore'da olup Excel'de olmayanları bul
      const fazlaGelinler = firestoreGelinler.filter(gelin => {
        const key1 = `${gelin.isim}|${gelin.tarih}|${gelin.saat}`;
        const key2 = `${gelin.isim}|${gelin.tarih}`;
        return !excelKeys.has(key1) && !excelKeys.has(key2);
      });
      
      console.log(`   ❌ ${fazlaGelinler.length} gelin Firestore'da var ama Excel'de yok\n`);
      
      // 🔍 DEBUG: İlk 10 uyuşmayan kaydı göster
      if (fazlaGelinler.length > 0) {
        console.log('🔍 DEBUG - İlk 10 uyuşmayan kayıt:');
        fazlaGelinler.slice(0, 10).forEach((g, i) => {
          console.log(`   ${i+1}. ${g.isim} | ${g.tarih} | "${g.saat}"`);
        });
        console.log('');
      }
      
      // 4. ANALİZ YAP
      const analiz: any = {
        minTarih: MIN_TARIH,
        toplam: {
          firestore: firestoreGelinler.length,
          excel: excelGelinler.length,
          fark: firestoreGelinler.length - excelGelinler.length
        },
        toplamOrijinal: {
          firestore: firestoreGelinlerTum.length,
          excel: excelGelinlerTum.length
        },
        fazlaGelinler: fazlaGelinler,
        fazlaGelinlerSayisi: fazlaGelinler.length,
        nedenler: {} as any
      };
      
      // REF kontrolü
      const refGelinler = fazlaGelinler.filter(g => g.isim.toUpperCase().includes('REF'));
      if (refGelinler.length > 0) {
        analiz.nedenler.ref = {
          adet: refGelinler.length,
          aciklama: 'Excel\'de REF filtrelenmiş olabilir',
          gelinler: refGelinler
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
      console.log('Sonuç:', analiz);
      
      setSonuc(analiz);
      
    } catch (error: any) {
      console.error('❌ Karşılaştırma hatası:', error);
      setSonuc({
        error: 'Karşılaştırma başarısız',
        details: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!sonuc) return;
    
    const dataStr = JSON.stringify(sonuc, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'firestore-vs-excel-karsilastirma.json';
    link.click();
  };

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">🔍 Firestore vs Excel Karşılaştırma</h1>
          <p className="text-stone-600 mb-2">2025-01-01 ve sonrası tarihli gelinleri karşılaştır</p>
          <p className="text-sm text-stone-500 mb-6">Firestore'da fazla olan gelinleri bul ve analiz et</p>

          <button
            onClick={karsilastir}
            disabled={loading}
            className="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ Karşılaştırılıyor...' : '🚀 Karşılaştırmayı Başlat'}
          </button>

          {sonuc && (
            <div className="mt-8">
              {sonuc.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-red-800 mb-2">❌ Hata</h2>
                  <p className="text-red-600">{sonuc.details}</p>
                </div>
              ) : (
                <>
                  {/* Özet */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h2 className="text-xl font-bold text-blue-800 mb-2">📊 Özet</h2>
                    <p className="text-sm text-stone-600 mb-4">
                      📅 Tarih Filtresi: <span className="font-semibold">{sonuc.minTarih} ve sonrası</span>
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-stone-600">Firestore</p>
                        <p className="text-3xl font-bold text-blue-600">{sonuc.toplam.firestore}</p>
                        <p className="text-xs text-stone-500">({sonuc.toplamOrijinal.firestore} toplam)</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Excel</p>
                        <p className="text-3xl font-bold text-green-600">{sonuc.toplam.excel}</p>
                        <p className="text-xs text-stone-500">({sonuc.toplamOrijinal.excel} toplam)</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-600">Fark</p>
                        <p className={`text-3xl font-bold ${sonuc.toplam.fark === 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {sonuc.toplam.fark > 0 ? '+' : ''}{sonuc.toplam.fark}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fazla Gelinler */}
                  {sonuc.fazlaGelinlerSayisi > 0 ? (
                    <>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                        <h2 className="text-xl font-bold text-red-800 mb-4">
                          🔴 Firestore'da Fazla Olan {sonuc.fazlaGelinlerSayisi} Gelin
                        </h2>

                        {/* İsim Analizi */}
                        {sonuc.nedenler.isimAnaliz && (
                          <div className="mb-4">
                            <h3 className="font-semibold text-stone-800 mb-2">İsim Analizi:</h3>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(sonuc.nedenler.isimAnaliz)
                                .filter(([_, count]) => (count as number) > 0)
                                .map(([kategori, adet]) => (
                                  <div key={kategori} className="bg-white px-3 py-1 rounded-full text-sm">
                                    <span className="font-medium">{kategori}:</span> {adet as number}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* REF Analizi */}
                        {sonuc.nedenler.ref && (
                          <div className="mb-4 bg-purple-100 rounded-lg p-3">
                            <h3 className="font-semibold text-purple-800 mb-1">🤖 REF Kartları</h3>
                            <p className="text-sm text-purple-700">
                              {sonuc.nedenler.ref.adet} adet REF kartı bulundu. {sonuc.nedenler.ref.aciklama}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Tarihe Göre Liste */}
                      <div className="bg-white border border-stone-200 rounded-lg p-6">
                        <h2 className="text-xl font-bold text-stone-800 mb-4">📅 Tarihe Göre Detay</h2>
                        <div className="space-y-4">
                          {Object.entries(sonuc.tarihGruplari)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([tarih, gelinler]) => (
                              <div key={tarih} className="border-l-4 border-rose-500 pl-4">
                                <h3 className="font-semibold text-stone-800 mb-2">{tarih}</h3>
                                <div className="space-y-1">
                                  {(gelinler as any[]).map((gelin, idx) => (
                                    <div key={idx} className="text-sm text-stone-600">
                                      • {gelin.isim} ({gelin.saat}) - Makyaj: {gelin.makyaj}, Türban: {gelin.turban}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Download Button */}
                      <div className="mt-6">
                        <button
                          onClick={downloadJSON}
                          className="px-6 py-3 bg-stone-800 text-white rounded-lg hover:bg-stone-900 transition font-medium"
                        >
                          💾 JSON Olarak İndir
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <h2 className="text-xl font-bold text-green-800 mb-2">✅ Tamamen Senkron!</h2>
                      <p className="text-green-700">Firestore ve Excel'deki veriler birebir aynı.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}