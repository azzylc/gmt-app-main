"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
  orderBy,
  getDocs,
  setDoc,
  getDoc
} from "firebase/firestore";

interface Gorev {
  id: string;
  baslik: string;
  aciklama: string;
  atayan: string; // "Sistem" veya user.uid
  atayanAd: string;
  atanan: string; // Personel ID
  atananAd: string;
  durum: "bekliyor" | "devam-ediyor" | "tamamlandi" | "iptal";
  oncelik: "dusuk" | "normal" | "yuksek" | "acil";
  olusturulmaTarihi: any;
  tamamlanmaTarihi?: any;
  gelinId?: string; // İlgili gelin
  otomatikMi?: boolean; // Sistem tarafından oluşturuldu mu?
  gorevTuru?: "yorumIstesinMi" | "paylasimIzni" | "yorumIstendiMi"; // Görev türü
}

interface Gelin {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  makyaj: string;
  turban: string;
  yorumIstesinMi?: string;
  paylasimIzni?: boolean;
  yorumIstendiMi?: boolean;
}

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  kullaniciTuru?: string;
  firmalar?: string[]; // Personelin çalıştığı firmalar
  yonettigiFirmalar?: string[]; // Yöneticinin yönettiği firmalar
}

interface GorevAyari {
  aktif: boolean;
  baslangicTarihi: string;
  saatFarki: number;
}

interface GorevAyarlari {
  yorumIstesinMi: GorevAyari;
  paylasimIzni: GorevAyari;
  yorumIstendiMi: GorevAyari;
}

