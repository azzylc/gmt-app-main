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
  setDoc
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

const API_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";
const CACHE_KEY = "gmt_gelinler_cache";

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

  // Cache'den gelinleri yükle
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setGelinler(JSON.parse(cached));
      }
    } catch (e) {}
    
    // API'den taze veri çek
    fetchGelinler();
  }, []);

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

  const fetchGelinler = async () => {
    try {
      const response = await fetch(`${API_URL}?action=gelinler`);
      const data = await response.json();
      setGelinler(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
  };

  // Hedef kaydet
  const handleHedefKaydet = async () => {
    if (!selectedAy || !hedefInput) {
      alert("Lütfen ay ve hedef girin!");
      return;
    }
    
    setSaving(true);
    try {
      await setDoc(doc(db, "monthlyTargets", selectedAy), {
        hedef: parseInt(hedefInput),
        guncellenmeTarihi: new Date().toISOString(),
        guncelleyenEmail: user?.email
      });
      setSelectedAy("");
      setHedefInput("");
      alert("Hedef kaydedildi!");
    } catch (error) {
      console.error("Hedef kaydetme hatası:", error);
      alert("Hedef kaydedilemedi!");
    }
    setSaving(false);
  };

  // Ay bazlı hesaplamalar (randevu tarihine göre)
  const getAyVerileri = (ayStr: string) => {
    const ayGelinler = gelinler.filter(g => g.tarih.startsWith(ayStr));
    const toplamGelin = ayGelinler.length;
    const toplamUcret = ayGelinler.reduce((sum, g) => sum + (g.ucret > 0 ? g.ucret : 0), 0);
    const toplamKapora = ayGelinler.reduce((sum, g) => sum + (g.kapora > 0 ? g.kapora : 0), 0);
    const toplamKalan = ayGelinler.reduce((sum, g) => sum + (g.kalan > 0 ? g.kalan : 0), 0);
    const hedef = hedefler.find(h => h.ay === ayStr)?.hedef || 0;
    
    return { toplamGelin, toplamUcret, toplamKapora, toplamKalan, hedef };
  };

  // Bu ay anlaşılan gelinlerin kaporası (anlaşma tarihi ayın 1'i ile bugün arasında)
  const buAyAnlasanKapora = gelinler
    .filter(g => {
      if (!g.anlasildigiTarih) return false;
      const anlasmaTarihi = g.anlasildigiTarih.slice(0, 10); // "2026-01-15"
      const ayBasi = buAy + "-01";
      return anlasmaTarihi >= ayBasi && anlasmaTarihi <= bugun;
    })
    .reduce((sum, g) => sum + (g.kapora > 0 ? g.kapora : 0), 0);

  // Bugün ve sonrası için kalan bakiye (bu ay içinde, bugün dahil)
  const buAyKalanBakiye = gelinler
    .filter(g => g.tarih.startsWith(buAy) && g.tarih >= bugun)
    .reduce((sum, g) => sum + (g.kalan > 0 ? g.kalan : 0), 0);

  // Bugün ödeme bekleyenler
  const bugunGelinler = gelinler.filter(g => g.tarih === bugun);
  const bugunOdemeBekleyen = bugunGelinler.filter(g => g.kalan > 0);

  // Bu ayın verileri
  const buAyVerileri = getAyVerileri(buAy);

  // Yıl listesi: geçmiş 5 + şimdiki + önümüzdeki 5 = 11 yıl
  const yilListesi = Array.from({ length: 11 }, (_, i) => {
    return new Date().getFullYear() - 5 + i;
  });

  // Seçilen yılın 12 ayı (hedef belirleme için)
  const ayListesi = Array.from({ length: 12 }, (_, i) => {
    return `${selectedYil}-${String(i + 1).padStart(2, '0')}`;
  });

  // Bugünden itibaren önümüzdeki 12 ay + geçmişten 6 ay (scroll için)
  const tumAylar = Array.from({ length: 18 }, (_, i) => {
    const d = new Date();
    d.setDate(1); // Ayın 1'ine set et
    d.setMonth(d.getMonth() - 6 + i); // 6 ay geriden başla, 12 ay ileriye git
    return d.toISOString().slice(0, 7);
  });

  const ayIsimleri: Record<string, string> = {
    "01": "Ocak", "02": "Şubat", "03": "Mart", "04": "Nisan",
    "05": "Mayıs", "06": "Haziran", "07": "Temmuz", "08": "Ağustos",
    "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık"
  };

  const formatAy = (ayStr: string) => {
    const [yil, ay] = ayStr.split("-");
    return `${ayIsimleri[ay]} ${yil}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (yetkisiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <span className="text-6xl">🚫</span>
          <h1 className="text-2xl font-bold text-gray-800 mt-4">Yetkisiz Erişim</h1>
          <p className="text-gray-500 mt-2">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <button 
            onClick={() => router.push("/")}
            className="mt-4 bg-pink-500 text-white px-6 py-2 rounded-xl hover:bg-pink-600 transition"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />
      
      <div className="md:ml-64 pb-20 md:pb-0">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">👑 Yönetim Paneli</h1>
              <p className="text-sm text-gray-500">Finansal özet ve hedef yönetimi</p>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Üst Kartlar */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Bu Ay Gelin</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">
                {buAyVerileri.toplamGelin}
                {buAyVerileri.hedef > 0 && (
                  <span className="text-sm text-gray-400 font-normal">/{buAyVerileri.hedef}</span>
                )}
              </p>
              {buAyVerileri.hedef > 0 && (
                <div className="mt-2">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-pink-500 rounded-full transition-all"
                      style={{ width: `${Math.min((buAyVerileri.toplamGelin / buAyVerileri.hedef) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    %{Math.round((buAyVerileri.toplamGelin / buAyVerileri.hedef) * 100)} tamamlandı
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Bu Ayın Cirosu</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {buAyVerileri.toplamUcret.toLocaleString('tr-TR')} ₺
              </p>
              <p className="text-xs text-gray-400 mt-1">Anlaşılan ücret</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Bu Ay Kapora</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {buAyAnlasanKapora.toLocaleString('tr-TR')} ₺
              </p>
              <p className="text-xs text-gray-400 mt-1">Anlaşan gelinlerden</p>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Bu Ay Kalan Bakiye</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {buAyKalanBakiye.toLocaleString('tr-TR')} ₺
              </p>
              <p className="text-xs text-gray-400 mt-1">Bugün ve sonrası</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Sol: Hedef Belirleme */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span>🎯</span> Aylık Hedef Belirleme
                </h2>
                <select
                  value={selectedYil}
                  onChange={(e) => setSelectedYil(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  {yilListesi.map(yil => (
                    <option key={yil} value={yil}>
                      {yil}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {ayListesi.map(ay => {
                  const mevcutHedef = hedefler.find(h => h.ay === ay)?.hedef || 0;
                  const ayVerileri = getAyVerileri(ay);
                  const yuzde = mevcutHedef > 0 ? Math.round((ayVerileri.toplamGelin / mevcutHedef) * 100) : 0;
                  const isEditing = selectedAy === ay;
                  
                  return (
                    <div key={ay} className={`p-3 rounded-xl transition ${isEditing ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-gray-50 hover:bg-gray-100'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-700 min-w-[100px]">{formatAy(ay)}</span>
                        
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="number"
                              value={hedefInput}
                              onChange={(e) => setHedefInput(e.target.value)}
                              placeholder="Hedef"
                              className="w-20 px-3 py-1.5 border border-pink-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 text-center text-sm"
                              autoFocus
                            />
                            <button
                              onClick={handleHedefKaydet}
                              disabled={saving}
                              className="bg-pink-500 hover:bg-pink-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                            >
                              {saving ? "..." : "✓"}
                            </button>
                            <button
                              onClick={() => { setSelectedAy(""); setHedefInput(""); }}
                              className="text-gray-400 hover:text-gray-600 px-2 py-1.5 text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 flex-1">
                            {mevcutHedef > 0 ? (
                              <>
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${yuzde >= 100 ? 'bg-green-500' : 'bg-pink-500'}`}
                                    style={{ width: `${Math.min(yuzde, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-sm font-bold min-w-[60px] text-right ${yuzde >= 100 ? 'text-green-600' : 'text-gray-600'}`}>
                                  {ayVerileri.toplamGelin}/{mevcutHedef}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400 text-sm flex-1">Hedef yok</span>
                            )}
                            <button
                              onClick={() => { setSelectedAy(ay); setHedefInput(mevcutHedef > 0 ? mevcutHedef.toString() : ""); }}
                              className="text-pink-500 hover:text-pink-600 text-sm font-medium px-2"
                            >
                              {mevcutHedef > 0 ? "Düzenle" : "Ekle"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sağ: Bugün Ödeme Bekleyen */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💰</span> Bugün Ödeme Bekleyen
                {bugunOdemeBekleyen.length > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {bugunOdemeBekleyen.length}
                  </span>
                )}
              </h2>

              {bugunOdemeBekleyen.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <span className="text-4xl">✅</span>
                  <p className="mt-2">Bugün ödeme bekleyen yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bugunOdemeBekleyen.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                      <div>
                        <p className="font-medium text-gray-800">{g.isim}</p>
                        <p className="text-xs text-gray-500">{g.saat}</p>
                      </div>
                      <span className="text-lg font-bold text-red-600">
                        {g.kalan.toLocaleString('tr-TR')} ₺
                      </span>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-600">Toplam</span>
                      <span className="text-xl font-bold text-red-600">
                        {bugunOdemeBekleyen.reduce((sum, g) => sum + g.kalan, 0).toLocaleString('tr-TR')} ₺
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Aylık Özet Tablosu */}
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>📊</span> Aylık Finansal Özet
            </h2>
            
            {/* Header - SCROLL DIŞINDA */}
            <div className="flex bg-gray-50 pl-6 pr-3 py-3 border-b border-gray-200 rounded-t-lg mb-0">
              <div className="w-[15%] text-left text-xs font-medium text-gray-500 uppercase">Ay</div>
              <div className="w-[10%] text-center text-xs font-medium text-gray-500 uppercase">Gelin</div>
              <div className="w-[15%] text-center text-xs font-medium text-gray-500 uppercase">Hedef</div>
              <div className="w-[20%] text-right text-xs font-medium text-gray-500 uppercase">Toplam Ücret</div>
              <div className="w-[20%] text-right text-xs font-medium text-gray-500 uppercase">Kapora</div>
              <div className="w-[20%] text-right text-xs font-medium text-gray-500 uppercase">Kalan</div>
            </div>

            {/* Body - SADECE BU KISIM SCROLL */}
            <div className="max-h-[600px] overflow-y-scroll divide-y divide-gray-200">
              {tumAylar.map(ay => {
                const veri = getAyVerileri(ay);
                const isBuAy = ay === buAy;
                return (
                  <div
                    key={ay}
                    ref={isBuAy ? bugunAyRef : null}
                    className={`flex px-6 py-3 ${isBuAy ? 'bg-pink-50' : 'hover:bg-gray-50'}`}
                  >
                    {/* Ay */}
                    <div className="w-[15%] text-left">
                      <span className={`font-medium ${isBuAy ? 'text-pink-600' : 'text-gray-700'}`}>
                        {formatAy(ay)}
                      </span>
                    </div>
                    
                    {/* Gelin */}
                    <div className="w-[10%] text-center">
                      <span className={`font-bold ${isBuAy ? 'text-pink-600' : 'text-gray-800'}`}>
                        {veri.toplamGelin}
                      </span>
                    </div>
                    
                    {/* Hedef */}
                    <div className="w-[15%] text-center">
                      {veri.hedef > 0 ? (
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-gray-600">{veri.hedef}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                            veri.toplamGelin >= veri.hedef 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            %{Math.round((veri.toplamGelin / veri.hedef) * 100)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                    
                    {/* Toplam Ücret */}
                    <div className="w-[20%] text-right font-medium text-gray-800">
                      {veri.toplamUcret.toLocaleString('tr-TR')} ₺
                    </div>
                    
                    {/* Kapora */}
                    <div className="w-[20%] text-right font-medium text-green-600">
                      {veri.toplamKapora.toLocaleString('tr-TR')} ₺
                    </div>
                    
                    {/* Kalan */}
                    <div className="w-[20%] text-right font-medium text-red-600">
                      {veri.toplamKalan.toLocaleString('tr-TR')} ₺
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sosyal Medya Bölümü */}
          <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span>📱</span> Sosyal Medya
            </h2>

            {/* Haftalık Program */}
            <div className="mb-8">
              <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>📅</span> Haftalık Program
              </h3>
              <div className="grid grid-cols-7 gap-3">
                {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((gun, idx) => (
                  <div key={gun} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition">
                    <p className="font-medium text-gray-700 text-sm mb-2">{gun}</p>
                    <div className="space-y-2">
                      <div className="text-xs text-gray-500 bg-white rounded p-2 border border-gray-200">
                        <p className="font-medium text-gray-600">Instagram</p>
                        <p className="text-gray-400">Post zamanı</p>
                      </div>
                      <div className="text-xs text-gray-500 bg-white rounded p-2 border border-gray-200">
                        <p className="font-medium text-gray-600">TikTok</p>
                        <p className="text-gray-400">Video paylaşımı</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Referanslar */}
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span>⭐</span> Referanslar
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-5 border border-pink-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">📸</span>
                    <span className="text-xs text-gray-500">Bu Ay</span>
                  </div>
                  <p className="text-3xl font-bold text-pink-600">0</p>
                  <p className="text-sm text-gray-600 mt-1">Instagram'dan Gelen</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">🎵</span>
                    <span className="text-xs text-gray-500">Bu Ay</span>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">0</p>
                  <p className="text-sm text-gray-600 mt-1">TikTok'tan Gelen</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">👥</span>
                    <span className="text-xs text-gray-500">Bu Ay</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600">0</p>
                  <p className="text-sm text-gray-600 mt-1">Tavsiye ile Gelen</p>
                </div>
              </div>

              <div className="mt-4 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-700">Toplam Referans Gelini</span>
                  <span className="text-2xl font-bold text-purple-600">0</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}