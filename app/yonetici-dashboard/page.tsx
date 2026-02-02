"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, orderBy, Timestamp, addDoc, updateDoc, doc, serverTimestamp, increment } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  sicilNo: string;
  kullaniciTuru: string;
  firmalar?: string[]; // Çoklu firma
  yonettigiFirmalar?: string[];
  aktif: boolean;
  grupEtiketleri: string[];
}

interface Firma {
  id: string;
  firmaAdi: string;
  kisaltma: string;
  renk: string;
}

interface IzinTalebi {
  id: string;
  personelId: string;
  personelAd: string;
  personelSoyad: string;
  izinTuru: string;
  baslangic: string;
  bitis: string;
  gunSayisi: number;
  aciklama?: string;
  talepTarihi: string;
  durum: "Beklemede" | "Onaylandı" | "Reddedildi";
}

interface Gelin {
  id: string;
  isim: string;
  tarih: string;
  makyaj: string;
  turban: string;
  anlasildigiTarih: string;
}

interface AttendanceRecord {
  id: string;
  personelId: string;
  personelAd: string;
  tarih: string;
  girisSaati: string;
  cikisSaati: string | null;
}

interface EkipUyesi extends Personel {
  buAyGelinSayisi: number;
  toplamGelinSayisi: number;
  buHaftaCalismaGun: number;
  buHaftaCalismadakika: number;
}

interface Gorev {
  id: string;
  baslik: string;
  aciklama: string;
  atayan: string;
  atayanAd: string;
  atanan: string;
  atananAd: string;
  durum: "bekliyor" | "devam-ediyor" | "tamamlandi" | "iptal";
  oncelik: "dusuk" | "normal" | "yuksek" | "acil";
  olusturulmaTarihi: string;
  tamamlanmaTarihi?: string;
  gelinId?: string;
}

