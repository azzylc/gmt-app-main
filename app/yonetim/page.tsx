"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc,
  setDoc,
  orderBy
} from "firebase/firestore";

interface Gelin {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  ucret: number;
  kapora: number;
  kalan: number;
  makyaj: string;
  turban: string;
  anlasildigiTarih: string; // "2026-01-15T14:30:00" formatında
}

interface HedefAy {
  ay: string;
  hedef: number;
}

export default function YonetimPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [yetkisiz, setYetkisiz] = useState(false);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [hedefler, setHedefler] = useState<HedefAy[]>([]);
  const [selectedAy, setSelectedAy] = useState("");
  const [hedefInput, setHedefInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedYil, setSelectedYil] = useState(new Date().getFullYear()); // Yıl seçici
  const router = useRouter();
  
  // Bugünkü ay satırı için ref
  const bugunAyRef = useRef<HTMLTableRowElement>(null);
  
  // Scroll sadece bir kez olsun diye flag
  const hasScrolled = useRef(false);

  const bugun = new Date().toISOString().split('T')[0];
  const buAy = new Date().toISOString().slice(0, 7);

  // Auth kontrolü
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        // Kullanıcı grup kontrolü
        const q = query(
          collection(db, "personnel"),
          where("email", "==", user.email)
        );
        const unsubPersonel = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            const gruplar = data.grupEtiketleri || [];
            const isKurucu = gruplar.some((g: string) => g.toLowerCase() === "kurucu");
            if (!isKurucu) {
              setYetkisiz(true);
            }
          } else {
            setYetkisiz(true);
          }
          setLoading(false);
        });
        return () => unsubPersonel();
      } else {
        router.push("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ✅ Gelinler - Firestore'dan (real-time) - 2025+ filtreli
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Firestore gelinler listener başlatılıyor (Yönetim, 2025+)...');
    
    const q = query(
      collection(db, "gelinler"),
      where("tarih", ">=", "2025-01-01"),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        isim: doc.data().isim || "",
        tarih: doc.data().tarih || "",
        saat: doc.data().saat || "",
        ucret: doc.data().ucret || 0,
        kapora: doc.data().kapora || 0,
        kalan: doc.data().kalan || 0,
        makyaj: doc.data().makyaj || "",
        turban: doc.data().turban || "",
        anlasildigiTarih: doc.data().anlasildigiTarih || "",
      } as Gelin));

      console.log(`✅ ${data.length} gelin Firestore'dan yüklendi (Yönetim 2025+)`);
      setGelinler(data);
    }, (error) => {
      console.error('❌ Firestore listener hatası (Yönetim):', error);
    });

    return () => unsubscribe();
  }, [user]);

  // Hedefleri Firebase'den çek
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "monthlyTargets"), (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        ay: docSnap.id,
        hedef: docSnap.data().hedef
      } as HedefAy));
      // Client-side sıralama (yeniden eskiye)
      data.sort((a, b) => b.ay.localeCompare(a.ay));
      setHedefler(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Sayfa yüklendiğinde bugünkü aya scroll yap (SADECE BİR KEZ)
  useEffect(() => {
    if (!loading && bugunAyRef.current && !hasScrolled.current) {
      // Kısa bir gecikme ile scroll yap (DOM render olsun diye)
      setTimeout(() => {
        if (bugunAyRef.current) {
          bugunAyRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
          hasScrolled.current = true; // Flag'i set et
        }
      }, 300);
    }
  }, [loading]);

  // Hedef kaydet
  const handleHedefKaydet = async () => {
    if (!selectedAy || !hedefInput) {
      alert("Lütfen ay ve hedef girin!");
      return;
    }
    
    setSaving(true);
    try {
      const hedefRef = doc(db, "monthlyTargets", selectedAy);
      await setDoc(hedefRef, {
        hedef: parseInt(hedefInput)
      });
      setSelectedAy("");
      setHedefInput("");
      alert("✅ Hedef kaydedildi!");
    } catch (error) {
      console.error("Hedef kaydetme hatası:", error);
      alert("❌ Hedef kaydedilemedi!");
    }
    setSaving(false);
  };

  // Aylık istatistikleri hesapla
  const getMonthStats = (ayStr: string) => {
    const ayGelinler = gelinler.filter(g => g.tarih.startsWith(ayStr));
    
    // Bu ay içinde anlaşılan gelinler
    const anlasanlar = ayGelinler.filter(g => {
      if (!g.anlasildigiTarih) return false;
      const anlasmaTarih = g.anlasildigiTarih.slice(0, 7);
      return anlasmaTarih === ayStr;
    });
    
    const toplamKalan = ayGelinler.reduce((sum, g) => sum + (g.kalan > 0 ? g.kalan : 0), 0);
    const hedef = hedefler.find(h => h.ay === ayStr)?.hedef || 0;
    
    return {
      toplam: ayGelinler.length,
      anlasan: anlasanlar.length,
      toplamKalan,
      hedef,
      hedefYuzde: hedef > 0 ? Math.round((anlasanlar.length / hedef) * 100) : 0
    };
  };

  // Yıla göre ayları filtrele (12 ay - Ocak'tan Aralık'a)
  const aylar = Array.from({ length: 12 }, (_, i) => {
    const ay = String(i + 1).padStart(2, '0');
    return `${selectedYil}-${ay}`;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (yetkisiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">Yetkisiz Erişim</h1>
          <p className="text-stone-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <Sidebar user={user} />
      
      <div className="md:ml-56 pb-20 md:pb-0">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800">📊 Yönetim Paneli</h1>
              <p className="text-sm text-stone-500">Aylık hedefler ve performans takibi (Firestore Real-time)</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedYil}
                onChange={(e) => setSelectedYil(parseInt(e.target.value))}
                className="px-4 py-2 border border-stone-300 rounded-lg text-sm font-medium"
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Hedef Belirleme Formu */}
          <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-6 mb-6">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">📅 Aylık Hedef Belirle</h2>
            <div className="flex gap-4">
              <input
                type="month"
                value={selectedAy}
                onChange={(e) => setSelectedAy(e.target.value)}
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg"
              />
              <input
                type="number"
                value={hedefInput}
                onChange={(e) => setHedefInput(e.target.value)}
                placeholder="Hedef anlaşma sayısı"
                className="flex-1 px-4 py-2 border border-stone-300 rounded-lg"
              />
              <button
                onClick={handleHedefKaydet}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </div>

          {/* Aylık Performans Tablosu */}
          <div className="bg-white rounded-lg shadow-sm border border-stone-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100">
              <h2 className="text-lg font-semibold text-stone-800">📈 Aylık Performans ({selectedYil})</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Ay</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Toplam Gelin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Bu Ay Anlaşan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Hedef</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Hedef %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">Kalan Bakiye</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-200">
                  {aylar.map(ay => {
                    const stats = getMonthStats(ay);
                    const isBuAy = ay === buAy;
                    
                    return (
                      <tr 
                        key={ay}
                        ref={isBuAy ? bugunAyRef : null}
                        className={`hover:bg-stone-50 ${isBuAy ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`font-medium ${isBuAy ? 'text-blue-600' : 'text-stone-900'}`}>
                            {new Date(ay + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}
                            {isBuAy && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Bu Ay</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-stone-900">{stats.toplam}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-green-600">{stats.anlasan}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-stone-900">{stats.hedef || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {stats.hedef > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-stone-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className={`h-2 rounded-full ${
                                    stats.hedefYuzde >= 100 ? 'bg-green-500' :
                                    stats.hedefYuzde >= 75 ? 'bg-blue-500' :
                                    stats.hedefYuzde >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(stats.hedefYuzde, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-stone-700">{stats.hedefYuzde}%</span>
                            </div>
                          ) : (
                            <span className="text-sm text-stone-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-amber-600">
                            {stats.toplamKalan.toLocaleString('tr-TR')} ₺
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}