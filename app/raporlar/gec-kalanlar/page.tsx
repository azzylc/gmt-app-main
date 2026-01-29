"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, onSnapshot, orderBy, where, Timestamp, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  sicilNo?: string;
  calismaSaati?: string;
}

interface Konum {
  id: string;
  ad: string;
}

interface GecKalanKayit {
  personelId: string;
  personelAd: string;
  sicilNo: string;
  tarih: string;
  konum: string;
  planSaati: string;
  ilkGiris: string;
  gecKalmaSuresi: string;
  mazeretNotu: string;
}

export default function GecKalanlarPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [konumlar, setKonumlar] = useState<Konum[]>([]);
  const [gecKalanlar, setGecKalanlar] = useState<GecKalanKayit[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const router = useRouter();

  // Filtreler - 2 ay geriye
  const ikiAyOnce = new Date();
  ikiAyOnce.setMonth(ikiAyOnce.getMonth() - 2);
  
  const [baslangicTarih, setBaslangicTarih] = useState(ikiAyOnce.toISOString().split('T')[0]);
  const [bitisTarih, setBitisTarih] = useState(new Date().toISOString().split('T')[0]);
  const [seciliKonum, setSeciliKonum] = useState("Tümü");
  const [gecKalmaToleransi, setGecKalmaToleransi] = useState(10); // dakika

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Personelleri çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "personnel"), orderBy("ad", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad || "",
        soyad: doc.data().soyad || "",
        sicilNo: doc.data().sicilNo || "",
        calismaSaati: doc.data().calismaSaati || ""
      }));
      setPersoneller(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Konumları çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "locations"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad || doc.data().name || ""
      }));
      setKonumlar(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Plan saatini parse et
  const parsePlanSaati = (calismaSaati: string): { saat: number; dakika: number } | null => {
    if (!calismaSaati) return null;
    const match = calismaSaati.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return { saat: parseInt(match[1]), dakika: parseInt(match[2]) };
    }
    return null;
  };

  // Verileri getir
  const fetchRecords = async () => {
    if (!user) return;
    setDataLoading(true);

    const baslangic = new Date(baslangicTarih);
    baslangic.setHours(0, 0, 0, 0);
    const bitis = new Date(bitisTarih);
    bitis.setHours(23, 59, 59, 999);

    // Sadece giriş kayıtlarını çek
    const q = query(
      collection(db, "attendance"),
      where("tarih", ">=", Timestamp.fromDate(baslangic)),
      where("tarih", "<=", Timestamp.fromDate(bitis)),
      where("tip", "==", "giris"),
      orderBy("tarih", "asc")
    );

    const snapshot = await getDocs(q);
    
    // Her personelin her günkü ilk girişini bul
    const ilkGirisler = new Map<string, any>();
    
    snapshot.forEach(doc => {
      const d = doc.data();
      const tarih = d.tarih?.toDate?.();
      if (!tarih) return;
      
      const gunStr = tarih.toISOString().split('T')[0];
      const key = `${d.personelId}-${gunStr}`;
      
      // İlk giriş mi?
      if (!ilkGirisler.has(key) || tarih < ilkGirisler.get(key).tarihDate) {
        ilkGirisler.set(key, { ...d, tarihDate: tarih, gunStr });
      }
    });

    // Geç kalanları hesapla
    const results: GecKalanKayit[] = [];

    ilkGirisler.forEach((kayit) => {
      const personel = personeller.find(p => p.id === kayit.personelId);
      if (!personel) return;

      // Konum filtresi
      if (seciliKonum !== "Tümü" && kayit.konumAdi !== seciliKonum) return;

      // Plan saati yoksa atla
      const planSaati = parsePlanSaati(personel.calismaSaati || "");
      if (!planSaati) return;

      // Giriş saatini al
      const girisSaat = kayit.tarihDate.getHours();
      const girisDakika = kayit.tarihDate.getMinutes();
      const girisSaniye = kayit.tarihDate.getSeconds();

      // Geç kalma süresini hesapla
      const planDakikaTotal = planSaati.saat * 60 + planSaati.dakika;
      const girisDakikaTotal = girisSaat * 60 + girisDakika;
      const gecKalmaDakika = girisDakikaTotal - planDakikaTotal;

      // Tolerans kontrolü
      if (gecKalmaDakika > gecKalmaToleransi) {
        const saat = Math.floor(gecKalmaDakika / 60);
        const dakika = gecKalmaDakika % 60;

        results.push({
          personelId: kayit.personelId,
          personelAd: kayit.personelAd || `${personel.ad} ${personel.soyad}`.trim(),
          sicilNo: personel.sicilNo || "",
          tarih: kayit.gunStr,
          konum: kayit.konumAdi || "-",
          planSaati: `${String(planSaati.saat).padStart(2, '0')}:${String(planSaati.dakika).padStart(2, '0')}:00`,
          ilkGiris: `${String(girisSaat).padStart(2, '0')}:${String(girisDakika).padStart(2, '0')}:${String(girisSaniye).padStart(2, '0')}`,
          gecKalmaSuresi: `00:${String(saat * 60 + dakika).padStart(2, '0')}:${String(girisSaniye).padStart(2, '0')}`,
          mazeretNotu: kayit.mazeretNotu || ""
        });
      }
    });

    // Tarihe göre sırala
    results.sort((a, b) => a.tarih.localeCompare(b.tarih));

    setGecKalanlar(results);
    setDataLoading(false);
  };

  // Excel export
  const exportToExcel = () => {
    let csv = "Sıra;Sicil No;Kullanıcı;Tarih;Konum;Plan Saati;İlk Giriş İşlemi;Geç Kalma Süresi;Mazeret Notu\n";
    
    gecKalanlar.forEach((g, index) => {
      const tarihFormatted = new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      csv += `${index + 1};${g.sicilNo || "-"};${g.personelAd};${tarihFormatted};${g.konum};${g.planSaati};${g.ilkGiris};${g.gecKalmaSuresi};${g.mazeretNotu || "-"}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gec-kalanlar-${baslangicTarih}-${bitisTarih}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />

      <div className="md:ml-64 pb-20 md:pb-0">
        <header className="bg-white border-b px-4 md:px-6 py-4 sticky top-0 z-30">
          <h1 className="text-xl font-bold text-gray-800">Geç Kalanlar</h1>
          <p className="text-sm text-gray-500 mt-1">Bu sayfadan, belirlediğiniz parametrelere göre "Geç Kalanlar" raporunu görüntüleyebilirsiniz.</p>
        </header>

        <main className="p-4 md:p-6">
          {/* Filtreler */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Başlangıç tarihi</label>
                <input
                  type="date"
                  value={baslangicTarih}
                  onChange={(e) => setBaslangicTarih(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Bitiş tarihi</label>
                <input
                  type="date"
                  value={bitisTarih}
                  onChange={(e) => setBitisTarih(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Konum seçiniz</label>
                <select
                  value={seciliKonum}
                  onChange={(e) => setSeciliKonum(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="Tümü">Tümü</option>
                  {konumlar.map(k => (
                    <option key={k.id} value={k.ad}>{k.ad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Geç kalma toleransı (dk)</label>
                <input
                  type="number"
                  value={gecKalmaToleransi}
                  onChange={(e) => setGecKalmaToleransi(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                  min={0}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={fetchRecords}
                  disabled={dataLoading}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                >
                  {dataLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>🔍 Sonuçları Getir</>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Uyarı Mesajı */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-800">
              <span className="font-medium">ℹ️ Tüm raporlar</span>, sistemimizi kullanan firmaların tamamının ortak ve genel ihtiyaçlarına yönelik hazırlanmakta ve sonuç vermektedir. İlgili verilerin doğruluğunu, en az bir defa olmak kaydıyla mali müşaviriniz ile değerlendirerek kullanmanızı öneririz.
            </p>
          </div>

          {/* Tablo */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sicil No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kullanıcı</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konum</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan Saati</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlk Giriş İşlemi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Geç Kalma Süresi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mazeret Notu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gecKalanlar.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        Sonuçları görmek için 'Sonuçları Getir' butonuna tıklayın
                      </td>
                    </tr>
                  ) : (
                    gecKalanlar.map((g, index) => (
                      <tr key={`${g.personelId}-${g.tarih}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.sicilNo || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{g.personelAd}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.konum}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.planSaati}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{g.ilkGiris}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-bold">{g.gecKalmaSuresi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.mazeretNotu || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alt Butonlar */}
          {gecKalanlar.length > 0 && (
            <div className="flex flex-col md:flex-row gap-3 justify-center mt-6">
              <button
                onClick={() => window.print()}
                className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-6 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                🖨️ Yazdır veya PDF kaydet
              </button>
              <button
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition flex items-center justify-center gap-2"
              >
                📊 Raporu kopyala ve Excel (.xlsx) kaydet
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}