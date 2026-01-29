"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, onSnapshot, orderBy, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "../../components/Sidebar";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  sicilNo?: string;
}

interface CalismaSuresi {
  personelId: string;
  personelAd: string;
  sicilNo: string;
  tarih: string;
  ilkGiris: string;
  sonCikis: string;
  calismaSuresi: string;
}

export default function GunlukCalismaSureleriPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [calismalar, setCalismalar] = useState<CalismaSuresi[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const router = useRouter();

  // Filtreler
  const [baslangicTarih, setBaslangicTarih] = useState(new Date().toISOString().split('T')[0]);
  const [bitisTarih, setBitisTarih] = useState(new Date().toISOString().split('T')[0]);
  const [seciliKullanici, setSeciliKullanici] = useState("Tümü");
  const [molaSuresi, setMolaSuresi] = useState(0);

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
        sicilNo: doc.data().sicilNo || ""
      }));
      setPersoneller(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Verileri getir ve hesapla
  const fetchRecords = async () => {
    if (!user) return;
    setDataLoading(true);

    const baslangic = new Date(baslangicTarih);
    baslangic.setHours(0, 0, 0, 0);
    const bitis = new Date(bitisTarih);
    bitis.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "attendance"),
      where("tarih", ">=", Timestamp.fromDate(baslangic)),
      where("tarih", "<=", Timestamp.fromDate(bitis)),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Personel ve güne göre grupla
      const grouped = new Map<string, any[]>();

      snapshot.forEach((doc) => {
        const d = doc.data();
        const tarih = d.tarih?.toDate?.();
        if (!tarih) return;

        const gunStr = tarih.toISOString().split('T')[0];
        const key = `${d.personelId}-${gunStr}`;

        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push({ ...d, tarihDate: tarih });
      });

      // Her grup için çalışma süresini hesapla
      const results: CalismaSuresi[] = [];

      grouped.forEach((records, key) => {
        const [personelId, tarihStr] = key.split('-');
        const personel = personeller.find(p => p.id === personelId);
        
        // Giriş ve çıkışları ayır
        const girisler = records.filter(r => r.tip === "giris").sort((a, b) => a.tarihDate - b.tarihDate);
        const cikislar = records.filter(r => r.tip === "cikis").sort((a, b) => a.tarihDate - b.tarihDate);

        if (girisler.length === 0) return;

        const ilkGiris = girisler[0].tarihDate;
        const sonCikis = cikislar.length > 0 ? cikislar[cikislar.length - 1].tarihDate : null;

        // Çalışma süresini hesapla
        let calismaDakika = 0;
        if (sonCikis) {
          calismaDakika = Math.floor((sonCikis - ilkGiris) / (1000 * 60)) - molaSuresi;
          if (calismaDakika < 0) calismaDakika = 0;
        }

        const saat = Math.floor(calismaDakika / 60);
        const dakika = calismaDakika % 60;
        const saniye = sonCikis ? Math.floor(((sonCikis - ilkGiris) / 1000) % 60) : 0;

        results.push({
          personelId,
          personelAd: records[0].personelAd || `${personel?.ad || ""} ${personel?.soyad || ""}`.trim(),
          sicilNo: personel?.sicilNo || "",
          tarih: tarihStr,
          ilkGiris: ilkGiris.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          sonCikis: sonCikis ? sonCikis.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "-",
          calismaSuresi: sonCikis ? `${String(saat).padStart(2, '0')}:${String(dakika).padStart(2, '0')}:${String(saniye).padStart(2, '0')}` : "-"
        });
      });

      // Filtrele
      let filtered = results;
      if (seciliKullanici !== "Tümü") {
        filtered = results.filter(r => r.personelAd === seciliKullanici);
      }

      // Tarihe göre sırala (yeniden eskiye)
      filtered.sort((a, b) => b.tarih.localeCompare(a.tarih));

      setCalismalar(filtered);
      setDataLoading(false);
    });
  };

  // Excel export
  const exportToExcel = () => {
    let csv = "Sıra;Sicil No;Kullanıcı;Tarih;İlk Giriş İşlemi;Son Çıkış İşlemi;Çalışma Süresi\n";
    
    calismalar.forEach((c, index) => {
      const tarihFormatted = new Date(c.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
      csv += `${index + 1};${c.sicilNo || "-"};${c.personelAd};${tarihFormatted};${c.ilkGiris};${c.sonCikis};${c.calismaSuresi}\n`;
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gunluk-calisma-sureleri-${baslangicTarih}-${bitisTarih}.csv`;
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
          <h1 className="text-xl font-bold text-gray-800">Günlük Çalışma Süreleri</h1>
          <p className="text-sm text-gray-500 mt-1">Bu sayfada, belirlediğiniz parametre ve filtrelere göre "Günlük Çalışma Süreleri" raporunu görüntüleyebilirsiniz.</p>
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
                <label className="block text-xs text-gray-500 mb-1">Kullanıcı seçiniz</label>
                <select
                  value={seciliKullanici}
                  onChange={(e) => setSeciliKullanici(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="Tümü">Tümü</option>
                  {personeller.map(p => (
                    <option key={p.id} value={`${p.ad} ${p.soyad}`.trim()}>{p.ad} {p.soyad}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Yemek + Mola süresi (dk)</label>
                <input
                  type="number"
                  value={molaSuresi}
                  onChange={(e) => setMolaSuresi(parseInt(e.target.value) || 0)}
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
              <span className="font-medium">ℹ️ Sadece gün içindeki</span> <u>İlk Giriş</u> ve <u>Son Çıkış</u> işlemleri hesaba katılmaktadır. Gün içindeki diğer işlemler hesaplamalarda dikkate alınmamaktadır.
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlk Giriş İşlemi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Son Çıkış İşlemi</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Çalışma Süresi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {calismalar.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                        Sonuçları görmek için 'Sonuçları Getir' butonuna tıklayın
                      </td>
                    </tr>
                  ) : (
                    calismalar.map((c, index) => (
                      <tr key={`${c.personelId}-${c.tarih}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.sicilNo || "-"}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.personelAd}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(c.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-600 font-medium">{c.ilkGiris}</td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">{c.sonCikis}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-800">{c.calismaSuresi}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alt Butonlar */}
          {calismalar.length > 0 && (
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
            <p>Sadece gün içindeki <u>İlk Giriş</u> ve <u>Son Çıkış</u> işlemleri hesaba katılmaktadır.</p>
          </div>
        </main>
      </div>
    </div>
  );
}