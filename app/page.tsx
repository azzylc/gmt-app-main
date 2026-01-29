"use client";
import { useEffect, useState } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, updateDoc, increment, orderBy, limit } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import { personelListesi, getPersonelByIsim, getYaklasanDogumGunleri, getIzinliler, getIzinlerAralik, getYaklasanTatiller } from "./lib/data";

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
  kinaGunu?: string;
  telefon?: string;
  esiTelefon?: string;
  instagram?: string;
  fotografci?: string;
  modaevi?: string;
  anlasildigiTarih?: string;
  bilgilendirmeGonderildi?: boolean;
  ucretYazildi?: boolean;
  malzemeListesiGonderildi?: boolean;
  paylasimIzni?: boolean;
  yorumIstesinMi?: boolean;
  yorumIstendiMi?: boolean;
  gelinNotu?: string;
  dekontGorseli?: string;
}

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  iseBaslama?: string;
  yillikIzinHakki?: number;
  kullaniciTuru?: string;
  aktif: boolean;
}

interface EksikIzin {
  personel: Personel;
  calismaYili: number;
  olmasiGereken: number;
  mevcut: number;
  eksik: number;
}

interface Duyuru {
  id: string;
  title: string;
  content: string;
  important: boolean;
  group: string;
  author: string;
  createdAt: any;
}