export default function GorevlerPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userFirmalar, setUserFirmalar] = useState<string[]>([]); // Yöneticinin firmaları
  const [loading, setLoading] = useState(true);
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [tumGorevler, setTumGorevler] = useState<Gorev[]>([]); // Kurucu/Yönetici için
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [filtreliGorevler, setFiltreliGorevler] = useState<Gorev[]>([]);
  const [filtre, setFiltre] = useState<"hepsi" | "bekliyor" | "devam-ediyor" | "tamamlandi">("hepsi");
  const [aktifSekme, setAktifSekme] = useState<"gorevlerim" | "otomatik" | "tumgorevler">("gorevlerim");
  const [otomatikAltSekme, setOtomatikAltSekme] = useState<"yorumIstesinMi" | "paylasimIzni" | "yorumIstendiMi">("yorumIstesinMi");
  const [seciliPersoneller, setSeciliPersoneller] = useState<string[]>([]); // Seçili personel email'leri
  const [selectedGorev, setSelectedGorev] = useState<Gorev | null>(null);
  const [showAyarlar, setShowAyarlar] = useState(false);
  const [senkronizeLoading, setSenkronizeLoading] = useState<string | null>(null);
  const [gorevAyarlari, setGorevAyarlari] = useState<GorevAyarlari>({
    yorumIstesinMi: { aktif: false, baslangicTarihi: "", saatFarki: 1 },
    paylasimIzni: { aktif: false, baslangicTarihi: "", saatFarki: 2 },
    yorumIstendiMi: { aktif: false, baslangicTarihi: "", saatFarki: 0 }
  });
  const router = useRouter();

  // Auth kontrolü
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Görev ayarlarını Firestore'dan çek
  useEffect(() => {
    if (!user) return;

    const fetchAyarlar = async () => {
      try {
        const ayarDoc = await getDoc(doc(db, "settings", "gorevAyarlari"));
        if (ayarDoc.exists()) {
          setGorevAyarlari(ayarDoc.data() as GorevAyarlari);
        }
      } catch (error) {
        console.error("Görev ayarları çekilemedi:", error);
      }
    };
    fetchAyarlar();
  }, [user]);

  // ✅ Gelinler - Firestore'dan (real-time)
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Firestore gelinler listener başlatılıyor (Görevler)...');
    
    const q = query(
      collection(db, "gelinler"),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        isim: doc.data().isim || "",
        tarih: doc.data().tarih || "",
        saat: doc.data().saat || "",
        makyaj: doc.data().makyaj || "",
        turban: doc.data().turban || "",
        yorumIstesinMi: doc.data().yorumIstesinMi || "",
        paylasimIzni: doc.data().paylasimIzni || false,
        yorumIstendiMi: doc.data().yorumIstendiMi || false,
      } as Gelin));

      console.log(`✅ ${data.length} gelin Firestore'dan yüklendi (Görevler, real-time)`);
      setGelinler(data);
    }, (error) => {
      console.error('❌ Firestore listener hatası (Görevler):', error);
    });

    return () => {
      console.log('🛑 Firestore gelinler listener kapatılıyor (Görevler)...');
      unsubscribe();
    };
  }, [user]);

  // Personelleri dinle
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "personnel"), orderBy("ad", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad || "",
        soyad: doc.data().soyad || "",
        email: doc.data().email || "",
        kullaniciTuru: doc.data().kullaniciTuru || "",
        firmalar: doc.data().firmalar || [],
        yonettigiFirmalar: doc.data().yonettigiFirmalar || []
      } as Personel));
      setPersoneller(data);
      
      // Kullanıcının rolünü ve firmalarını bul
      const currentUser = data.find(p => p.email === user.email);
      if (currentUser?.kullaniciTuru) {
        setUserRole(currentUser.kullaniciTuru);
      }
      if (currentUser?.yonettigiFirmalar) {
        setUserFirmalar(currentUser.yonettigiFirmalar);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Görevleri dinle
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "gorevler"),
      where("atanan", "==", user.email),
      orderBy("olusturulmaTarihi", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gorev));
      setGorevler(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Kurucu ve Yönetici için TÜM görevleri dinle
  useEffect(() => {
    if (!user || (userRole !== "Kurucu" && userRole !== "Yönetici")) return;

    const q = query(
      collection(db, "gorevler"),
      orderBy("olusturulmaTarihi", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gorev));
      setTumGorevler(data);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  // Otomatik Görev Oluşturma Kontrolü - Ayarlara Bağlı
  useEffect(() => {
    if (!user || gelinler.length === 0 || personeller.length === 0) return;

    const simdi = new Date();

    // Her görev türü için kontrol
    const gorevTurleri: ("yorumIstesinMi" | "paylasimIzni" | "yorumIstendiMi")[] = ["yorumIstesinMi", "paylasimIzni", "yorumIstendiMi"];

    gorevTurleri.forEach(gorevTuru => {
      const ayar = gorevAyarlari[gorevTuru];
      
      // Ayar aktif değilse veya başlangıç tarihi yoksa atla
      if (!ayar.aktif || !ayar.baslangicTarihi) return;

      const baslangicTarihi = new Date(ayar.baslangicTarihi);

      gelinler.forEach(async (gelin) => {
        const gelinTarih = new Date(gelin.tarih);
        
        // Başlangıç tarihinden önceki gelinleri atla
        if (gelinTarih < baslangicTarihi) return;

        // Alan dolu mu kontrol et
        let alanBos = false;
        if (gorevTuru === "yorumIstesinMi") {
          alanBos = !gelin.yorumIstesinMi || gelin.yorumIstesinMi.trim() === "";
        } else if (gorevTuru === "paylasimIzni") {
          alanBos = !gelin.paylasimIzni;
        } else if (gorevTuru === "yorumIstendiMi") {
          alanBos = !gelin.yorumIstendiMi;
        }

        if (!alanBos) return; // Alan doluysa atla

        const gelinSaat = gelin.saat?.split(":") || ["10", "00"];
        const gelinDateTime = new Date(gelin.tarih);
        gelinDateTime.setHours(parseInt(gelinSaat[0]), parseInt(gelinSaat[1]));
        
        // Bitiş saati: +4 saat
        const bitisSaati = new Date(gelinDateTime.getTime() + 4 * 60 * 60 * 1000);
        
        // Hatırlatma zamanı: Bitiş + ayardaki saat farkı
        const hatirlatmaZamani = new Date(bitisSaati.getTime() + ayar.saatFarki * 60 * 60 * 1000);

        // Yorum istendi mi için zaman kontrolü yok
        if (gorevTuru !== "yorumIstendiMi" && simdi < hatirlatmaZamani) return;

        // Makyajcı ve türbancıyı bul
        const makyajci = personeller.find(p => 
          p.ad.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR') ||
          `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR')
        );
        const turbanci = personeller.find(p => 
          p.ad.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR') ||
          `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR')
        );

        const ayniKisi = makyajci?.email === turbanci?.email;
        const kisiler: { email: string; ad: string; rol: string }[] = [];

        if (makyajci?.email) {
          kisiler.push({ email: makyajci.email, ad: `${makyajci.ad} ${makyajci.soyad}`, rol: "Makyaj" });
        }
        if (turbanci?.email && !ayniKisi) {
          kisiler.push({ email: turbanci.email, ad: `${turbanci.ad} ${turbanci.soyad}`, rol: "Türban" });
        }

        const gorevBasliklar: Record<string, string> = {
          yorumIstesinMi: "Yorum istensin mi alanını doldur",
          paylasimIzni: "Paylaşım izni alanını doldur",
          yorumIstendiMi: "Yorum istendi mi alanını doldur"
        };

        for (const kisi of kisiler) {
          // Bu gelin + bu kişi + bu tür için zaten görev var mı?
          const gorevlerRef = collection(db, "gorevler");
          const mevcutGorevQuery = query(
            gorevlerRef,
            where("gelinId", "==", gelin.id),
            where("atanan", "==", kisi.email),
            where("gorevTuru", "==", gorevTuru),
            where("otomatikMi", "==", true)
          );
          
          const mevcutSnapshot = await getDocs(mevcutGorevQuery);
          
          if (mevcutSnapshot.empty) {
            await addDoc(collection(db, "gorevler"), {
              baslik: `${gelin.isim} - ${gorevBasliklar[gorevTuru]}`,
              aciklama: `${gelin.isim} için "${gorevBasliklar[gorevTuru]}" alanı boş. Takvimden doldurun. (${kisi.rol})`,
              atayan: "Sistem",
              atayanAd: "Sistem (Otomatik)",
              atanan: kisi.email,
              atananAd: kisi.ad,
              durum: "bekliyor",
              oncelik: "yuksek",
              olusturulmaTarihi: serverTimestamp(),
              gelinId: gelin.id,
              otomatikMi: true,
              gorevTuru: gorevTuru
            });

            console.log(`✅ Otomatik görev oluşturuldu: ${gelin.isim} → ${kisi.ad} (${kisi.rol}) [${gorevTuru}]`);
          }
        }
      });
    });
  }, [user, gelinler, personeller, gorevAyarlari]);

  // Alan doldurulunca otomatik görevleri SİL
  useEffect(() => {
    if (!user || gelinler.length === 0 || gorevler.length === 0) return;

    gelinler.forEach(async (gelin) => {
      // Yorum istensin mi DOLUYSA
      if (gelin.yorumIstesinMi && gelin.yorumIstesinMi.trim() !== "") {
        const silinecekler = gorevler.filter(g => 
          g.gelinId === gelin.id && 
          g.otomatikMi === true &&
          g.gorevTuru === "yorumIstesinMi"
        );
        for (const gorev of silinecekler) {
          try {
            await deleteDoc(doc(db, "gorevler", gorev.id));
            console.log(`🗑️ Otomatik görev silindi: ${gelin.isim} [yorumIstesinMi]`);
          } catch (error) {
            console.error("Otomatik görev silinemedi:", error);
          }
        }
      }

      // Paylaşım izni DOLUYSA
      if (gelin.paylasimIzni === true) {
        const silinecekler = gorevler.filter(g => 
          g.gelinId === gelin.id && 
          g.otomatikMi === true &&
          g.gorevTuru === "paylasimIzni"
        );
        for (const gorev of silinecekler) {
          try {
            await deleteDoc(doc(db, "gorevler", gorev.id));
            console.log(`🗑️ Otomatik görev silindi: ${gelin.isim} [paylasimIzni]`);
          } catch (error) {
            console.error("Otomatik görev silinemedi:", error);
          }
        }
      }

      // Yorum istendi mi DOLUYSA
      if (gelin.yorumIstendiMi === true) {
        const silinecekler = gorevler.filter(g => 
          g.gelinId === gelin.id && 
          g.otomatikMi === true &&
          g.gorevTuru === "yorumIstendiMi"
        );
        for (const gorev of silinecekler) {
          try {
            await deleteDoc(doc(db, "gorevler", gorev.id));
            console.log(`🗑️ Otomatik görev silindi: ${gelin.isim} [yorumIstendiMi]`);
          } catch (error) {
            console.error("Otomatik görev silinemedi:", error);
          }
        }
      }
    });
  }, [user, gelinler, gorevler]);

  // Ekip personellerini hesapla (Yönetici için kendi ekibi, Kurucu için herkes)
  const ekipPersonelleri = personeller.filter(p => {
    if (userRole === "Kurucu") return true; // Kurucu herkesi görür
    if (userRole === "Yönetici" && userFirmalar.length > 0) {
      // Yönetici sadece kendi firmalarındaki personeli görür
      return p.firmalar?.some(f => userFirmalar.includes(f));
    }
    return false;
  });

  // Her personelin görev sayısını hesapla
  const personelGorevSayilari = ekipPersonelleri.map(p => ({
    ...p,
    gorevSayisi: tumGorevler.filter(g => g.atanan === p.email).length
  }));

  // Filtre uygula (sekme + durum filtresi + seçili personeller + alt sekme)
  useEffect(() => {
    let sonuc: Gorev[] = [];
    
    // Önce sekmeye göre filtrele
    if (aktifSekme === "tumgorevler") {
      sonuc = [...tumGorevler];
      
      // Seçili personellere göre filtrele
      if (seciliPersoneller.length > 0) {
        sonuc = sonuc.filter(g => seciliPersoneller.includes(g.atanan));
      }
    } else if (aktifSekme === "otomatik") {
      // Otomatik sekmede alt sekmeye göre filtrele
      sonuc = gorevler.filter(g => g.otomatikMi === true && g.gorevTuru === otomatikAltSekme);
    } else {
      sonuc = gorevler.filter(g => !g.otomatikMi);
    }
    
    // Sonra durum filtresini uygula
    if (filtre !== "hepsi") {
      sonuc = sonuc.filter(g => g.durum === filtre);
    }
    
    setFiltreliGorevler(sonuc);
  }, [gorevler, tumGorevler, filtre, aktifSekme, seciliPersoneller, otomatikAltSekme]);

  // Görev durumu değiştir
  const handleDurumDegistir = async (gorevId: string, yeniDurum: Gorev["durum"]) => {
    try {
      const updateData: any = { durum: yeniDurum };
      if (yeniDurum === "tamamlandi") {
        updateData.tamamlanmaTarihi = serverTimestamp();
      }
      await updateDoc(doc(db, "gorevler", gorevId), updateData);
    } catch (error) {
      console.error("Durum güncellenemedi:", error);
    }
  };

  // Görev Ayarı Senkronize Et
  const handleSenkronizeEt = async (gorevTuru: "yorumIstesinMi" | "paylasimIzni" | "yorumIstendiMi") => {
    const ayar = gorevAyarlari[gorevTuru];
    
    if (!ayar.baslangicTarihi) {
      alert("Lütfen başlangıç tarihi girin!");
      return;
    }

    if (!confirm(`${gorevTuru === "yorumIstesinMi" ? "Yorum İstensin Mi" : gorevTuru === "paylasimIzni" ? "Paylaşım İzni" : "Yorum İstendi Mi"} görevlerini senkronize etmek istediğinize emin misiniz?\n\n• ${ayar.baslangicTarihi} tarihinden önceki görevler silinecek\n• Bu tarihten sonraki gelinler için görev oluşturulacak`)) {
      return;
    }

    setSenkronizeLoading(gorevTuru);

    try {
      const baslangic = new Date(ayar.baslangicTarihi);
      const simdi = new Date();

      // 1. Bu tür görevleri al
      const gorevlerRef = collection(db, "gorevler");
      const q = query(gorevlerRef, where("gorevTuru", "==", gorevTuru), where("otomatikMi", "==", true));
      const snapshot = await getDocs(q);

      // 2. Başlangıç tarihinden önceki görevleri sil
      let silinenSayisi = 0;
      for (const gorevDoc of snapshot.docs) {
        const gorev = gorevDoc.data();
        if (gorev.gelinId) {
          const gelin = gelinler.find(g => g.id === gorev.gelinId);
          if (gelin && new Date(gelin.tarih) < baslangic) {
            await deleteDoc(doc(db, "gorevler", gorevDoc.id));
            silinenSayisi++;
          }
        }
      }

      // 3. Başlangıç tarihinden sonraki gelinler için görev oluştur
      let olusturulanSayisi = 0;
      for (const gelin of gelinler) {
        const gelinTarih = new Date(gelin.tarih);
        if (gelinTarih < baslangic) continue; // Tarihten önceki gelinleri atla

        // Gelin bitmiş mi kontrol et
        const gelinSaat = gelin.saat.split(":");
        const gelinDateTime = new Date(gelin.tarih);
        gelinDateTime.setHours(parseInt(gelinSaat[0]), parseInt(gelinSaat[1]));
        const bitisSaati = new Date(gelinDateTime.getTime() + 4 * 60 * 60 * 1000);
        const hatirlatmaZamani = new Date(bitisSaati.getTime() + ayar.saatFarki * 60 * 60 * 1000);

        // Yorum istendi mi için hatırlatma zamanı kontrolü yok
        if (gorevTuru !== "yorumIstendiMi" && simdi < hatirlatmaZamani) continue;

        // Alan boş mu kontrol et
        let alanBos = false;
        if (gorevTuru === "yorumIstesinMi") {
          alanBos = !gelin.yorumIstesinMi || gelin.yorumIstesinMi.trim() === "";
        } else if (gorevTuru === "paylasimIzni") {
          alanBos = !gelin.paylasimIzni;
        } else if (gorevTuru === "yorumIstendiMi") {
          alanBos = !gelin.yorumIstendiMi;
        }

        if (!alanBos) continue; // Alan doluysa atla

        // Bu gelin için bu türde görev var mı?
        const mevcutGorevQuery = query(
          gorevlerRef,
          where("gelinId", "==", gelin.id),
          where("gorevTuru", "==", gorevTuru),
          where("otomatikMi", "==", true)
        );
        const mevcutSnapshot = await getDocs(mevcutGorevQuery);
        if (!mevcutSnapshot.empty) continue; // Zaten görev var

        // Makyajcı ve türbancıyı bul
        const makyajci = personeller.find(p => 
          p.ad.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR') ||
          `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR')
        );
        const turbanci = personeller.find(p => 
          p.ad.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR') ||
          `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR')
        );

        const ayniKisi = makyajci?.email === turbanci?.email;
        const kisiler: { email: string; ad: string; rol: string }[] = [];

        if (makyajci?.email) {
          kisiler.push({ email: makyajci.email, ad: `${makyajci.ad} ${makyajci.soyad}`, rol: "Makyaj" });
        }
        if (turbanci?.email && !ayniKisi) {
          kisiler.push({ email: turbanci.email, ad: `${turbanci.ad} ${turbanci.soyad}`, rol: "Türban" });
        }

        const gorevBaslik = gorevTuru === "yorumIstesinMi" 
          ? "Yorum istensin mi alanını doldur"
          : gorevTuru === "paylasimIzni"
          ? "Paylaşım izni alanını doldur"
          : "Yorum istendi mi alanını doldur";

        for (const kisi of kisiler) {
          // Kişi bazlı kontrol
          const kisiGorevQuery = query(
            gorevlerRef,
            where("gelinId", "==", gelin.id),
            where("atanan", "==", kisi.email),
            where("gorevTuru", "==", gorevTuru),
            where("otomatikMi", "==", true)
          );
          const kisiSnapshot = await getDocs(kisiGorevQuery);
          if (!kisiSnapshot.empty) continue;

          await addDoc(gorevlerRef, {
            baslik: `${gelin.isim} - ${gorevBaslik}`,
            aciklama: `${gelin.isim} için "${gorevBaslik}" alanı boş. Takvimden doldurun. (${kisi.rol})`,
            atayan: "Sistem",
            atayanAd: "Sistem (Otomatik)",
            atanan: kisi.email,
            atananAd: kisi.ad,
            durum: "bekliyor",
            oncelik: "yuksek",
            olusturulmaTarihi: serverTimestamp(),
            gelinId: gelin.id,
            otomatikMi: true,
            gorevTuru: gorevTuru
          });
          olusturulanSayisi++;
        }
      }

      // 4. Ayarları kaydet
      const yeniAyarlar = {
        ...gorevAyarlari,
        [gorevTuru]: { ...ayar, aktif: true }
      };
      await setDoc(doc(db, "settings", "gorevAyarlari"), yeniAyarlar);
      setGorevAyarlari(yeniAyarlar);

      alert(`✅ Senkronizasyon tamamlandı!\n\n• ${silinenSayisi} görev silindi\n• ${olusturulanSayisi} yeni görev oluşturuldu`);
    } catch (error) {
      console.error("Senkronizasyon hatası:", error);
      alert("❌ Senkronizasyon sırasında hata oluştu!");
    } finally {
      setSenkronizeLoading(null);
    }
  };

  // Görev Ayarı Pasifleştir
  const handlePasifEt = async (gorevTuru: "yorumIstesinMi" | "paylasimIzni" | "yorumIstendiMi") => {
    if (!confirm("Bu görev türünü pasifleştirmek istediğinize emin misiniz? Mevcut görevler silinmeyecek.")) return;

    try {
      const yeniAyarlar = {
        ...gorevAyarlari,
        [gorevTuru]: { ...gorevAyarlari[gorevTuru], aktif: false }
      };
      await setDoc(doc(db, "settings", "gorevAyarlari"), yeniAyarlar);
      setGorevAyarlari(yeniAyarlar);
      alert("✅ Görev türü pasifleştirildi!");
    } catch (error) {
      console.error("Pasifleştirme hatası:", error);
    }
  };

  // Görev sil
  const handleGorevSil = async (gorevId: string) => {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, "gorevler", gorevId));
    } catch (error) {
      console.error("Görev silinemedi:", error);
    }
  };

  const oncelikRenk = (oncelik: string) => {
    switch (oncelik) {
      case "acil": return "border-red-500 bg-red-50";
      case "yuksek": return "border-orange-500 bg-orange-50";
      case "normal": return "border-blue-500 bg-blue-50";
      case "dusuk": return "border-stone-500 bg-stone-50";
      default: return "border-stone-300 bg-white";
    }
  };

  const durumBadge = (durum: string) => {
    switch (durum) {
      case "bekliyor": return "bg-yellow-100 text-yellow-800";
      case "devam-ediyor": return "bg-blue-100 text-blue-800";
      case "tamamlandi": return "bg-green-100 text-green-800";
      case "iptal": return "bg-stone-100 text-stone-800";
      default: return "bg-stone-100 text-stone-800";
    }
  };

  const durumEmojiyon = (durum: string) => {
    switch (durum) {
      case "bekliyor": return "⏳";
      case "devam-ediyor": return "🔄";
      case "tamamlandi": return "✅";
      case "iptal": return "❌";
      default: return "📋";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <Sidebar user={user} />
      <div className="flex-1 md:ml-56">
        <header className="bg-white shadow-sm sticky top-0 z-10 border-b border-stone-200">
          <div className="px-4 md:px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg md:text-xl font-bold text-stone-800">✅ Görevler</h1>
            
            {/* Kurucu için Ayarlar Butonu */}
            {userRole === "Kurucu" && (
              <button
                onClick={() => setShowAyarlar(!showAyarlar)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  showAyarlar 
                    ? "bg-stone-800 text-white" 
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                ⚙️ Görev Ayarları
              </button>
            )}
          </div>
          
          {/* Ana Sekmeler */}
          <div className="px-4 md:px-6 flex gap-1 border-t border-stone-100 overflow-x-auto">
            <button
              onClick={() => { setAktifSekme("gorevlerim"); setFiltre("hepsi"); }}
              className={`px-4 py-2.5 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                aktifSekme === "gorevlerim"
                  ? "border-amber-500 text-amber-600 bg-amber-50/50"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              📋 Görevlerim
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                aktifSekme === "gorevlerim" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-500"
              }`}>
                {gorevler.filter(g => !g.otomatikMi).length}
              </span>
            </button>
            <button
              onClick={() => { setAktifSekme("otomatik"); setFiltre("hepsi"); }}
              className={`px-4 py-2.5 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                aktifSekme === "otomatik"
                  ? "border-purple-500 text-purple-600 bg-purple-50/50"
                  : "border-transparent text-stone-500 hover:text-stone-700"
              }`}
            >
              🤖 Otomatik Görevler
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                aktifSekme === "otomatik" ? "bg-purple-100 text-purple-700" : "bg-stone-100 text-stone-500"
              }`}>
                {gorevler.filter(g => g.otomatikMi === true).length}
              </span>
            </button>
            
            {/* Kurucu ve Yönetici için Ekip Görevleri sekmesi */}
            {(userRole === "Kurucu" || userRole === "Yönetici") && (
              <button
                onClick={() => { setAktifSekme("tumgorevler"); setFiltre("hepsi"); setSeciliPersoneller([]); }}
                className={`px-4 py-2.5 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                  aktifSekme === "tumgorevler"
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                {userRole === "Kurucu" ? "👑" : "👥"} Ekip Görevleri
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  aktifSekme === "tumgorevler" ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"
                }`}>
                  {tumGorevler.length}
                </span>
              </button>
            )}
          </div>
        </header>

        <main className="p-4 md:p-6">
          {/* Görev Ayarları Paneli - Sadece Kurucu */}
          {showAyarlar && userRole === "Kurucu" && (
            <div className="mb-6 bg-white rounded-lg border-2 border-stone-300 shadow-lg overflow-hidden">
              <div className="bg-stone-800 text-white px-4 py-3 flex items-center justify-between">
                <h2 className="font-bold">⚙️ Otomatik Görev Ayarları</h2>
                <button onClick={() => setShowAyarlar(false)} className="text-stone-300 hover:text-white">✕</button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Yorum İstensin Mi */}
                <div className={`p-4 rounded-lg border-2 ${gorevAyarlari.yorumIstesinMi.aktif ? "border-green-400 bg-green-50" : "border-stone-200 bg-stone-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-stone-800">📝 Yorum İstensin Mi</h3>
                      <p className="text-xs text-stone-500">Gelin bitişinden +1 saat sonra hatırlatma</p>
                    </div>
                    {gorevAyarlari.yorumIstesinMi.aktif && (
                      <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">✓ Aktif</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-stone-600">Başlangıç:</label>
                      <input
                        type="date"
                        value={gorevAyarlari.yorumIstesinMi.baslangicTarihi}
                        onChange={(e) => setGorevAyarlari({
                          ...gorevAyarlari,
                          yorumIstesinMi: { ...gorevAyarlari.yorumIstesinMi, baslangicTarihi: e.target.value }
                        })}
                        className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSenkronizeEt("yorumIstesinMi")}
                      disabled={senkronizeLoading === "yorumIstesinMi"}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {senkronizeLoading === "yorumIstesinMi" ? "⏳ İşleniyor..." : "🔄 Aktifleştir & Senkronize Et"}
                    </button>
                    {gorevAyarlari.yorumIstesinMi.aktif && (
                      <button
                        onClick={() => handlePasifEt("yorumIstesinMi")}
                        className="px-3 py-1.5 bg-stone-400 text-white rounded-lg text-sm hover:bg-stone-500"
                      >
                        Pasifleştir
                      </button>
                    )}
                  </div>
                </div>

                {/* Paylaşım İzni */}
                <div className={`p-4 rounded-lg border-2 ${gorevAyarlari.paylasimIzni.aktif ? "border-green-400 bg-green-50" : "border-stone-200 bg-stone-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-stone-800">📸 Paylaşım İzni Var Mı</h3>
                      <p className="text-xs text-stone-500">Gelin bitişinden +2 saat sonra hatırlatma</p>
                    </div>
                    {gorevAyarlari.paylasimIzni.aktif && (
                      <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">✓ Aktif</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-stone-600">Başlangıç:</label>
                      <input
                        type="date"
                        value={gorevAyarlari.paylasimIzni.baslangicTarihi}
                        onChange={(e) => setGorevAyarlari({
                          ...gorevAyarlari,
                          paylasimIzni: { ...gorevAyarlari.paylasimIzni, baslangicTarihi: e.target.value }
                        })}
                        className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSenkronizeEt("paylasimIzni")}
                      disabled={senkronizeLoading === "paylasimIzni"}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {senkronizeLoading === "paylasimIzni" ? "⏳ İşleniyor..." : "🔄 Aktifleştir & Senkronize Et"}
                    </button>
                    {gorevAyarlari.paylasimIzni.aktif && (
                      <button
                        onClick={() => handlePasifEt("paylasimIzni")}
                        className="px-3 py-1.5 bg-stone-400 text-white rounded-lg text-sm hover:bg-stone-500"
                      >
                        Pasifleştir
                      </button>
                    )}
                  </div>
                </div>

                {/* Yorum İstendi Mi */}
                <div className={`p-4 rounded-lg border-2 ${gorevAyarlari.yorumIstendiMi.aktif ? "border-green-400 bg-green-50" : "border-stone-200 bg-stone-50"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-stone-800">💬 Yorum İstendi Mi</h3>
                      <p className="text-xs text-stone-500">Hatırlatma yok - Sadece görev listesinde görünür</p>
                    </div>
                    {gorevAyarlari.yorumIstendiMi.aktif && (
                      <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full">✓ Aktif</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-stone-600">Başlangıç:</label>
                      <input
                        type="date"
                        value={gorevAyarlari.yorumIstendiMi.baslangicTarihi}
                        onChange={(e) => setGorevAyarlari({
                          ...gorevAyarlari,
                          yorumIstendiMi: { ...gorevAyarlari.yorumIstendiMi, baslangicTarihi: e.target.value }
                        })}
                        className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      onClick={() => handleSenkronizeEt("yorumIstendiMi")}
                      disabled={senkronizeLoading === "yorumIstendiMi"}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                    >
                      {senkronizeLoading === "yorumIstendiMi" ? "⏳ İşleniyor..." : "🔄 Aktifleştir & Senkronize Et"}
                    </button>
                    {gorevAyarlari.yorumIstendiMi.aktif && (
                      <button
                        onClick={() => handlePasifEt("yorumIstendiMi")}
                        className="px-3 py-1.5 bg-stone-400 text-white rounded-lg text-sm hover:bg-stone-500"
                      >
                        Pasifleştir
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-stone-500 mt-2">
                  ℹ️ Senkronize Et: Seçilen tarihten önceki görevleri siler, sonraki gelinler için otomatik görev oluşturur.
                </p>
              </div>
            </div>
          )}

          {/* Otomatik sekmede alt sekmeler */}
          {aktifSekme === "otomatik" && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setOtomatikAltSekme("yorumIstesinMi")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    otomatikAltSekme === "yorumIstesinMi"
                      ? "bg-purple-500 text-white"
                      : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  📝 Yorum İstensin Mi
                  <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                    {gorevler.filter(g => g.otomatikMi && g.gorevTuru === "yorumIstesinMi").length}
                  </span>
                </button>
                <button
                  onClick={() => setOtomatikAltSekme("paylasimIzni")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    otomatikAltSekme === "paylasimIzni"
                      ? "bg-blue-500 text-white"
                      : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  📸 Paylaşım İzni
                  <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {gorevler.filter(g => g.otomatikMi && g.gorevTuru === "paylasimIzni").length}
                  </span>
                </button>
                <button
                  onClick={() => setOtomatikAltSekme("yorumIstendiMi")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    otomatikAltSekme === "yorumIstendiMi"
                      ? "bg-amber-500 text-white"
                      : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  💬 Yorum İstenecekler
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                    {gorevler.filter(g => g.otomatikMi && g.gorevTuru === "yorumIstendiMi").length}
                  </span>
                </button>
              </div>
              
              <div className={`p-3 rounded-lg border ${
                otomatikAltSekme === "yorumIstesinMi" ? "bg-purple-50 border-purple-200" :
                otomatikAltSekme === "paylasimIzni" ? "bg-blue-50 border-blue-200" :
                "bg-amber-50 border-amber-200"
              }`}>
                <p className={`text-sm ${
                  otomatikAltSekme === "yorumIstesinMi" ? "text-purple-800" :
                  otomatikAltSekme === "paylasimIzni" ? "text-blue-800" :
                  "text-amber-800"
                }`}>
                  {otomatikAltSekme === "yorumIstesinMi" && (
                    <>
                      <span className="font-medium">📝 Yorum İstensin Mi görevleri</span>
                      <br />
                      <span className="text-xs opacity-75">Gelin bitişinden 1 saat sonra oluşturulur. Alan doldurulunca otomatik silinir.</span>
                    </>
                  )}
                  {otomatikAltSekme === "paylasimIzni" && (
                    <>
                      <span className="font-medium">📸 Paylaşım İzni görevleri</span>
                      <br />
                      <span className="text-xs opacity-75">Gelin bitişinden 2 saat sonra oluşturulur. Alan doldurulunca otomatik silinir.</span>
                    </>
                  )}
                  {otomatikAltSekme === "yorumIstendiMi" && (
                    <>
                      <span className="font-medium">💬 Yorum İstenecekler listesi</span>
                      <br />
                      <span className="text-xs opacity-75">Hatırlatma yapılmaz. Yorum istenip istenmediğini takip etmek için.</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
          
          {/* Tüm Görevler sekmesinde açıklama ve personel seçimi */}
          {aktifSekme === "tumgorevler" && (
            <div className="mb-4 space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-sm text-emerald-800">
                  <span className="font-medium">{userRole === "Kurucu" ? "👑" : "👥"} {userRole === "Kurucu" ? "Tüm personelin" : "Ekibinizin"} görevlerini görüntülüyorsunuz.</span>
                  <br />
                  <span className="text-xs text-emerald-600">Personel seçerek filtreleyebilirsiniz.</span>
                </p>
              </div>
              
              {/* Personel Checkbox'ları */}
              <div className="bg-white rounded-lg border border-stone-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-stone-600">👤 Personel Filtresi</p>
                  {seciliPersoneller.length > 0 && (
                    <button 
                      onClick={() => setSeciliPersoneller([])}
                      className="text-xs text-emerald-600 hover:text-emerald-800"
                    >
                      Temizle
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {personelGorevSayilari.map(p => (
                    <label
                      key={p.id}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition text-sm ${
                        seciliPersoneller.includes(p.email)
                          ? "bg-emerald-100 border-2 border-emerald-400 text-emerald-800"
                          : "bg-stone-50 border border-stone-200 text-stone-700 hover:bg-stone-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={seciliPersoneller.includes(p.email)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSeciliPersoneller([...seciliPersoneller, p.email]);
                          } else {
                            setSeciliPersoneller(seciliPersoneller.filter(email => email !== p.email));
                          }
                        }}
                        className="sr-only"
                      />
                      <span className="font-medium">{p.ad} {p.soyad}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                        seciliPersoneller.includes(p.email)
                          ? "bg-emerald-200 text-emerald-800"
                          : "bg-stone-200 text-stone-600"
                      }`}>
                        {p.gorevSayisi}
                      </span>
                    </label>
                  ))}
                </div>
                {seciliPersoneller.length > 0 && (
                  <p className="text-xs text-stone-500 mt-2">
                    {seciliPersoneller.length} personel seçili • {filtreliGorevler.length} görev gösteriliyor
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Filtre Butonları */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setFiltre("hepsi")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filtre === "hepsi"
                  ? aktifSekme === "otomatik" ? "bg-purple-500 text-white" 
                    : aktifSekme === "tumgorevler" ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              Hepsi ({
                aktifSekme === "tumgorevler" ? tumGorevler.length 
                : aktifSekme === "otomatik" ? gorevler.filter(g => g.otomatikMi).length 
                : gorevler.filter(g => !g.otomatikMi).length
              })
            </button>
            <button
              onClick={() => setFiltre("bekliyor")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filtre === "bekliyor"
                  ? aktifSekme === "otomatik" ? "bg-purple-500 text-white" 
                    : aktifSekme === "tumgorevler" ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              ⏳ Bekliyor
            </button>
            <button
              onClick={() => setFiltre("devam-ediyor")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filtre === "devam-ediyor"
                  ? aktifSekme === "otomatik" ? "bg-purple-500 text-white" 
                    : aktifSekme === "tumgorevler" ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              🔄 Devam Ediyor
            </button>
            <button
              onClick={() => setFiltre("tamamlandi")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filtre === "tamamlandi"
                  ? aktifSekme === "otomatik" ? "bg-purple-500 text-white" 
                    : aktifSekme === "tumgorevler" ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              ✅ Tamamlandı
            </button>
          </div>

          {/* Görev Listesi */}
          <div className="space-y-4">
            {filtreliGorevler.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-stone-100">
                <span className="text-6xl">📋</span>
                <p className="text-stone-500 mt-4">Henüz görev yok</p>
              </div>
            ) : (
              filtreliGorevler.map((gorev) => (
                <div
                  key={gorev.id}
                  className={`bg-white rounded-lg shadow-sm border-2 p-4 md:p-5 transition hover:shadow-md ${oncelikRenk(gorev.oncelik)}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Başlık + Otomatik Badge */}
                      <div className="flex items-start gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-stone-800 flex-1">{gorev.baslik}</h3>
                        {gorev.otomatikMi && (
                          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium shrink-0">
                            🤖 Otomatik
                          </span>
                        )}
                      </div>

                      {/* Açıklama */}
                      <p className="text-sm text-stone-600 mb-3">{gorev.aciklama}</p>

                      {/* Meta Bilgiler */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
                        {/* Tüm Görevler sekmesinde atanan kişiyi göster */}
                        {aktifSekme === "tumgorevler" && (
                          <div className="flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full">
                            <span>🎯</span>
                            <span className="font-medium text-emerald-700">Atanan: {gorev.atananAd}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>👤</span>
                          <span>
                            {gorev.atayan === "Sistem" ? (
                              <span className="font-medium text-purple-600">Sistem (Otomatik)</span>
                            ) : (
                              <span>Atayan: {gorev.atayanAd}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span>{gorev.olusturulmaTarihi?.toDate?.().toLocaleDateString('tr-TR')}</span>
                        </div>
                        {gorev.gelinId && (
                          <div className="flex items-center gap-1">
                            <span>💄</span>
                            <span className="text-rose-600">Gelin görevi</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Durum Badge */}
                    <div className="shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${durumBadge(gorev.durum)}`}>
                        {durumEmojiyon(gorev.durum)} {gorev.durum.charAt(0).toUpperCase() + gorev.durum.slice(1).replace("-", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Otomatik görevlerde gelin bilgisi - tıklanabilir */}
                  {gorev.otomatikMi && gorev.gelinId && (
                    <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-xs text-purple-600 mb-1">📅 Gelin Bilgisi:</p>
                      {(() => {
                        const gelin = gelinler.find(g => g.id === gorev.gelinId);
                        if (!gelin) return <p className="text-xs text-stone-500">Gelin bulunamadı</p>;
                        return (
                          <a 
                            href={`/takvim`}
                            onClick={(e) => {
                              e.preventDefault();
                              // Takvime yönlendir - gelin tarihini localStorage'a kaydet
                              localStorage.setItem('scrollToGelin', JSON.stringify({ id: gelin.id, tarih: gelin.tarih }));
                              window.location.href = '/takvim';
                            }}
                            className="flex items-center gap-3 hover:bg-purple-100 p-2 rounded-lg transition cursor-pointer"
                          >
                            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center text-lg">
                              💍
                            </div>
                            <div>
                              <p className="font-medium text-purple-800">{gelin.isim}</p>
                              <p className="text-xs text-purple-600">
                                📆 {new Date(gelin.tarih).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • 🕐 {gelin.saat}
                              </p>
                            </div>
                            <span className="ml-auto text-purple-400">→</span>
                          </a>
                        );
                      })()}
                    </div>
                  )}

                  {/* Aksiyon Butonları - SADECE OTOMATİK OLMAYAN GÖREVLER İÇİN */}
                  {!gorev.otomatikMi && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {gorev.durum === "bekliyor" && (
                        <button
                          onClick={() => handleDurumDegistir(gorev.id, "devam-ediyor")}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition"
                        >
                          🔄 Başla
                        </button>
                      )}
                      {gorev.durum === "devam-ediyor" && (
                        <button
                          onClick={() => handleDurumDegistir(gorev.id, "tamamlandi")}
                          className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition"
                        >
                          ✅ Tamamla
                        </button>
                      )}
                      {gorev.durum !== "tamamlandi" && (
                        <button
                          onClick={() => handleDurumDegistir(gorev.id, "iptal")}
                          className="px-4 py-2 bg-stone-400 text-white rounded-lg text-sm font-medium hover:bg-stone-500 transition"
                        >
                          ❌ İptal Et
                        </button>
                      )}
                      <button
                        onClick={() => handleGorevSil(gorev.id)}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition"
                      >
                        🗑️ Sil
                      </button>
                    </div>
                  )}
                  
                  {/* Otomatik görevlerde bilgi notu */}
                  {gorev.otomatikMi && (
                    <div className="mt-3 text-xs text-purple-500 italic">
                      ℹ️ Bu görev, takvimde "Yorum istensin mi" alanı doldurulunca otomatik olarak silinecek.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}