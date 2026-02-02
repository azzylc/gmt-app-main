"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { auth, db } from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, onSnapshot, addDoc, doc, updateDoc, increment, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "./components/Sidebar";
import GelinModal from "./components/GelinModal";
import { usePersoneller, getPersonelByIsim } from "./hooks/usePersoneller";
import { getYaklasanDogumGunleri, getYaklasanTatiller } from "./lib/data";
import MetricCard from "./components/dashboard/MetricCard";
import GelinListPanel from "./components/dashboard/GelinListPanel";
import PersonelDurumPanel from "./components/dashboard/PersonelDurumPanel";
import DikkatPanel from "./components/dashboard/DikkatPanel";
import SakinGunlerPanel from "./components/dashboard/SakinGunlerPanel";

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
  yorumIstesinMi?: string;  // Kişi ismi veya boş
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

interface IzinKaydi {
  id: string;
  personelId: string;
  personelAd: string;
  baslangicTarihi: string;
  bitisTarihi: string;
  izinTuru: string;
  durum: string;
  aciklama?: string;
}

interface AttendanceRecord {
  id: string;
  personelId: string;
  personelAd: string;
  personelEmail: string;
  tip: "giris" | "cikis";
  tarih: any;
  konumAdi: string;
}

interface PersonelGunlukDurum {
  personelId: string;
  personelAd: string;
  girisSaati: string | null;
  cikisSaati: string | null;
  aktifMi: boolean;
}