export default function YoneticiDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [currentPersonel, setCurrentPersonel] = useState<Personel | null>(null);
  const [loading, setLoading] = useState(true);
  const [yetkisiz, setYetkisiz] = useState(false);
  const [ekipUyeleri, setEkipUyeleri] = useState<EkipUyesi[]>([]);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [izinTalepleri, setIzinTalepleri] = useState<IzinTalebi[]>([]);
  const [allPersoneller, setAllPersoneller] = useState<Personel[]>([]);
  
  // Görev yönetimi state'leri
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [gorevModalOpen, setGorevModalOpen] = useState(false);
  const [seciliPersonel, setSeciliPersonel] = useState<EkipUyesi | null>(null);
  const [gorevFormu, setGorevFormu] = useState({
    baslik: "",
    aciklama: "",
    oncelik: "normal" as "dusuk" | "normal" | "yuksek" | "acil"
  });
  const [gorevKaydediliyor, setGorevKaydediliyor] = useState(false);
  
  const router = useRouter();

  const bugun = new Date().toISOString().split('T')[0];
  const buAy = new Date().toISOString().slice(0, 7);
  
  // Bu haftanın başlangıç ve bitiş tarihleri
  const haftaBasi = new Date();
  const gun = haftaBasi.getDay();
  const fark = gun === 0 ? -6 : 1 - gun;
  haftaBasi.setDate(haftaBasi.getDate() + fark);
  const haftaSonu = new Date(haftaBasi);
  haftaSonu.setDate(haftaBasi.getDate() + 6);
  const haftaBasiStr = haftaBasi.toISOString().split('T')[0];
  const haftaSonuStr = haftaSonu.toISOString().split('T')[0];

  // Auth ve yetki kontrolü
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        
        // Kullanıcının bilgilerini çek
        const q = query(
          collection(db, "personnel"),
          where("email", "==", user.email)
        );
        
        const unsubPersonel = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            setCurrentPersonel({ id: snapshot.docs[0].id, ...data } as Personel);
            
            const isYonetici = data.kullaniciTuru === "Yönetici" || data.kullaniciTuru === "Kurucu";
            
            if (!isYonetici) {
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

  // Firmaları çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "companies"), orderBy("firmaAdi", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Firma));
      setFirmalar(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Tüm personelleri çek (firma bazlı filtreleme için)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "personnel"), orderBy("ad", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Personel));
      setAllPersoneller(data);
    });
    return () => unsubscribe();
  }, [user]);

  // İzin taleplerini çek
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "izinTalepleri"),
      where("durum", "==", "Beklemede"),
      orderBy("talepTarihi", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as IzinTalebi));
      setIzinTalepleri(data);
    });
    return () => unsubscribe();
  }, [user]);

  // ✅ Gelinler - Firestore'dan (real-time) - APPS SCRIPT YERİNE!
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Firestore gelinler listener başlatılıyor (Yönetici Dashboard)...');
    
    const q = query(
      collection(db, "gelinler"),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        isim: doc.data().isim || "",
        tarih: doc.data().tarih || "",
        makyaj: doc.data().makyaj || "",
        turban: doc.data().turban || "",
        anlasildigiTarih: doc.data().anlasildigiTarih || "",
      } as Gelin));

      console.log(`✅ ${data.length} gelin Firestore'dan yüklendi (Yönetici Dashboard, real-time)`);
      setGelinler(data);
      setDataLoading(false);
    }, (error) => {
      console.error('❌ Firestore listener hatası (Yönetici Dashboard):', error);
      setDataLoading(false);
    });

    return () => {
      console.log('🛑 Firestore gelinler listener kapatılıyor (Yönetici Dashboard)...');
      unsubscribe();
    };
  }, [user]);

  // Ekip üyelerini ve metriklerini hesapla (firma bazlı)
  useEffect(() => {
    if (!user || !currentPersonel || allPersoneller.length === 0) return;

    // Kurucu tüm personelleri görür, Yönetici sadece kendi firmalarını
    const isKurucu = currentPersonel.kullaniciTuru === "Kurucu";
    const yonettigiFirmalar = currentPersonel.yonettigiFirmalar || [];
    
    // Personelleri filtrele
    const personelList = allPersoneller.filter(p => {
      if (!p.aktif || p.id === currentPersonel.id) return false;
      if (isKurucu) return true; // Kurucu herkesi görür
      // Yönetici: personelin firmalarından herhangi biri yöneticinin sorumlu olduğu firmalarda mı?
      return p.firmalar?.some(f => yonettigiFirmalar.includes(f)) || false;
    });

    // Her personel için metrikleri hesapla
    const ekipData: EkipUyesi[] = personelList.map(personel => {
      // Gelin sayıları
      const personelGelinler = gelinler.filter(g => 
        g.makyaj === `${personel.ad} ${personel.soyad}` || 
        g.turban === `${personel.ad} ${personel.soyad}`
      );
      
      const buAyGelinler = personelGelinler.filter(g => 
        g.anlasildigiTarih && g.anlasildigiTarih.startsWith(buAy)
      );

      // Çalışma saatleri (bu hafta)
      const personelAttendance = attendanceData.filter(a => 
        a.personelId === personel.id &&
        a.tarih >= haftaBasiStr &&
        a.tarih <= haftaSonuStr
      );

      const buHaftaCalismaGun = personelAttendance.length;
      const buHaftaCalismadakika = personelAttendance.reduce((total, a) => {
        if (a.girisSaati && a.cikisSaati) {
          const giris = new Date(`2000-01-01T${a.girisSaati}`);
          const cikis = new Date(`2000-01-01T${a.cikisSaati}`);
          const fark = (cikis.getTime() - giris.getTime()) / 1000 / 60;
          return total + (fark > 0 ? fark : 0);
        }
        return total;
      }, 0);

      return {
        ...personel,
        buAyGelinSayisi: buAyGelinler.length,
        toplamGelinSayisi: personelGelinler.length,
        buHaftaCalismaGun,
        buHaftaCalismadakika
      };
    });

    setEkipUyeleri(ekipData);
  }, [user, currentPersonel, allPersoneller, gelinler, attendanceData, buAy, haftaBasiStr, haftaSonuStr]);

  // Firma bazlı bekleyen izin talepleri
  const bekleyenIzinTalepleri = izinTalepleri.filter(talep => {
    const personel = allPersoneller.find(p => p.id === talep.personelId);
    if (!personel || !currentPersonel) return false;
    if (currentPersonel.kullaniciTuru === "Kurucu") return true; // Kurucu tüm talepleri görür
    const yonettigiFirmalar = currentPersonel.yonettigiFirmalar || [];
    return personel.firmalar?.some(f => yonettigiFirmalar.includes(f)) || false;
  });

  // İzin talebini onayla
  const handleIzinOnayla = async (talep: IzinTalebi) => {
    if (!confirm(`${talep.personelAd} ${talep.personelSoyad} için izin talebini onaylamak istediğinize emin misiniz?`)) return;
    
    try {
      await updateDoc(doc(db, "izinTalepleri", talep.id), {
        durum: "Onaylandı",
        onaylayanId: user?.uid,
        onayTarihi: new Date().toISOString()
      });
      
      // İzin kaydını oluştur
      await addDoc(collection(db, "izinler"), {
        personelId: talep.personelId,
        personelAd: talep.personelAd,
        personelSoyad: talep.personelSoyad,
        izinTuru: talep.izinTuru,
        baslangic: talep.baslangic,
        bitis: talep.bitis,
        gunSayisi: talep.gunSayisi,
        aciklama: talep.aciklama || "",
        onaylayanId: user?.uid,
        olusturulmaTarihi: new Date().toISOString()
      });
      
      alert("✅ İzin talebi onaylandı!");
    } catch (error) {
      console.error("İzin onaylama hatası:", error);
      alert("İzin onaylanırken bir hata oluştu!");
    }
  };

  // İzin talebini reddet
  const handleIzinReddet = async (talep: IzinTalebi) => {
    const sebep = prompt("Red sebebini yazın (opsiyonel):");
    if (sebep === null) return; // İptal edildi
    
    try {
      await updateDoc(doc(db, "izinTalepleri", talep.id), {
        durum: "Reddedildi",
        reddedilmeSebebi: sebep || "",
        reddedenId: user?.uid,
        redTarihi: new Date().toISOString()
      });
      
      alert("İzin talebi reddedildi.");
    } catch (error) {
      console.error("İzin reddetme hatası:", error);
      alert("İzin reddedilirken bir hata oluştu!");
    }
  };

  // Attendance verilerini çek (bu hafta)
  useEffect(() => {
    const qAttendance = query(
      collection(db, "attendance"),
      where("tarih", ">=", haftaBasiStr),
      where("tarih", "<=", haftaSonuStr),
      orderBy("tarih", "desc")
    );

    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const data: AttendanceRecord[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AttendanceRecord));
      
      setAttendanceData(data);
    });

    return () => unsubAttendance();
  }, [haftaBasiStr, haftaSonuStr]);

  // Görevleri dinle (yöneticinin atadığı görevler)
  useEffect(() => {
    if (!user) return;

    const qGorevler = query(
      collection(db, "gorevler"),
      where("atayan", "==", user.uid),
      orderBy("olusturulmaTarihi", "desc")
    );

    const unsubGorevler = onSnapshot(qGorevler, (snapshot) => {
      const data: Gorev[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gorev));
      
      setGorevler(data);
    });

    return () => unsubGorevler();
  }, [user]);

  // Ekip toplam istatistikleri
  const ekipIstatistikleri = {
    toplamGelin: ekipUyeleri.reduce((sum, e) => sum + e.buAyGelinSayisi, 0),
    ortalamaGelin: ekipUyeleri.length > 0 ? Math.round(ekipUyeleri.reduce((sum, e) => sum + e.buAyGelinSayisi, 0) / ekipUyeleri.length) : 0,
    enCokHazırlayan: ekipUyeleri.length > 0 ? ekipUyeleri.reduce((prev, current) => 
      (prev.buAyGelinSayisi > current.buAyGelinSayisi) ? prev : current
    ) : null,
    toplamCalismaSaat: Math.round(ekipUyeleri.reduce((sum, e) => sum + e.buHaftaCalismadakika, 0) / 60)
  };

  const formatSaat = (dakika: number) => {
    const saat = Math.floor(dakika / 60);
    const kalanDakika = Math.round(dakika % 60);
    return `${saat}s ${kalanDakika}dk`;
  };

  // Görev kaydetme
  const handleGorevKaydet = async () => {
    if (!seciliPersonel || !gorevFormu.baslik.trim()) {
      alert("Lütfen görev başlığı girin");
      return;
    }

    setGorevKaydediliyor(true);
    try {
      await addDoc(collection(db, "gorevler"), {
        baslik: gorevFormu.baslik.trim(),
        aciklama: gorevFormu.aciklama.trim(),
        atayan: user.uid,
        atayanAd: user.displayName || user.email,
        atanan: seciliPersonel.id,
        atananAd: `${seciliPersonel.ad} ${seciliPersonel.soyad}`,
        durum: "bekliyor",
        oncelik: gorevFormu.oncelik,
        olusturulmaTarihi: new Date().toISOString(),
      });

      // Modal'ı kapat ve formu sıfırla
      setGorevModalOpen(false);
      setSeciliPersonel(null);
      setGorevFormu({
        baslik: "",
        aciklama: "",
        oncelik: "normal"
      });
      
      alert("✅ Görev başarıyla oluşturuldu!");
    } catch (error) {
      console.error("Görev kaydetme hatası:", error);
      alert("❌ Görev kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setGorevKaydediliyor(false);
    }
  };

  // Görev modal'ını aç
  const handleGorevVerClick = (personel: EkipUyesi) => {
    setSeciliPersonel(personel);
    setGorevModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  if (yetkisiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <span className="text-6xl">🚫</span>
          <h2 className="text-2xl font-bold text-stone-800 mt-4">Yetkisiz Erişim</h2>
          <p className="text-stone-600 mt-2">Bu sayfaya erişim yetkiniz yok.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition"
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
      <div className="lg:ml-64">
        <main className="p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Başlık */}
            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-3">
                <span>👔</span> Yönetici Dashboard
              </h1>
              <p className="text-stone-600 mt-1">Ekibinizi yönetin ve performansı takip edin (Firestore Real-time)</p>
            </div>

            {/* Ekip Performans Özeti */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-5 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">👥</span>
                  <span className="text-xs text-stone-500">Bu Ay</span>
                </div>
                <p className="text-3xl font-bold text-rose-600">{ekipIstatistikleri.toplamGelin}</p>
                <p className="text-sm text-stone-600 mt-1">Toplam Gelin</p>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">📊</span>
                  <span className="text-xs text-stone-500">Ortalama</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">{ekipIstatistikleri.ortalamaGelin}</p>
                <p className="text-sm text-stone-600 mt-1">Gelin/Personel</p>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🏆</span>
                  <span className="text-xs text-stone-500">En Çok</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {ekipIstatistikleri.enCokHazırlayan 
                    ? `${ekipIstatistikleri.enCokHazırlayan.ad.split(' ')[0]}`
                    : '-'
                  }
                </p>
                <p className="text-sm text-stone-600 mt-1">
                  {ekipIstatistikleri.enCokHazırlayan 
                    ? `${ekipIstatistikleri.enCokHazırlayan.buAyGelinSayisi} gelin`
                    : 'Veri yok'
                  }
                </p>
              </div>

              <div className="bg-white rounded-lg p-5 shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">⏰</span>
                  <span className="text-xs text-stone-500">Bu Hafta</span>
                </div>
                <p className="text-3xl font-bold text-purple-600">{ekipIstatistikleri.toplamCalismaSaat}</p>
                <p className="text-sm text-stone-600 mt-1">Toplam Saat</p>
              </div>
            </div>

            {/* Ekip Listesi */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-stone-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                  <span>👥</span> Ekibim ({ekipUyeleri.length} Kişi)
                </h2>
              </div>

              {dataLoading ? (
                <div className="text-center py-8 text-stone-500">Yükleniyor...</div>
              ) : ekipUyeleri.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <span className="text-6xl">📭</span>
                  <p className="mt-4 text-lg font-medium">Henüz ekip üyeniz yok</p>
                  <p className="text-sm mt-2">Personel sayfasından personellere kendinizi yönetici olarak atayın</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ekipUyeleri
                    .sort((a, b) => b.buAyGelinSayisi - a.buAyGelinSayisi)
                    .map((uye) => (
                      <div
                        key={uye.id}
                        className={`p-5 rounded-lg border-2 transition ${
                          uye.aktif 
                            ? 'bg-white border-stone-200 hover:border-rose-300' 
                            : 'bg-stone-50 border-stone-100 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <h3 className="text-lg font-bold text-stone-800">
                                {uye.ad} {uye.soyad}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                uye.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {uye.aktif ? '🟢 Aktif' : '🔴 Pasif'}
                              </span>
                              {uye.grupEtiketleri.map(g => (
                                <span key={g} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                                  {g}
                                </span>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="bg-rose-50 rounded-lg p-3">
                                <p className="text-xs text-rose-600 mb-1">Bu Ay</p>
                                <p className="text-2xl font-bold text-rose-700">{uye.buAyGelinSayisi}</p>
                                <p className="text-xs text-stone-600">gelin</p>
                              </div>

                              <div className="bg-blue-50 rounded-lg p-3">
                                <p className="text-xs text-blue-600 mb-1">Toplam</p>
                                <p className="text-2xl font-bold text-blue-700">{uye.toplamGelinSayisi}</p>
                                <p className="text-xs text-stone-600">gelin</p>
                              </div>

                              <div className="bg-green-50 rounded-lg p-3">
                                <p className="text-xs text-green-600 mb-1">Bu Hafta</p>
                                <p className="text-2xl font-bold text-green-700">{uye.buHaftaCalismaGun}</p>
                                <p className="text-xs text-stone-600">gün</p>
                              </div>

                              <div className="bg-purple-50 rounded-lg p-3">
                                <p className="text-xs text-purple-600 mb-1">Çalışma</p>
                                <p className="text-lg font-bold text-purple-700">{formatSaat(uye.buHaftaCalismadakika)}</p>
                                <p className="text-xs text-stone-600">bu hafta</p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 ml-4">
                            <button 
                              onClick={() => handleGorevVerClick(uye)}
                              className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition text-sm font-medium whitespace-nowrap"
                            >
                              📋 Görev Ver
                            </button>
                            <button 
                              onClick={() => router.push(`/personel?id=${uye.id}`)}
                              className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 transition text-sm font-medium whitespace-nowrap"
                            >
                              👁️ Detay
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Bekleyen İzin Talepleri Paneli */}
            <div className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-stone-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                  <span>🏖️</span> Bekleyen İzin Talepleri ({bekleyenIzinTalepleri.length})
                </h2>
              </div>

              {bekleyenIzinTalepleri.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  <span className="text-4xl">✅</span>
                  <p className="mt-3 font-medium">Bekleyen izin talebi yok</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bekleyenIzinTalepleri.map((talep) => {
                    const personel = allPersoneller.find(p => p.id === talep.personelId);
                    const personelFirmalar = personel?.firmalar?.map(fId => firmalar.find(f => f.id === fId)).filter(Boolean) || [];
                    
                    return (
                      <div
                        key={talep.id}
                        className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50 transition hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-bold text-stone-800">
                                {talep.personelAd} {talep.personelSoyad}
                              </h3>
                              {personelFirmalar.map(firma => firma && (
                                <span key={firma.id} className={`px-2 py-0.5 text-xs rounded bg-${firma.renk}-100 text-${firma.renk}-700`}>
                                  {firma.kisaltma}
                                </span>
                              ))}
                              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                                ⏳ Beklemede
                              </span>
                            </div>
                            <div className="text-sm text-stone-600 space-y-1">
                              <p><strong>İzin Türü:</strong> {talep.izinTuru}</p>
                              <p><strong>Tarih:</strong> {new Date(talep.baslangic).toLocaleDateString('tr-TR')} - {new Date(talep.bitis).toLocaleDateString('tr-TR')} ({talep.gunSayisi} gün)</p>
                              {talep.aciklama && <p><strong>Açıklama:</strong> {talep.aciklama}</p>}
                              <p className="text-xs text-stone-400">Talep: {new Date(talep.talepTarihi).toLocaleDateString('tr-TR')}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleIzinOnayla(talep)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
                            >
                              ✅ Onayla
                            </button>
                            <button
                              onClick={() => handleIzinReddet(talep)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium"
                            >
                              ❌ Reddet
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Görevler Paneli */}
            <div className="mt-6 bg-white rounded-lg p-6 shadow-sm border border-stone-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                  <span>📋</span> Atanan Görevler ({gorevler.length})
                </h2>
              </div>

              {gorevler.length === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <span className="text-6xl">📝</span>
                  <p className="mt-4 text-lg font-medium">Henüz görev atanmamış</p>
                  <p className="text-sm mt-2">Ekip üyelerinize görev vermek için yukarıdaki "Görev Ver" butonunu kullanın</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {gorevler.map((gorev) => {
                    const oncelikRenk = {
                      acil: "border-red-300 bg-red-50",
                      yuksek: "border-orange-300 bg-orange-50",
                      normal: "border-blue-300 bg-blue-50",
                      dusuk: "border-stone-300 bg-stone-50"
                    }[gorev.oncelik];

                    const durumRenk = {
                      bekliyor: "bg-yellow-100 text-yellow-700",
                      "devam-ediyor": "bg-blue-100 text-blue-700",
                      tamamlandi: "bg-green-100 text-green-700",
                      iptal: "bg-stone-100 text-stone-700"
                    }[gorev.durum];

                    const durumText = {
                      bekliyor: "⏳ Bekliyor",
                      "devam-ediyor": "🔄 Devam Ediyor",
                      tamamlandi: "✅ Tamamlandı",
                      iptal: "❌ İptal"
                    }[gorev.durum];

                    return (
                      <div
                        key={gorev.id}
                        className={`p-4 rounded-lg border-2 ${oncelikRenk} transition hover:shadow-md`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-stone-800">{gorev.baslik}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${durumRenk}`}>
                                {durumText}
                              </span>
                            </div>
                            {gorev.aciklama && (
                              <p className="text-sm text-stone-600 mb-2">{gorev.aciklama}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-stone-500">
                              <span>👤 {gorev.atananAd}</span>
                              <span>📅 {new Date(gorev.olusturulmaTarihi).toLocaleDateString('tr-TR')}</span>
                              <span className="font-medium text-stone-700">
                                {gorev.oncelik === "acil" && "🔴 Acil"}
                                {gorev.oncelik === "yuksek" && "🟡 Yüksek"}
                                {gorev.oncelik === "normal" && "🔵 Normal"}
                                {gorev.oncelik === "dusuk" && "⚪ Düşük"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Görev Atama Modal'ı */}
      {gorevModalOpen && seciliPersonel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-stone-800">
                📋 Yeni Görev - {seciliPersonel.ad} {seciliPersonel.soyad}
              </h3>
              <button 
                onClick={() => {
                  setGorevModalOpen(false);
                  setSeciliPersonel(null);
                  setGorevFormu({ baslik: "", aciklama: "", oncelik: "normal" });
                }}
                className="text-stone-400 hover:text-stone-600 text-3xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Görev Başlığı */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Görev Başlığı *
                </label>
                <input
                  type="text"
                  value={gorevFormu.baslik}
                  onChange={(e) => setGorevFormu({ ...gorevFormu, baslik: e.target.value })}
                  placeholder="Örn: Betül gelini hazırla"
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  autoFocus
                />
              </div>

              {/* Görev Açıklaması */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Açıklama <span className="text-stone-400">(Opsiyonel)</span>
                </label>
                <textarea
                  value={gorevFormu.aciklama}
                  onChange={(e) => setGorevFormu({ ...gorevFormu, aciklama: e.target.value })}
                  placeholder="Görev detaylarını buraya yazın..."
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 h-24 resize-none"
                />
              </div>

              {/* Öncelik Seçimi */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Öncelik Seviyesi
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: "dusuk", label: "Düşük", color: "bg-stone-100 text-stone-700 hover:bg-stone-200" },
                    { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                    { value: "yuksek", label: "Yüksek", color: "bg-orange-100 text-orange-700 hover:bg-orange-200" },
                    { value: "acil", label: "Acil", color: "bg-red-100 text-red-700 hover:bg-red-200" }
                  ].map(({ value, label, color }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGorevFormu({ ...gorevFormu, oncelik: value as any })}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        gorevFormu.oncelik === value
                          ? color.replace('hover:', '')
                          : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Butonları */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleGorevKaydet}
                disabled={gorevKaydediliyor || !gorevFormu.baslik.trim()}
                className="flex-1 px-4 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gorevKaydediliyor ? "Kaydediliyor..." : "✅ Görevi Ata"}
              </button>
              <button
                onClick={() => {
                  setGorevModalOpen(false);
                  setSeciliPersonel(null);
                  setGorevFormu({ baslik: "", aciklama: "", oncelik: "normal" });
                }}
                className="px-4 py-3 bg-stone-200 text-stone-700 rounded-lg hover:bg-stone-300 transition font-medium"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}