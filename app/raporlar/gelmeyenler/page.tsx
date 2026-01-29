"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, onSnapshot, orderBy, where, Timestamp, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";
import { resmiTatiller } from "../../lib/data";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  sicilNo?: string;
  calismaSaati?: string;
  aktif: boolean;
}

interface GelmeyenKayit {
  personelId: string;
  personelAd: string;
  sicilNo: string;
  calismaSaati: string;
  planSaati: string;
  tarih: string;
  tatilVeyaIzin: string;
}

export default function GelmeyenlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [gelmeyenler, setGelmeyenler] = useState<GelmeyenKayit[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const router = useRouter();

  // Filtreler
  const [baslangicTarih, setBaslangicTarih] = useState(new Date().toISOString().split('T')[0]);
  const [bitisTarih, setBitisTarih] = useState(new Date().toISOString().split('T')[0]);
  const [tatilGoster, setTatilGoster] = useState("Göster");

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
        calismaSaati: doc.data().calismaSaati || "her gün 9:00-18:00",
        aktif: doc.data().aktif !== false
      }));
      setPersoneller(data.filter(p => p.aktif));
    });
    return () => unsubscribe();
  }, [user]);

  // Resmi tatil kontrolü
  const isResmiTatil = (tarih: string): string | null => {
    for (const tatil of resmiTatiller) {
      const tatilTarih = new Date(tatil.tarih);
      for (let i = 0; i < tatil.sure; i++) {
        const gun = new Date(tatilTarih);
        gun.setDate(tatilTarih.getDate() + i);
        if (gun.toISOString().split('T')[0] === tarih) {
          return tatil.isim;
        }
      }
    }
    return null;
  };

  // Hafta tatili kontrolü
  const isHaftaTatili = (tarih: string): boolean => {
    const gun = new Date(tarih).getDay();
    return gun === 0 || gun === 6;
  };

  // Verileri getir
  const fetchRecords = async () => {
    if (!user) return;
    setDataLoading(true);

    const baslangic = new Date(baslangicTarih);
    baslangic.setHours(0, 0, 0, 0);
    const bitis = new Date(bitisTarih);
    bitis.setHours(23, 59, 59, 999);

    // Giriş yapan personelleri çek
    const q = query(
      collection(db, "attendance"),
      where("tarih", ">=", Timestamp.fromDate(baslangic)),
      where("tarih", "<=", Timestamp.fromDate(bitis)),
      where("tip", "==", "giris")
    );

    const snapshot = await getDocs(q);
    
    // Personel-gün bazında giriş yapanları kaydet
    const girisYapanlar = new Set<string>();
    snapshot.forEach(doc => {
      const d = doc.data();
      const tarih = d.tarih?.toDate?.();
      if (tarih) {
        const gunStr = tarih.toISOString().split('T')[0];
        girisYapanlar.add(`${d.personelId}-${gunStr}`);
      }
    });

    // İzinleri çek
    const izinSnapshot = await getDocs(collection(db, "izinler"));
    const izinMap = new Map<string, string>();
    
    izinSnapshot.forEach(doc => {
      const d = doc.data();
      if (d.durum === "onaylandi" || d.onayDurumu === "onaylandi") {
        const start = new Date(d.baslangicTarihi || d.baslangic);
        const end = new Date(d.bitisTarihi || d.bitis);
        
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
          const dateStr = date.toISOString().split('T')[0];
          izinMap.set(`${d.personelId}-${dateStr}`, d.izinTuru || d.tur || "Yıllık İzin");
        }
      }
    });

    // Gelmeyen personelleri bul
    const results: GelmeyenKayit[] = [];
    
    for (let date = new Date(baslangic); date <= bitis; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      
      for (const personel of personeller) {
        const key = `${personel.id}-${dateStr}`;
        
        // Giriş yapmadıysa
        if (!girisYapanlar.has(key)) {
          let tatilVeyaIzin = "";
          
          // Hafta tatili mi?
          if (isHaftaTatili(dateStr)) {
            tatilVeyaIzin = "Hafta Tatili";
          }
          // Resmi tatil mi?
          const resmiTatil = isResmiTatil(dateStr);
          if (resmiTatil) {
            tatilVeyaIzin = resmiTatil;
          }
          // İzinli mi?
          if (izinMap.has(key)) {
            tatilVeyaIzin = izinMap.get(key)!;
          }

          // Tatil/izin filtreleme
          if (tatilGoster === "Gizle" && tatilVeyaIzin) {
            continue;
          }

          // Plan saatini çıkar
          let planSaati = "";
          const match = personel.calismaSaati?.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          if (match) {
            planSaati = `${match[1]} - ${match[2]}`;
          }

          results.push({
            personelId: personel.id,
            personelAd: `${personel.ad} ${personel.soyad}`.trim(),
            sicilNo: personel.sicilNo || "",
            calismaSaati: personel.calismaSaati || "serbest",
            planSaati,
            tarih: dateStr,
            tatilVeyaIzin
          });
        }
      }
    }

    // Tarihe göre sırala
    results.sort((a, b) => b.tarih.localeCompare(a.tarih));

    setGelmeyenler(results);
    setDataLoading(false);
  };

  // Excel export
  const exportToExcel = () => {
    let csv = "Sıra;Sicil No;Kullanıcı;Çalışma Saati;Plan Saati;Tarih;Tatil veya İzinler\n";
    
    gelmeyenler.forEach((g, index) => {
      const tarihFormatted = new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      csv += `${index + 1};${g.sicilNo || "-"};${g.personelAd};${g.calismaSaati};${g.planSaati || "-"};${tarihFormatted};${g.tatilVeyaIzin || "-"}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gelmeyenler-${baslangicTarih}-${bitisTarih}.csv`;
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
          <h1 className="text-xl font-bold text-gray-800">Gelmeyenler</h1>
          <p className="text-sm text-gray-500 mt-1">Bu sayfadan, belirlediğiniz parametrelere göre "Gelmeyenler" raporunu görüntüleyebilirsiniz.</p>
        </header>

        <main className="p-4 md:p-6">
          {/* Filtreler */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <label className="block text-xs text-gray-500 mb-1">Tatil veya İzinli günler</label>
                <select
                  value={tatilGoster}
                  onChange={(e) => setTatilGoster(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="Göster">Göster</option>
                  <option value="Gizle">Gizle</option>
                </select>
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
              <span className="font-medium">ℹ️ Tüm raporlar</span>, sistemimizi kullanan firmaların tamamının ortak ve genel ihtiyaçlarına yönelik hazırlanmakta ve sonuç vermektedir.
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Çalışma Saati</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan Saati</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tatil veya İzinler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {gelmeyenler.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        Sonuçları görmek için 'Sonuçları Getir' butonuna tıklayın
                      </td>
                    </tr>
                  ) : (
                    gelmeyenler.map((g, index) => (
                      <tr key={`${g.personelId}-${g.tarih}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.sicilNo || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{g.personelAd}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.calismaSaati}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{g.planSaati || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(g.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                        </td>
                        <td className="px-4 py-3">
                          {g.tatilVeyaIzin ? (
                            <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                              g.tatilVeyaIzin === "Hafta Tatili" ? "bg-blue-100 text-blue-700" :
                              g.tatilVeyaIzin.includes("İzin") ? "bg-orange-100 text-orange-700" :
                              "bg-purple-100 text-purple-700"
                            }`}>
                              {g.tatilVeyaIzin}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alt Butonlar */}
          {gelmeyenler.length > 0 && (
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

          {/* Notlar */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p className="font-medium mb-2">Notlar:</p>
            <p>Seçilen günlerde hiçbir <u>Giriş İşlemi olmayanlar</u> listelenmektedir.</p>
          </div>
        </main>
      </div>
    </div>
  );
}