const API_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";
const CACHE_KEY = "gmt_gelinler_cache";
const CACHE_TIME_KEY = "gmt_gelinler_cache_time";
const CACHE_DURATION = 30 * 60 * 1000;

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [selectedGelin, setSelectedGelin] = useState<Gelin | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();

  // İzin hakkı state'leri
  const [firebasePersoneller, setFirebasePersoneller] = useState<Personel[]>([]);
  const [eksikIzinler, setEksikIzinler] = useState<EksikIzin[]>([]);
  const [izinEkleniyor, setIzinEkleniyor] = useState<string | null>(null);

  // Duyurular state
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);

  // Aylık hedef state
  const [aylikHedef, setAylikHedef] = useState<number>(0);

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cacheTime) {
        setGelinler(JSON.parse(cached));
        setLastUpdate(new Date(parseInt(cacheTime)).toLocaleTimeString('tr-TR'));
        setDataLoading(false);
        return true;
      }
    } catch (e) {}
    return false;
  };

  const saveToCache = (data: Gelin[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
    } catch (e) {}
  };

  const isCacheStale = () => {
    try {
      const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
      if (!cacheTime) return true;
      return Date.now() - parseInt(cacheTime) > CACHE_DURATION;
    } catch (e) { return true; }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        const hasCache = loadFromCache();
        if (!hasCache || isCacheStale()) fetchGelinler();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (user) fetchGelinler();
    }, CACHE_DURATION);
    return () => clearInterval(interval);
  }, [user]);

  const fetchGelinler = async () => {
    try {
      const response = await fetch(`${API_URL}?action=gelinler`);
      const data = await response.json();
      setGelinler(data);
      saveToCache(data);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
    setDataLoading(false);
  };

  // Firebase'den personelleri çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "personnel"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Personel[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.aktif !== false) {
          list.push({
            id: doc.id,
            ad: data.ad || data.isim || "",
            soyad: data.soyad || "",
            iseBaslama: data.iseBaslama || "",
            yillikIzinHakki: data.yillikIzinHakki || 0,
            kullaniciTuru: data.kullaniciTuru || "",
            aktif: true,
          });
        }
      });
      setFirebasePersoneller(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Çalışma yılı hesapla
  const hesaplaCalismaYili = (iseBaslama: string) => {
    if (!iseBaslama) return 0;
    const baslangic = new Date(iseBaslama);
    const bugun = new Date();
    const yil = bugun.getFullYear() - baslangic.getFullYear();
    const ayFarki = bugun.getMonth() - baslangic.getMonth();
    if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < baslangic.getDate())) {
      return yil - 1;
    }
    return yil;
  };

  // Kümülatif izin hakkı hesapla
  const hesaplaIzinHakki = (calismaYili: number) => {
    let toplam = 0;
    for (let yil = 1; yil <= calismaYili; yil++) {
      if (yil <= 5) toplam += 14;
      else if (yil <= 15) toplam += 20;
      else toplam += 26;
    }
    return toplam;
  };

  // Eksik izinleri hesapla
  useEffect(() => {
    const eksikler: EksikIzin[] = [];
    firebasePersoneller.forEach((personel) => {
      if (!personel.iseBaslama) return;
      // Yöneticileri atla
      if (personel.kullaniciTuru === "Yönetici") return;
      const calismaYili = hesaplaCalismaYili(personel.iseBaslama);
      if (calismaYili < 1) return;
      const olmasiGereken = hesaplaIzinHakki(calismaYili);
      const mevcut = personel.yillikIzinHakki || 0;
      const eksik = olmasiGereken - mevcut;
      if (eksik > 0) {
        eksikler.push({ personel, calismaYili, olmasiGereken, mevcut, eksik });
      }
    });
    eksikler.sort((a, b) => b.eksik - a.eksik);
    setEksikIzinler(eksikler);
  }, [firebasePersoneller]);

  // Firebase'den son 3 duyuruyu çek
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "announcements"), 
      orderBy("createdAt", "desc"),
      limit(3)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Duyuru));
      setDuyurular(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Firebase'den bu ayın hedefini çek
  useEffect(() => {
    if (!user) return;
    const buAy = new Date().toISOString().slice(0, 7);
    const unsubscribe = onSnapshot(doc(db, "monthlyTargets", buAy), (docSnap) => {
      if (docSnap.exists()) {
        setAylikHedef(docSnap.data().hedef || 0);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Eksik izin ekle
  const handleIzinEkle = async (eksik: EksikIzin) => {
    setIzinEkleniyor(eksik.personel.id);
    try {
      await addDoc(collection(db, "izinHakDegisiklikleri"), {
        personelId: eksik.personel.id,
        personelAd: eksik.personel.ad,
        personelSoyad: eksik.personel.soyad,
        eklenenGun: eksik.eksik,
        aciklama: `Eksik ${eksik.eksik} gün izin hakkı eklendi. (${eksik.calismaYili}. yıl - Mevcut: ${eksik.mevcut} → Yeni: ${eksik.olmasiGereken})`,
        islemTarihi: new Date().toISOString(),
        islemYapan: user?.email || "",
      });
      const personelRef = doc(db, "personnel", eksik.personel.id);
      await updateDoc(personelRef, {
        yillikIzinHakki: increment(eksik.eksik),
      });
    } catch (error) {
      console.error("Ekleme hatası:", error);
      alert("İşlem başarısız oldu.");
    } finally {
      setIzinEkleniyor(null);
    }
  };

  // Tümüne ekle
  const handleTumIzinleriEkle = async () => {
    if (!window.confirm(`${eksikIzinler.length} personele toplam ${eksikIzinler.reduce((t, e) => t + e.eksik, 0)} gün izin hakkı eklenecek. Onaylıyor musunuz?`)) {
      return;
    }
    for (const eksik of eksikIzinler) {
      await handleIzinEkle(eksik);
    }
  };

  // Tarih hesaplamaları
  const bugun = new Date().toISOString().split('T')[0];
  const bugunDate = new Date();
  
  const haftaBasi = new Date(bugunDate);
  const gun = haftaBasi.getDay();
  const fark = gun === 0 ? -6 : 1 - gun;
  haftaBasi.setDate(haftaBasi.getDate() + fark);
  const haftaSonu = new Date(haftaBasi);
  haftaSonu.setDate(haftaBasi.getDate() + 6);
  const haftaBasiStr = haftaBasi.toISOString().split('T')[0];
  const haftaSonuStr = haftaSonu.toISOString().split('T')[0];
  const buAyStr = bugun.slice(0, 7);

  // Veriler
  const bugunGelinler = gelinler.filter(g => g.tarih === bugun);
  const buHaftaGelinler = gelinler.filter(g => g.tarih >= haftaBasiStr && g.tarih <= haftaSonuStr);
  const buAyGelinler = gelinler.filter(g => g.tarih.startsWith(buAyStr));
  const yaklasakGelinler = gelinler.filter(g => g.tarih >= bugun).slice(0, 10);

  // Bugün izinli olanlar
  const bugunIzinliler = getIzinliler(bugun);
  const haftaIzinliler = getIzinlerAralik(haftaBasiStr, haftaSonuStr);
  
  // Bugün çalışanlar (izinli olmayanlar)
  const izinliIdler = bugunIzinliler.map(i => i.personelId);
  const calisanlar = personelListesi.filter(p => !izinliIdler.includes(p.id));

  // Boş günler (ilk 10 müsait günü bul)
  const bosGunler = [];
  let dayOffset = 0;
  while (bosGunler.length < 10 && dayOffset < 60) {
    const tarih = new Date(bugunDate);
    tarih.setDate(bugunDate.getDate() + dayOffset);
    const tarihStr = tarih.toISOString().split('T')[0];
    if (gelinler.filter(g => g.tarih === tarihStr).length === 0) {
      bosGunler.push(tarihStr);
    }
    dayOffset++;
  }

  // Yaklaşan doğum günleri ve tatiller
  const yaklasanDogumGunleri = getYaklasanDogumGunleri();
  const yaklasanTatiller = getYaklasanTatiller();

  // DİKKAT EDİLECEKLER
  const islenmemisUcretler = gelinler.filter(g => g.tarih >= bugun && g.ucret === -1);
  
  const toplamDikkat = islenmemisUcretler.length + eksikIzinler.length;

  const ayIsimleri = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const gunIsimleri = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const formatTarihUzun = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatGun = (tarih: string) => gunIsimleri[new Date(tarih).getDay()];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} />

      <div className="md:md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0 pt-14 md:pt-0 pb-20 md:pb-0">
        <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4 sticky top-14 md:top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-bold text-gray-800">Merhaba, {user?.email?.split('@')[0]}!</h1>
              <p className="text-xs md:text-sm text-gray-500">{formatTarihUzun(bugun)} • {formatGun(bugun)}</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              {lastUpdate && (
                <div className="hidden md:block bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                  <span className="text-green-700 text-sm font-medium">✓ Son güncelleme: {lastUpdate}</span>
                </div>
              )}
              <button
                onClick={() => { setDataLoading(true); fetchGelinler(); }}
                disabled={dataLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 md:px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
              >
                {dataLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div> : "🔄"}
                Yenile
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">
          {/* Duyurular Banner */}
          {duyurular.length > 0 && (
            <div className="mb-4 md:mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 md:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📢</span>
                  <h3 className="font-semibold text-amber-800">Duyurular</h3>
                </div>
                <a href="/duyurular" className="text-amber-600 hover:text-amber-700 text-xs font-medium">
                  Tümünü gör →
                </a>
              </div>
              <div className="space-y-2">
                {duyurular.slice(0, 3).map((d) => (
                  <div key={d.id} className={`p-2.5 rounded-lg ${d.important ? 'bg-white/80 border border-amber-300' : 'bg-white/50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-900 truncate">{d.title}</p>
                        <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{d.content}</p>
                      </div>
                      {d.important && <span className="text-xs">🔥</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DİKKAT EDİLECEKLER PANEL */}
          {toplamDikkat > 0 && (
            <div className="mb-4 md:mb-6">
              <Panel icon="⚠️" title="Dikkat Edilecekler" badge={toplamDikkat}>
                <div className="space-y-3">
                  {/* İşlenmemiş Ücretler */}
                  {islenmemisUcretler.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-600 text-xl">💰</span>
                          <h4 className="font-semibold text-yellow-900">İşlenmemiş Ücretler</h4>
                        </div>
                        <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                          {islenmemisUcretler.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {islenmemisUcretler.slice(0, 3).map(g => (
                          <div 
                            key={g.id}
                            onClick={() => setSelectedGelin(g)}
                            className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-gray-50 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800">{g.isim}</span>
                              <span className="text-xs text-gray-500">{formatTarih(g.tarih)}</span>
                            </div>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">X₺</span>
                          </div>
                        ))}
                        {islenmemisUcretler.length > 3 && (
                          <button 
                            onClick={() => router.push('/gelinler?filtre=islenmemis')}
                            className="text-yellow-600 text-xs font-medium hover:text-yellow-700 w-full text-center pt-2"
                          >
                            +{islenmemisUcretler.length - 3} daha gör →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Eksik İzin Hakları */}
                  {eksikIzinler.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 text-xl">🏖️</span>
                          <h4 className="font-semibold text-green-900">Eksik İzin Hakları</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          {eksikIzinler.length > 1 && (
                            <button
                              onClick={handleTumIzinleriEkle}
                              className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 transition"
                            >
                              Tümünü Ekle
                            </button>
                          )}
                          <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                            {eksikIzinler.length}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {eksikIzinler.slice(0, 5).map(eksik => (
                          <div 
                            key={eksik.personel.id}
                            className="flex items-center justify-between p-2 bg-white rounded-lg"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">
                                  {eksik.personel.ad} {eksik.personel.soyad}
                                </span>
                                <span className="text-xs text-gray-500">({eksik.calismaYili}. yıl)</span>
                              </div>
                              <div className="text-xs text-gray-500">
                                {eksik.mevcut} → {eksik.olmasiGereken} gün
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-green-600">+{eksik.eksik}</span>
                              <button
                                onClick={() => handleIzinEkle(eksik)}
                                disabled={izinEkleniyor === eksik.personel.id}
                                className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600 transition disabled:opacity-50"
                              >
                                {izinEkleniyor === eksik.personel.id ? "..." : "Ekle"}
                              </button>
                            </div>
                          </div>
                        ))}
                        {eksikIzinler.length > 5 && (
                          <button 
                            onClick={() => router.push('/izinler/haklar')}
                            className="text-green-600 text-xs font-medium hover:text-green-700 w-full text-center pt-2"
                          >
                            +{eksikIzinler.length - 5} daha gör →
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          )}

          {/* Üst Kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
            <Card icon="💄" title="Bugün" value={bugunGelinler.length} subtitle="gelin" color="pink" />
            <Card icon="📅" title="Bu Hafta" value={buHaftaGelinler.length} subtitle="gelin" color="purple" />
            {/* Ay kartı - hedefli */}
            <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">{ayIsimleri[bugunDate.getMonth()]}</p>
                  <p className="text-xl md:text-2xl font-bold mt-1 text-blue-600">
                    {buAyGelinler.length}
                    {aylikHedef > 0 && <span className="text-sm text-gray-400 font-normal">/{aylikHedef}</span>}
                  </p>
                  <p className="text-gray-400 text-xs">gelin</p>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <span className="text-lg md:text-xl">👰</span>
                </div>
              </div>
              {aylikHedef > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min((buAyGelinler.length / aylikHedef) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3 Kolon Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            
            {/* Sol Kolon */}
            <div className="lg:col-span-2 space-y-4 md:space-y-6">
              
              {/* Bugünün İşleri */}
              <Panel 
                icon="💄" 
                title="Bugünün İşleri" 
                badge={bugunGelinler.length}
                onRefresh={() => fetchGelinler()}
              >
                {dataLoading ? (
                  <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                ) : bugunGelinler.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl">🎉</span>
                    <p className="mt-2">Bugün iş yok!</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {bugunGelinler.map((gelin) => (
                      <GelinRow key={gelin.id} gelin={gelin} onClick={() => setSelectedGelin(gelin)} />
                    ))}
                  </div>
                )}
              </Panel>

              {/* Bu Haftanın Programı */}
              <Panel 
                icon="🗓️" 
                title="Bu Haftanın Programı"
                action={haftaIzinliler.length > 0 ? `${haftaIzinliler.length} izinli` : undefined}
              >
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-7 gap-2 min-w-[600px]">
                    {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((gunAdi, index) => {
                      const tarih = new Date(haftaBasi);
                      tarih.setDate(haftaBasi.getDate() + index);
                      const tarihStr = tarih.toISOString().split('T')[0];
                      const gunGelinler = gelinler.filter(g => g.tarih === tarihStr);
                      const gunIzinliler = getIzinliler(tarihStr);
                      const isToday = tarihStr === bugun;

                      return (
                        <div key={gunAdi} className={`p-2 rounded-xl ${isToday ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-gray-50'}`}>
                          <div className={`text-center text-xs font-medium ${isToday ? 'text-pink-600' : 'text-gray-500'}`}>
                            {gunAdi}
                            <div className={`text-lg font-bold ${isToday ? 'text-pink-600' : 'text-gray-700'}`}>
                              {tarih.getDate()}
                            </div>
                          </div>
                          <div className="space-y-1 mt-2 max-h-[250px] overflow-y-auto">
                            {gunIzinliler.map((izin, idx) => (
                              <div key={idx} className="bg-orange-100 text-orange-700 p-1 rounded text-xs text-center">
                                {izin.personel?.isim} 🏖️
                              </div>
                            ))}
                            {gunGelinler.map((g) => (
                              <div 
                                key={g.id} 
                                onClick={() => setSelectedGelin(g)}
                                className="bg-white p-1.5 rounded shadow-sm text-xs cursor-pointer hover:bg-gray-100"
                              >
                                <p className="font-medium truncate">{g.isim}</p>
                                <p className="text-gray-500">{g.saat}</p>
                              </div>
                            ))}
                            {gunGelinler.length === 0 && gunIzinliler.length === 0 && (
                              <div className="text-center text-gray-400 text-xs py-2">-</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>

              {/* Yaklaşan Gelinler */}
              <Panel icon="📅" title="Yaklaşan Gelinler" link="/gelinler">
                {yaklasakGelinler.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Yaklaşan gelin yok</div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {yaklasakGelinler.map((gelin) => (
                      <GelinRow key={gelin.id} gelin={gelin} showDate onClick={() => setSelectedGelin(gelin)} />
                    ))}
                  </div>
                )}
              </Panel>
            </div>

            {/* Sağ Kolon */}
            <div className="space-y-4 md:space-y-6">
              
              {/* Aktif Personel */}
              <Panel icon="👥" title={`Bugün ${calisanlar.length} Kişi Aktif`}>
                <div className="space-y-2">
                  {calisanlar.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span>{p.emoji}</span>
                        <span className="text-sm font-medium text-gray-700">{p.isim}</span>
                      </div>
                      <span className="text-xs text-gray-400">{p.calismaSaatleri}</span>
                    </div>
                  ))}
                </div>
                {bugunIzinliler.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-gray-500 mb-2">İzinli ({bugunIzinliler.length})</p>
                    {bugunIzinliler.map((izin) => (
                      <div key={izin.id} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg mb-1">
                        <span>{izin.personel?.emoji}</span>
                        <span className="text-sm text-orange-700">{izin.personel?.isim}</span>
                        <span className="text-xs text-orange-500 ml-auto">🏖️</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Müsait Günler */}
              {bosGunler.length > 0 && (
                <Panel icon="📭" title="Önümüzdeki 10 Müsait Gün" badge={bosGunler.length}>
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {bosGunler.map((tarih) => (
                      <div key={tarih} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <span className="text-sm text-gray-700">{formatTarih(tarih)}</span>
                        <span className="text-xs text-gray-500">{formatGun(tarih)}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Doğum Günleri */}
              {yaklasanDogumGunleri.length > 0 && (
                <Panel icon="🎂" title="Yaklaşan Doğum Günleri">
                  <div className="space-y-2">
                    {yaklasanDogumGunleri.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg">
                        <span className="text-xl">{p.emoji}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{p.isim}</p>
                          <p className="text-xs text-gray-500">{formatTarih(p.yaklasanTarih)}</p>
                        </div>
                        {p.kalanGun === 0 ? (
                          <span className="text-pink-600 text-xs font-bold">Bugün! 🎉</span>
                        ) : (
                          <span className="text-gray-400 text-xs">{p.kalanGun} gün</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Panel>
              )}

              {/* Resmi Tatiller */}
              <Panel icon="🏛️" title="Resmi Tatiller">
                <div className="space-y-2">
                  {yaklasanTatiller.map((t) => (
                    <div key={t.tarih} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-700">{t.isim}</span>
                      <span className="text-xs text-gray-500">{formatTarih(t.tarih)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        </main>
      </div>

      {/* Gelin Detay Modal */}
      {selectedGelin && (
        <GelinModal gelin={selectedGelin} onClose={() => setSelectedGelin(null)} />
      )}
    </div>
  );
}

// Yardımcı Componentler
function Card({ icon, title, value, subtitle, color }: { icon: string; title: string; value: string | number; subtitle: string; color: string }) {
  const colors: Record<string, string> = {
    pink: 'bg-pink-100 text-pink-600',
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    red: 'bg-red-100 text-red-600',
  };
  return (
    <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs">{title}</p>
          <p className={`text-xl md:text-2xl font-bold mt-1 ${colors[color]?.split(' ')[1] || 'text-gray-800'}`}>{value}</p>
          <p className="text-gray-400 text-xs">{subtitle}</p>
        </div>
        <div className={`w-9 h-9 md:w-10 md:h-10 ${colors[color]?.split(' ')[0] || 'bg-gray-100'} rounded-xl flex items-center justify-center`}>
          <span className="text-lg md:text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function Panel({ icon, title, badge, action, link, children, onRefresh }: { 
  icon: string; title: string; badge?: number; action?: string; link?: string; children: React.ReactNode; onRefresh?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 md:px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <span>{icon}</span> {title}
          {badge !== undefined && (
            <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">{badge}</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {action && <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full hidden md:inline">{action}</span>}
          {onRefresh && (
            <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600 text-xs">🔄</button>
          )}
          {link && (
            <button onClick={() => router.push(link)} className="text-pink-600 hover:text-pink-700 text-xs">
              Tümü →
            </button>
          )}
        </div>
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}

function GelinRow({ gelin, showDate, onClick }: { gelin: any; showDate?: boolean; onClick: () => void }) {
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="bg-pink-100 text-pink-600 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs">
          {showDate ? formatTarih(gelin.tarih) : gelin.saat}
        </div>
        <div>
          <p className="font-medium text-gray-800 text-sm">{gelin.isim}</p>
          <div className="flex gap-1 mt-0.5">
            {showDate && <span className="text-xs text-gray-500">{gelin.saat} •</span>}
            <span className={`text-xs px-1.5 py-0.5 rounded ${gelin.makyaj ? 'bg-pink-100 text-pink-600' : 'bg-gray-200 text-gray-500'}`}>
              {gelin.makyaj 
                ? (gelin.turban && gelin.turban !== gelin.makyaj 
                    ? `${gelin.makyaj} & ${gelin.turban}` 
                    : gelin.makyaj)
                : 'Atanmamış'}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        {gelin.ucret === -1 ? (
          <p className="text-gray-400 text-xs">İşlenmemiş</p>
        ) : (
          <p className="text-red-500 font-semibold text-sm">{gelin.kalan.toLocaleString('tr-TR')} ₺</p>
        )}
      </div>
    </div>
  );
}

function GelinModal({ gelin, onClose }: { gelin: any; onClose: () => void }) {
  const makyajPersonel = getPersonelByIsim(gelin.makyaj);
  const turbanPersonel = gelin.turban && gelin.turban !== gelin.makyaj ? getPersonelByIsim(gelin.turban) : null;
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatDateTime = (tarih: string) => new Date(tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6">
          {/* Mobilde üstte çizgi handle */}
          <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>👰</span> Gelin Detayı
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl flex items-center justify-center text-gray-600 text-xl md:text-2xl font-bold">
              {gelin.isim.charAt(0)}
            </div>
            <div>
              <p className="text-lg md:text-xl font-semibold text-gray-800">{gelin.isim}</p>
              <p className="text-sm md:text-base text-gray-600">{formatTarih(gelin.tarih)} • {gelin.saat}</p>
              {gelin.kinaGunu && <p className="text-xs md:text-sm text-gray-500 mt-1">Kına Günü: {gelin.kinaGunu}</p>}
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            {gelin.telefon && (
              <div className="bg-blue-50 p-3 md:p-4 rounded-xl">
                <h4 className="font-semibold text-blue-900 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <span>📞</span> İletişim Bilgileri
                </h4>
                <div className="space-y-2 text-sm">
                  {gelin.telefon && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Tel:</span>
                      <a href={`tel:${gelin.telefon}`} className="text-blue-700 hover:underline">{gelin.telefon}</a>
                    </div>
                  )}
                  {gelin.esiTelefon && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Eşi Tel:</span>
                      <a href={`tel:${gelin.esiTelefon}`} className="text-blue-700 hover:underline">{gelin.esiTelefon}</a>
                    </div>
                  )}
                  {gelin.instagram && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Instagram:</span>
                      <a href={`https://instagram.com/${gelin.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{gelin.instagram}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-pink-50 rounded-xl">
                <p className="text-pink-600 text-xs md:text-sm font-medium mb-2">💄 Makyaj</p>
                {makyajPersonel ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{makyajPersonel.emoji}</span>
                      <span className="font-semibold text-gray-800">{makyajPersonel.isim}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{makyajPersonel.instagram}</p>
                    <p className="text-xs text-gray-500">{makyajPersonel.telefon}</p>
                  </>
                ) : (
                  <p className="text-gray-500">Atanmamış</p>
                )}
              </div>
              <div className="p-3 md:p-4 bg-purple-50 rounded-xl">
                <p className="text-purple-600 text-xs md:text-sm font-medium mb-2">🧕 Türban</p>
                {turbanPersonel ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-lg md:text-xl">{turbanPersonel.emoji}</span>
                      <span className="font-semibold text-gray-800 text-sm md:text-base">{turbanPersonel.isim}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{turbanPersonel.instagram}</p>
                    <p className="text-xs text-gray-500">{turbanPersonel.telefon}</p>
                  </>
                ) : makyajPersonel && gelin.turban === gelin.makyaj ? (
                  <p className="text-gray-600 text-xs md:text-sm">Makyaj ile aynı kişi</p>
                ) : (
                  <p className="text-gray-500 text-sm">Atanmamış</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
              <h4 className="font-medium text-gray-700 mb-2 md:mb-3 text-sm md:text-base">💰 Ödeme Bilgileri</h4>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Ücret</p>
                  <p className="font-bold text-gray-800 text-sm md:text-base">
                    {gelin.ucret === -1 ? <span className="text-gray-400">-</span> : `${gelin.ucret.toLocaleString('tr-TR')} ₺`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kapora</p>
                  <p className="font-bold text-green-600 text-sm md:text-base">{gelin.kapora.toLocaleString('tr-TR')} ₺</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kalan</p>
                  <p className="font-bold text-red-600 text-sm md:text-base">
                    {gelin.ucret === -1 ? '-' : `${gelin.kalan.toLocaleString('tr-TR')} ₺`}
                  </p>
                </div>
              </div>
              {gelin.anlasildigiTarih && (
                <p className="text-xs text-gray-500">Anlaştığı Tarih: {formatDateTime(gelin.anlasildigiTarih)}</p>
              )}
            </div>

            <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
              <h4 className="font-medium text-gray-700 mb-2 text-sm md:text-base">📝 Gelin Notu</h4>
              {gelin.gelinNotu ? (
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{gelin.gelinNotu}</p>
              ) : (
                <p className="text-gray-400 text-sm italic">Henüz not eklenmemiş</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}