const API_URL = "/api/gelinler"; // Server-side proxy ile güvenli
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
  const [haftaModalOpen, setHaftaModalOpen] = useState(false);
  const router = useRouter();

  // Personel hook'u (Firebase'den real-time)
  const { personeller, loading: personellerLoading } = usePersoneller();

  // Gelin listesi modal state'leri
  const [gelinListeModal, setGelinListeModal] = useState<{open: boolean; title: string; gelinler: Gelin[]}>({
    open: false,
    title: "",
    gelinler: []
  });

  // Attendance state'leri
  const [bugunAttendance, setBugunAttendance] = useState<AttendanceRecord[]>([]);
  const [personelDurumlar, setPersonelDurumlar] = useState<PersonelGunlukDurum[]>([]);

  // İzin hakkı state'leri
  const [eksikIzinler, setEksikIzinler] = useState<EksikIzin[]>([]);
  const [izinEkleniyor, setIzinEkleniyor] = useState<string | null>(null);

  // Duyurular state
  const [duyurular, setDuyurular] = useState<Duyuru[]>([]);
  const [selectedDuyuru, setSelectedDuyuru] = useState<Duyuru | null>(null);

  // Gelin Arama state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Arama sonuçları
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase().trim();
    return gelinler
      .filter(g => 
        g.isim.toLowerCase().includes(query) ||
        g.telefon?.includes(query) ||
        g.makyaj?.toLowerCase().includes(query) ||
        g.turban?.toLowerCase().includes(query)
      )
      .slice(0, 8); // Max 8 sonuç
  }, [searchQuery, gelinler]);

  // Dropdown dışına tıklanınca kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobil arama açıldığında focus
  useEffect(() => {
    if (showMobileSearch && mobileSearchRef.current) {
      mobileSearchRef.current.focus();
    }
  }, [showMobileSearch]);

  // Modal açıkken body scroll'u kilitle
  useEffect(() => {
    const isAnyModalOpen = selectedGelin !== null || haftaModalOpen || gelinListeModal.open || selectedDuyuru !== null || showMobileSearch;
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedGelin, haftaModalOpen, gelinListeModal.open, selectedDuyuru, showMobileSearch]);

  // Aylık hedef state
  const [aylikHedef, setAylikHedef] = useState<number>(0);

  // Bugün/Yarın toggle
  const [gelinGunSecim, setGelinGunSecim] = useState<'bugun' | 'yarin'>('bugun');

  // Layout Seçimi (1, 2, veya 3)
  // Layout artık sabit: Üç sütun

  // Firebase'den çekilen izinler
  const [izinlerFirebase, setIzinlerFirebase] = useState<IzinKaydi[]>([]);
  
  // Vardiya planından hafta tatilleri
  const [haftaTatilleri, setHaftaTatilleri] = useState<IzinKaydi[]>([]);

  // Sakin günler filtre state
  const [sakinGunFiltre, setSakinGunFiltre] = useState<number>(0);

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
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Firestore Real-time Listener - Gelinler
  useEffect(() => {
    if (!user) return;

    console.log("🔥 Firestore listener başlatılıyor...");

    const gelinlerQuery = query(
      collection(db, "gelinler"),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(gelinlerQuery, (snapshot) => {
      console.log("📡 Firestore güncelleme geldi:", snapshot.size, "gelin");
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Gelin[];
      
      setGelinler(data);
      setDataLoading(false);
      setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
    }, (error) => {
      console.error("❌ Firestore listener hatası:", error);
      setDataLoading(false);
    });

    return () => {
      console.log("🔌 Firestore listener kapatılıyor...");
      unsubscribe();
    };
  }, [user]);





  // Firebase'den bugünün attendance kayıtlarını çek
  useEffect(() => {
    if (!user) return;
    
    const bugunBaslangic = new Date();
    bugunBaslangic.setHours(0, 0, 0, 0);
    const bugunBitis = new Date();
    bugunBitis.setHours(23, 59, 59, 999);

    const q = query(
      collection(db, "attendance"),
      where("tarih", ">=", Timestamp.fromDate(bugunBaslangic)),
      where("tarih", "<=", Timestamp.fromDate(bugunBitis)),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        records.push({
          id: doc.id,
          personelId: data.personelId,
          personelAd: data.personelAd,
          personelEmail: data.personelEmail,
          tip: data.tip,
          tarih: data.tarih,
          konumAdi: data.konumAdi || ""
        });
      });
      setBugunAttendance(records);
    });

    return () => unsubscribe();
  }, [user]);

  // Attendance'dan personel durumlarını hesapla
  useEffect(() => {
    const durumMap = new Map<string, PersonelGunlukDurum>();

    bugunAttendance.forEach((record) => {
      const mevcut = durumMap.get(record.personelId);
      const saat = record.tarih?.toDate?.() 
        ? record.tarih.toDate().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        : "";

      if (!mevcut) {
        durumMap.set(record.personelId, {
          personelId: record.personelId,
          personelAd: record.personelAd,
          girisSaati: record.tip === "giris" ? saat : null,
          cikisSaati: record.tip === "cikis" ? saat : null,
          aktifMi: record.tip === "giris"
        });
      } else {
        if (record.tip === "giris") {
          mevcut.girisSaati = saat;
          mevcut.aktifMi = true;
        } else {
          mevcut.cikisSaati = saat;
          mevcut.aktifMi = false;
        }
      }
    });

    setPersonelDurumlar(Array.from(durumMap.values()));
  }, [bugunAttendance]);

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
    });
    return () => unsubscribe();
  }, [user]);

  // Firebase'den izinleri çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "izinler"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log("🔥 TOPLAM İZİN SAYISI:", snapshot.size);
      const list: IzinKaydi[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        console.log("📋 İzin verisi:", {
          id: docSnap.id,
          personelAd: data.personelAd,
          durum: data.durum,
          baslangic: data.baslangic,
          bitis: data.bitis,
          izinTuru: data.izinTuru,
          ONAYLANDI_MI: (data.durum === "onaylandi" || data.durum === "Onaylandı"),
          tumVeri: data
        });
        // Sadece onaylanmış izinleri al
        if (data.durum === "onaylandi" || data.durum === "Onaylandı") {
          list.push({
            id: docSnap.id,
            personelId: data.personelId || "",
            personelAd: data.personelAd || "",
            baslangicTarihi: data.baslangic || "", // Firebase'de "baslangic"
            bitisTarihi: data.bitis || "", // Firebase'de "bitis"
            izinTuru: data.izinTuru || "",
            durum: data.durum || "",
            aciklama: data.aciklama || "",
          });
        } else {
          console.warn("⚠️ Bu izin ATLANDI - durum:", data.durum, "personel:", data.personelAd);
        }
      });
      console.log("✅ Toplam onaylanmış izin:", list.length, list);
      setIzinlerFirebase(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Vardiya planından hafta tatillerini çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "vardiyaPlan"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: IzinKaydi[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // Sadece hafta tatili olanları al
        if (data.haftaTatili === true) {
          console.log("🏖️ Hafta tatili bulundu:", {
            personelAd: data.personelAd,
            tarih: data.tarih
          });
          list.push({
            id: docSnap.id,
            personelId: data.personelId || "",
            personelAd: data.personelAd || "",
            baslangicTarihi: data.tarih || "", // Tek günlük
            bitisTarihi: data.tarih || "", // Tek günlük
            izinTuru: "Haftalık İzin",
            durum: "Onaylandı",
            aciklama: "Vardiya planından hafta tatili",
          });
        }
      });
      console.log("🏖️ Toplam hafta tatili:", list.length, list);
      setHaftaTatilleri(list);
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
    personeller.forEach((personel) => {
      if (!personel.iseBaslama) return;
      // Kurucu ve Yönetici için izin takibi yapma
      if (personel.kullaniciTuru === "Kurucu" || personel.kullaniciTuru === "Yönetici") return;
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
  }, [personeller]);

  // Firebase'den son 10 duyuruyu çek
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "announcements"), 
      orderBy("createdAt", "desc"),
      limit(10)
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
  
  // Yarının tarihi
  const yarinDate = new Date(bugunDate);
  yarinDate.setDate(yarinDate.getDate() + 1);
  const yarin = yarinDate.toISOString().split('T')[0];
  const yarinGelinler = gelinler.filter(g => g.tarih === yarin);
  
  const buHaftaGelinler = gelinler.filter(g => g.tarih >= haftaBasiStr && g.tarih <= haftaSonuStr);
  const buAyGelinler = gelinler.filter(g => g.tarih.startsWith(buAyStr));

  // Tüm izinleri birleştir (hem izinler hem vardiya planından hafta tatilleri)
  const tumIzinler = [...izinlerFirebase, ...haftaTatilleri];
  console.log("📊 Toplam tüm izinler (izinler + hafta tatili):", tumIzinler.length);

  // Bugün izinli olanlar (Firebase'den)
  const bugunIzinliler = tumIzinler.filter(izin => {
    const sonuc = izin.baslangicTarihi <= bugun && izin.bitisTarihi >= bugun;
    if (sonuc) {
      console.log("Bugün izinli:", {
        personel: izin.personelAd,
        baslangic: izin.baslangicTarihi,
        bitis: izin.bitisTarihi,
        bugun: bugun,
        kontrolBaslangic: izin.baslangicTarihi <= bugun,
        kontrolBitis: izin.bitisTarihi >= bugun
      });
    }
    return sonuc;
  }).map(izin => ({
    ...izin,
    personel: getPersonelByIsim(izin.personelAd?.split(' ')[0] || '', personeller)
  }));
  
  console.log("Bugün izinli toplam:", bugunIzinliler.length, bugunIzinliler);
  
  // Hafta izinliler (Firebase'den)
  const haftaIzinliler = tumIzinler.filter(izin =>
    izin.baslangicTarihi <= haftaSonuStr && izin.bitisTarihi >= haftaBasiStr
  ).map(izin => ({
    ...izin,
    personel: getPersonelByIsim(izin.personelAd?.split(' ')[0] || '', personeller)
  }));

  // Attendance bazlı hesaplamalar
  const bugunGelenler = personelDurumlar.filter(p => p.girisSaati !== null);
  const suAnCalisanlar = personelDurumlar.filter(p => p.aktifMi);

  // Sakin günler (filtreye göre)
  const sakinGunler: {tarih: string; gelinSayisi: number}[] = [];
  let dayOffset = 0;
  while (sakinGunler.length < 10 && dayOffset < 60) {
    const tarih = new Date(bugunDate);
    tarih.setDate(bugunDate.getDate() + dayOffset);
    const tarihStr = tarih.toISOString().split('T')[0];
    const gelinSayisi = gelinler.filter(g => g.tarih === tarihStr).length;
    if (gelinSayisi === sakinGunFiltre) {
      sakinGunler.push({ tarih: tarihStr, gelinSayisi });
    }
    dayOffset++;
  }

  // Yaklaşan doğum günleri ve tatiller
  const yaklasanDogumGunleri = getYaklasanDogumGunleri(personeller);
  const yaklasanTatiller = getYaklasanTatiller();

  // DİKKAT EDİLECEKLER
  const islenmemisUcretler = gelinler.filter(g => g.tarih >= bugun && g.ucret === -1);
  
  const toplamDikkat = islenmemisUcretler.length + eksikIzinler.length;

  const ayIsimleri = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const gunIsimleri = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const formatTarihUzun = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatGun = (tarih: string) => gunIsimleri[new Date(tarih).getDay()];

  // Hafta takvimi renderı
  const renderHaftaTakvimi = (isModal: boolean = false) => {
    const gunAdlari = isModal 
      ? ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
      : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    
    return (
      <div className={`grid grid-cols-7 gap-3 ${isModal ? 'min-w-[1200px]' : 'min-w-[600px]'}`}>
        {gunAdlari.map((gunAdi, index) => {
          const tarih = new Date(haftaBasi);
          tarih.setDate(haftaBasi.getDate() + index);
          const tarihStr = tarih.toISOString().split('T')[0];
          const gunGelinler = gelinler.filter(g => g.tarih === tarihStr);
          // Firebase'den izinlileri filtrele
          const gunIzinliler = izinlerFirebase.filter(izin =>
            izin.baslangicTarihi <= tarihStr && izin.bitisTarihi >= tarihStr
          ).map(izin => ({
            ...izin,
            personel: getPersonelByIsim(izin.personelAd?.split(' ')[0] || '', personeller)
          }));
          const isToday = tarihStr === bugun;

          return (
            <div 
              key={gunAdi} 
              className={`${isModal ? 'p-4 min-h-[350px] min-w-[150px]' : 'p-2'} rounded-xl ${isToday ? 'bg-pink-50 ring-2 ring-pink-300' : 'bg-gray-50'}`}
            >
              <div className={`text-center ${isModal ? 'text-base' : 'text-xs'} font-medium ${isToday ? 'text-pink-600' : 'text-gray-500'}`}>
                {gunAdi}
                <div className={`${isModal ? 'text-3xl' : 'text-lg'} font-bold ${isToday ? 'text-pink-600' : 'text-gray-700'}`}>
                  {tarih.getDate()}
                </div>
              </div>
              <div className={`space-y-2 mt-3 ${isModal ? 'max-h-[500px]' : 'max-h-[250px]'} overflow-y-auto`}>
                {gunIzinliler.map((izin, idx) => (
                  <div key={idx} className={`bg-orange-100 text-orange-700 ${isModal ? 'p-3' : 'p-1'} rounded-lg ${isModal ? 'text-base' : 'text-xs'} text-center`}>
                    {izin.personel?.isim} 🏖️
                  </div>
                ))}
                {gunGelinler.map((g) => (
                  <div 
                    key={g.id} 
                    onClick={() => { setSelectedGelin(g); if(isModal) setHaftaModalOpen(false); }}
                    className={`bg-white ${isModal ? 'p-3' : 'p-1.5'} rounded-lg shadow-sm ${isModal ? 'text-base' : 'text-xs'} cursor-pointer hover:bg-gray-100`}
                  >
                    <p className={`font-medium ${isModal ? '' : 'truncate'}`}>{g.isim}</p>
                    <p className={`text-gray-500 ${isModal ? 'text-sm mt-1' : ''}`}>{g.saat}</p>
                    {isModal && g.makyaj && (
                      <p className="text-pink-500 text-sm mt-1">{g.makyaj}</p>
                    )}
                  </div>
                ))}
                {gunGelinler.length === 0 && gunIzinliler.length === 0 && (
                  <div className={`text-center text-gray-400 ${isModal ? 'text-base py-6' : 'text-xs py-2'}`}>-</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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

      <div className="md:ml-64 pb-20 md:pb-0">
        <header className="bg-white border-b px-4 md:px-6 py-3 md:py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-shrink-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-800">Merhaba, {user?.email?.split('@')[0]}!</h1>
              <p className="text-xs md:text-sm text-gray-500">{formatTarihUzun(bugun)} • {formatGun(bugun)}</p>
            </div>
            
            {/* Gelin Arama */}
            <div ref={searchRef} className="hidden md:block flex-1 max-w-md relative">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  placeholder="Gelin ara... (isim, telefon)"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent focus:bg-white transition"
                />
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(""); setShowSearchDropdown(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* Arama Sonuçları Dropdown */}
              {showSearchDropdown && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 max-h-[400px] overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="px-4 py-8 text-center text-gray-500">
                      <span className="text-3xl block mb-2">🔍</span>
                      <p className="text-sm">"{searchQuery}" için sonuç bulunamadı</p>
                    </div>
                  ) : (
                    <div>
                      <div className="px-3 py-2 bg-gray-50 border-b text-xs text-gray-500 font-medium">
                        {searchResults.length} sonuç bulundu
                      </div>
                      {searchResults.map((gelin) => (
                        <div
                          key={gelin.id}
                          onClick={() => {
                            setSelectedGelin(gelin);
                            setSearchQuery("");
                            setShowSearchDropdown(false);
                          }}
                          className="px-4 py-3 hover:bg-pink-50 cursor-pointer border-b border-gray-50 last:border-0 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-800">{gelin.isim}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">📅 {new Date(gelin.tarih).toLocaleDateString('tr-TR')}</span>
                                <span className="text-xs text-gray-500">🕐 {gelin.saat}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-xs text-gray-500">
                                {gelin.makyaj && <span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded">💄 {gelin.makyaj.split(' ')[0]}</span>}
                                {gelin.turban && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">🧕 {gelin.turban.split(' ')[0]}</span>}
                              </div>
                              {gelin.kalan > 0 && (
                                <p className="text-xs text-red-500 mt-1">{gelin.kalan.toLocaleString('tr-TR')} ₺ kalan</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobil Arama Butonu */}
            <button 
              onClick={() => setShowMobileSearch(true)}
              className="md:hidden w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 transition"
            >
              🔍
            </button>

            <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
              {lastUpdate && (
                <div className="hidden md:block bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                  <span className="text-green-700 text-sm font-medium">✓ Anlık: {lastUpdate}</span>
                </div>
              )}
              {dataLoading && (
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6">


          {/* ÜÇ SÜTUN DASHBOARD */}
            <div className="max-w-[1600px] mx-auto">
              
              {/* Duyurular Banner */}
              {duyurular.length > 0 && (
                <div className="mb-4 md:mb-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 md:p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📢</span>
                      <h3 className="font-semibold text-amber-800">Duyurular</h3>
                      <span className="bg-amber-200 text-amber-800 text-xs px-2 py-0.5 rounded-full">{duyurular.length}</span>
                    </div>
                    <a href="/duyurular" className="text-amber-600 hover:text-amber-700 text-xs font-medium">
                      Tümünü gör →
                    </a>
                  </div>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {duyurular.map((d) => (
                      <div 
                        key={d.id} 
                        onClick={() => setSelectedDuyuru(d)}
                        className={`p-2.5 rounded-lg cursor-pointer hover:shadow-sm transition ${d.important ? 'bg-white/80 border border-amber-300' : 'bg-white/50 hover:bg-white/70'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-900 truncate">{d.title}</p>
                            <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">{d.content}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {d.important && <span className="text-xs">🔥</span>}
                            <span className="text-xs text-amber-500">→</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DİKKAT EDİLECEKLER PANEL - FULL DETAY */}
              {toplamDikkat > 0 && (
                <div className="mb-4 md:mb-6">
                  <Panel icon="⚠️" title="Dikkat Edilecekler" badge={toplamDikkat}>
                    <div className="space-y-3">
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
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              )}

              {/* Üst Metrikler - Bugün/Yarın Toggle ile */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div 
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
                  onClick={() => setGelinListeModal({ 
                    open: true, 
                    title: gelinGunSecim === 'bugun' ? "Bugünkü Gelinler" : "Yarının Gelinler", 
                    gelinler: gelinGunSecim === 'bugun' ? bugunGelinler : yarinGelinler 
                  })}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-gray-500 text-xs">{gelinGunSecim === 'bugun' ? 'Bugün' : 'Yarın'}</p>
                      <p className="text-2xl font-bold mt-1 text-pink-600">
                        {gelinGunSecim === 'bugun' ? bugunGelinler.length : yarinGelinler.length}
                      </p>
                    </div>
                    <span className="text-2xl">💄</span>
                  </div>
                  {/* Toggle */}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setGelinGunSecim('bugun'); }}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium transition ${
                        gelinGunSecim === 'bugun' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Bugün
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setGelinGunSecim('yarin'); }}
                      className={`flex-1 px-2 py-1 rounded text-xs font-medium transition ${
                        gelinGunSecim === 'yarin' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Yarın
                    </button>
                  </div>
                </div>

                <div 
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
                  onClick={() => setGelinListeModal({ open: true, title: "Bu Haftaki Gelinler", gelinler: buHaftaGelinler })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">Bu Hafta</p>
                      <p className="text-2xl font-bold mt-1 text-purple-600">{buHaftaGelinler.length}</p>
                    </div>
                    <span className="text-2xl">📅</span>
                  </div>
                </div>

                <div 
                  className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition"
                  onClick={() => setGelinListeModal({ open: true, title: `${ayIsimleri[bugunDate.getMonth()]} Ayı Gelinleri`, gelinler: buAyGelinler })}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">{ayIsimleri[bugunDate.getMonth()]}</p>
                      <p className="text-2xl font-bold mt-1 text-blue-600">
                        {buAyGelinler.length}
                        {aylikHedef > 0 && <span className="text-sm text-gray-400 font-normal">/{aylikHedef}</span>}
                      </p>
                    </div>
                    <span className="text-2xl">👰</span>
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

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-xs">Aktif</p>
                      <p className="text-2xl font-bold mt-1 text-green-600">{suAnCalisanlar.length}</p>
                    </div>
                    <span className="text-2xl">🟢</span>
                  </div>
                </div>
              </div>

              {/* 3 Sütun Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Sol Sütun */}
                <div className="space-y-4">
                  {/* Şu An Çalışanlar - DETAYLI */}
                  <Panel icon="🟢" title={`Şu An ${suAnCalisanlar.length} Kişi Çalışıyor`}>
                    {suAnCalisanlar.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <span className="text-3xl">😴</span>
                        <p className="mt-2 text-sm">Şu anda aktif çalışan yok</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {suAnCalisanlar.map((p) => {
                          const personel = personeller.find(per => per.id === p.personelId);
                          return (
                            <div key={p.personelId} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{personel?.emoji || "👤"}</span>
                                <span className="text-sm font-medium text-gray-700">{p.personelAd}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-xs text-green-600 font-medium">Giriş: {p.girisSaati}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Panel>

                  {/* Bugün Gelenler + İzinliler */}
                  <Panel icon="📋" title={`Bugün ${bugunGelenler.length} Kişi Geldi`}>
                    {bugunGelenler.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <span className="text-3xl">🕐</span>
                        <p className="mt-2 text-sm">Henüz kimse giriş yapmadı</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {bugunGelenler.map((p) => {
                          const personel = personeller.find(per => per.id === p.personelId);
                          return (
                            <div key={p.personelId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{personel?.emoji || "👤"}</span>
                                <span className="text-sm font-medium text-gray-700">{p.personelAd}</span>
                              </div>
                              <div className="text-right text-xs">
                                <p className="text-green-600">Giriş: {p.girisSaati}</p>
                                {p.cikisSaati && <p className="text-red-500">Çıkış: {p.cikisSaati}</p>}
                                {!p.cikisSaati && <p className="text-gray-400">Çıkış: -</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* İzinli Olanlar */}
                    {bugunIzinliler.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">İzinli ({bugunIzinliler.length})</p>
                        <div className="space-y-2">
                          {bugunIzinliler.map((izin) => (
                            <div key={izin.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-200">
                              <span className="text-sm font-medium text-orange-800">{izin.personelAd}</span>
                              <span className="text-xs text-orange-600">{izin.izinTuru}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Panel>

                  {/* Doğum Günleri */}
                  {yaklasanDogumGunleri.length > 0 && (
                    <Panel icon="🎂" title="Yaklaşan Doğum Günleri">
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
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
                </div>

                {/* Orta Sütun: Bugünün/Yarının İşleri */}
                <div>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                          <span>💄</span> {gelinGunSecim === 'bugun' ? "Bugünün İşleri" : "Yarının İşleri"}
                          <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">
                            {gelinGunSecim === 'bugun' ? bugunGelinler.length : yarinGelinler.length}
                          </span>
                        </h2>
                      </div>
                    </div>
                    <div className="p-4">
                      {dataLoading ? (
                        <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
                      ) : (gelinGunSecim === 'bugun' ? bugunGelinler : yarinGelinler).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <span className="text-4xl">🎉</span>
                          <p className="mt-2">{gelinGunSecim === 'bugun' ? 'Bugün' : 'Yarın'} iş yok!</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                          {(gelinGunSecim === 'bugun' ? bugunGelinler : yarinGelinler).map((gelin) => (
                            <GelinRow key={gelin.id} gelin={gelin} onClick={() => setSelectedGelin(gelin)} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sağ Sütun */}
                <div className="space-y-4">
                  {/* Haftalık Program - BÜYÜTME */}
                  <div 
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition"
                    onClick={() => setHaftaModalOpen(true)}
                  >
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                        <span>🗓️</span> Bu Haftanın Programı
                        <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">{buHaftaGelinler.length}</span>
                      </h2>
                      <div className="flex items-center gap-2">
                        {haftaIzinliler.length > 0 && (
                          <span className="text-xs text-orange-500 bg-orange-50 px-2 py-1 rounded-full">
                            {haftaIzinliler.length} izinli
                          </span>
                        )}
                        <span className="text-gray-400 text-xs">Büyütmek için tıkla →</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        {renderHaftaTakvimi(false)}
                      </div>
                    </div>
                  </div>

                  {/* Sakin Günler - FİLTRELİ */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                        <span>📭</span> Sakin Günler
                        <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">{sakinGunler.length}</span>
                      </h2>
                      <select 
                        value={sakinGunFiltre}
                        onChange={(e) => setSakinGunFiltre(Number(e.target.value))}
                        className="text-xs bg-gray-100 border-0 rounded-lg px-2 py-1 text-gray-600 focus:ring-2 focus:ring-pink-300"
                      >
                        <option value={0}>Hiç gelin yok</option>
                        <option value={1}>Sadece 1 gelin var</option>
                        <option value={2}>Sadece 2 gelin var</option>
                      </select>
                    </div>
                    <div className="p-4">
                      {sakinGunler.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <span className="text-3xl">🔍</span>
                          <p className="mt-2 text-sm">Bu kriterde gün bulunamadı</p>
                        </div>
                      ) : (
                        <div className="space-y-1 max-h-[240px] overflow-y-auto">
                          {sakinGunler.map((gun) => (
                            <div key={gun.tarih} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                              <span className="text-sm text-gray-700">{formatTarih(gun.tarih)}</span>
                              <div className="flex items-center gap-2">
                                {gun.gelinSayisi > 0 && (
                                  <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded">{gun.gelinSayisi} gelin</span>
                                )}
                                <span className="text-xs text-gray-500">{formatGun(gun.tarih)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Resmi Tatiller */}
                  <Panel icon="🏛️" title="Resmi Tatiller">
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {yaklasanTatiller.slice(0, 10).map((t) => (
                        <div key={t.tarih} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm text-gray-700">{t.isim}</span>
                          <span className="text-xs text-gray-500">{formatTarih(t.tarih)}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
        </main>
      </div>

      {/* Mobil Arama Modal */}
      {showMobileSearch && (
        <div className="fixed inset-0 bg-black/50 z-50 md:hidden" onClick={() => setShowMobileSearch(false)}>
          <div className="bg-white w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    ref={mobileSearchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    placeholder="Gelin ara... (isim, telefon)"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <button 
                  onClick={() => { setShowMobileSearch(false); setSearchQuery(""); }}
                  className="px-4 py-3 text-gray-600 font-medium"
                >
                  İptal
                </button>
              </div>
            </div>
            
            {/* Mobil Arama Sonuçları */}
            {searchQuery.length >= 2 && (
              <div className="max-h-[70vh] overflow-y-auto border-t border-gray-100">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-12 text-center text-gray-500">
                    <span className="text-4xl block mb-3">🔍</span>
                    <p>"{searchQuery}" için sonuç bulunamadı</p>
                  </div>
                ) : (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium sticky top-0">
                      {searchResults.length} sonuç bulundu
                    </div>
                    {searchResults.map((gelin) => (
                      <div
                        key={gelin.id}
                        onClick={() => {
                          setSelectedGelin(gelin);
                          setSearchQuery("");
                          setShowMobileSearch(false);
                        }}
                        className="px-4 py-4 border-b border-gray-100 active:bg-pink-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-800">{gelin.isim}</p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-sm text-gray-500">📅 {new Date(gelin.tarih).toLocaleDateString('tr-TR')}</span>
                              <span className="text-sm text-gray-500">🕐 {gelin.saat}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-xs">
                              {gelin.makyaj && <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded">💄</span>}
                              {gelin.turban && <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded">🧕</span>}
                            </div>
                            {gelin.kalan > 0 && (
                              <p className="text-sm text-red-500 mt-1 font-medium">{gelin.kalan.toLocaleString('tr-TR')} ₺</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Duyuru Detay Modal */}
      {selectedDuyuru && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={() => setSelectedDuyuru(null)}>
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 relative">
              <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2"></div>
              <div className="pt-2 md:pt-0 flex items-center gap-2">
                <span className="text-xl">📢</span>
                <h2 className="text-lg font-bold text-amber-900">Duyuru Detayı</h2>
                {selectedDuyuru.important && <span className="text-sm">🔥</span>}
              </div>
              <button 
                onClick={() => setSelectedDuyuru(null)} 
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedDuyuru.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 flex-wrap">
                <span>👤 {selectedDuyuru.author}</span>
                <span>•</span>
                <span>
                  {selectedDuyuru.createdAt?.toDate?.() 
                    ? selectedDuyuru.createdAt.toDate().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
                {selectedDuyuru.group && selectedDuyuru.group !== "Tümü" && (
                  <>
                    <span>•</span>
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{selectedDuyuru.group}</span>
                  </>
                )}
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedDuyuru.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hafta Programı Modal */}
      {haftaModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setHaftaModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-pink-50 to-purple-50">
              <div>
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span>🗓️</span> Bu Haftanın Programı
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {formatTarih(haftaBasiStr)} - {formatTarih(haftaSonuStr)} • {buHaftaGelinler.length} gelin
                </p>
              </div>
              <button 
                onClick={() => setHaftaModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600 text-3xl font-light"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-x-auto overflow-y-auto max-h-[calc(90vh-80px)]">
              {renderHaftaTakvimi(true)}
            </div>
          </div>
        </div>
      )}

      {/* Gelin Listesi Modal */}
      {gelinListeModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={() => setGelinListeModal({ ...gelinListeModal, open: false })}>
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-pink-50 to-purple-50 relative">
              <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2"></div>
              <div className="pt-2 md:pt-0">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span>👰</span> {gelinListeModal.title}
                </h2>
                <p className="text-sm text-gray-500">{gelinListeModal.gelinler.length} gelin</p>
              </div>
              <button 
                onClick={() => setGelinListeModal({ ...gelinListeModal, open: false })} 
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {gelinListeModal.gelinler.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-5xl">🎉</span>
                  <p className="mt-3">Bu dönemde gelin yok</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {gelinListeModal.gelinler.map((gelin) => (
                    <div 
                      key={gelin.id}
                      onClick={() => { setSelectedGelin(gelin); setGelinListeModal({ ...gelinListeModal, open: false }); }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-pink-100 text-pink-600 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs">
                          <span>{formatTarih(gelin.tarih).split(' ')[0]}</span>
                          <span className="text-[10px] font-normal">{formatTarih(gelin.tarih).split(' ')[1]}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{gelin.isim}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{gelin.saat}</span>
                            {gelin.makyaj && (
                              <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded">{gelin.makyaj}</span>
                            )}
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gelin Detay Modal */}
      {selectedGelin && (
        <GelinModal gelin={selectedGelin} onClose={() => setSelectedGelin(null)} />
      )}
    </div>
  );
}

// Yardımcı Componentler
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

function GelinRow({ gelin, showDate, onClick }: { gelin: Gelin; showDate?: boolean; onClick: () => void }) {
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