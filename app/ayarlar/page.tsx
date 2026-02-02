"use client";
import { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  where,
  getDocs,
  arrayRemove,
  writeBatch
} from "firebase/firestore";

interface Konum {
  id: string;
  karekod: string;
  konumAdi: string;
  lat: number;
  lng: number;
  maksimumOkutmaUzakligi: number;
  girisSaatLimiti: string;
  konumDisiOkutabilme: boolean;
  aktif: boolean;
}

interface GrupEtiketi {
  id: string;
  grupAdi: string;
  renk: string;
  sira: number;
  olusturulmaTarihi: any;
  sonDuzenleme: any;
}

interface Firma {
  id: string;
  firmaAdi: string;
  kisaltma: string;
  renk: string;
  aktif: boolean;
  olusturulmaTarihi: any;
  sonDuzenleme: any;
}

export default function AyarlarPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const router = useRouter();

  // Konumlar state
  const [konumlar, setKonumlar] = useState<Konum[]>([]);
  const [showKonumModal, setShowKonumModal] = useState(false);
  const [editingKonum, setEditingKonum] = useState<Konum | null>(null);
  const [konumFormData, setKonumFormData] = useState<Konum>({
    id: "",
    karekod: "",
    konumAdi: "",
    lat: 0,
    lng: 0,
    maksimumOkutmaUzakligi: 50,
    girisSaatLimiti: "",
    konumDisiOkutabilme: false,
    aktif: true
  });

  // Grup Etiketleri state
  const [grupEtiketleri, setGrupEtiketleri] = useState<GrupEtiketi[]>([]);
  const [showGrupModal, setShowGrupModal] = useState(false);
  const [editingGrup, setEditingGrup] = useState<GrupEtiketi | null>(null);
  const [grupFormData, setGrupFormData] = useState<GrupEtiketi>({
    id: "",
    grupAdi: "",
    renk: "gray",
    sira: 0,
    olusturulmaTarihi: null,
    sonDuzenleme: null
  });

  // Firmalar state
  const [firmalar, setFirmalar] = useState<Firma[]>([]);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [editingFirma, setEditingFirma] = useState<Firma | null>(null);
  const [firmaFormData, setFirmaFormData] = useState<Firma>({
    id: "",
    firmaAdi: "",
    kisaltma: "",
    renk: "blue",
    aktif: true,
    olusturulmaTarihi: null,
    sonDuzenleme: null
  });

  const tabs = [
    { id: 0, label: "📋 Genel Ayarlar", icon: "📋" },
    { id: 1, label: "🏢 Firmalar", icon: "🏢" },
    { id: 2, label: "📍 Konumlar", icon: "📍" },
    { id: 3, label: "🏷️ Grup Etiketleri", icon: "🏷️" }
  ];

  // Auth
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

  // Konumları çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "locations"), orderBy("konumAdi", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Konum));
      setKonumlar(data);
    });
    return () => unsubscribe();
  }, [user]);

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

  // Grup Etiketlerini çek ve eksik field'ları otomatik düzelt
  const cleanupDoneRef = useRef(false);
  
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "groupTags"), orderBy("grupAdi", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        grupAdi: docSnap.data().grupAdi || "",
        renk: docSnap.data().renk || "gray",
        sira: docSnap.data().sira ?? 999,
        olusturulmaTarihi: docSnap.data().olusturulmaTarihi,
        sonDuzenleme: docSnap.data().sonDuzenleme
      } as GrupEtiketi));
      setGrupEtiketleri(data);
      
      // İlk yüklemede eksik field'ları düzelt + artık etiketleri temizle (sadece 1 kez)
      if (!cleanupDoneRef.current && data.length > 0) {
        cleanupDoneRef.current = true;
        
        try {
          const batch = writeBatch(db);
          let tagUpdateCount = 0;
          
          // 1. Eksik sira/renk field'larını düzelt
          snapshot.docs.forEach((docSnap, index) => {
            const docData = docSnap.data();
            const updates: any = {};
            
            if (docData.sira === undefined || docData.sira === null) {
              updates.sira = index;
            }
            if (!docData.renk) {
              updates.renk = "gray";
            }
            
            if (Object.keys(updates).length > 0) {
              batch.update(doc(db, "groupTags", docSnap.id), updates);
              tagUpdateCount++;
            }
          });
          
          // 2. Personellerden artık etiketleri temizle
          const mevcutEtiketler = data.map(g => g.grupAdi);
          const personnelQuery = query(collection(db, "personnel"));
          const personnelSnapshot = await getDocs(personnelQuery);
          let personnelUpdateCount = 0;
          
          personnelSnapshot.forEach((docSnap) => {
            const personelData = docSnap.data();
            const personelEtiketleri = personelData.grupEtiketleri || [];
            const artikEtiketler = personelEtiketleri.filter((e: string) => !mevcutEtiketler.includes(e));
            
            if (artikEtiketler.length > 0) {
              const temizEtiketler = personelEtiketleri.filter((e: string) => mevcutEtiketler.includes(e));
              batch.update(doc(db, "personnel", docSnap.id), {
                grupEtiketleri: temizEtiketler
              });
              personnelUpdateCount++;
            }
          });
          
          // Batch commit
          if (tagUpdateCount > 0 || personnelUpdateCount > 0) {
            await batch.commit();
            if (tagUpdateCount > 0) console.log(`${tagUpdateCount} grup etiketine eksik field eklendi.`);
            if (personnelUpdateCount > 0) console.log(`${personnelUpdateCount} personelden artık etiketler temizlendi.`);
          }
        } catch (error) {
          console.error("Otomatik düzeltme hatası:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [user]);

  // KONUM İŞLEMLERİ
  const handleKonumAddEdit = async () => {
    if (!konumFormData.konumAdi || !konumFormData.karekod) {
      alert("Lütfen zorunlu alanları doldurun!");
      return;
    }

    try {
      if (editingKonum) {
        const { id, ...dataToUpdate } = konumFormData;
        await updateDoc(doc(db, "locations", editingKonum.id), dataToUpdate);
      } else {
        const { id, ...dataToAdd } = konumFormData;
        await addDoc(collection(db, "locations"), {
          ...dataToAdd,
          createdAt: serverTimestamp()
        });
      }

      setShowKonumModal(false);
      setEditingKonum(null);
      resetKonumForm();
    } catch (error) {
      console.error("Hata:", error);
      alert("İşlem başarısız!");
    }
  };

  const handleKonumDelete = async (id: string) => {
    if (confirm("Bu konumu silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "locations", id));
      } catch (error) {
        console.error("Hata:", error);
      }
    }
  };

  const openKonumEditModal = (konum: Konum) => {
    setEditingKonum(konum);
    setKonumFormData(konum);
    setShowKonumModal(true);
  };

  const resetKonumForm = () => {
    setKonumFormData({
      id: "",
      karekod: "",
      konumAdi: "",
      lat: 0,
      lng: 0,
      maksimumOkutmaUzakligi: 50,
      girisSaatLimiti: "",
      konumDisiOkutabilme: false,
      aktif: true
    });
  };

  // GRUP ETİKETİ İŞLEMLERİ
  const handleGrupAddEdit = async () => {
    if (!grupFormData.grupAdi) {
      alert("Grup adı gerekli!");
      return;
    }

    try {
      if (editingGrup) {
        const eskiGrupAdi = editingGrup.grupAdi;
        const yeniGrupAdi = grupFormData.grupAdi;
        
        // Grup adı değiştiyse, tüm personellerde güncelle
        if (eskiGrupAdi !== yeniGrupAdi) {
          const personnelQuery = query(collection(db, "personnel"));
          const personnelSnapshot = await getDocs(personnelQuery);
          
          const batch = writeBatch(db);
          let updateCount = 0;
          
          personnelSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const grupEtiketleri = data.grupEtiketleri || [];
            
            if (grupEtiketleri.includes(eskiGrupAdi)) {
              const yeniEtiketler = grupEtiketleri.map((g: string) => 
                g === eskiGrupAdi ? yeniGrupAdi : g
              );
              batch.update(doc(db, "personnel", docSnap.id), {
                grupEtiketleri: yeniEtiketler
              });
              updateCount++;
            }
          });
          
          if (updateCount > 0) {
            await batch.commit();
          }
        }
        
        const { id, ...dataToUpdate } = grupFormData;
        await updateDoc(doc(db, "groupTags", editingGrup.id), {
          ...dataToUpdate,
          sonDuzenleme: serverTimestamp()
        });
      } else {
        // Yeni sira hesapla (mevcut en yüksek + 1)
        const yeniSira = grupEtiketleri.length > 0 
          ? Math.max(...grupEtiketleri.map(g => g.sira || 0)) + 1 
          : 0;
        
        const { id, ...dataToAdd } = grupFormData;
        await addDoc(collection(db, "groupTags"), {
          ...dataToAdd,
          sira: yeniSira,
          olusturulmaTarihi: serverTimestamp(),
          sonDuzenleme: serverTimestamp()
        });
      }

      setShowGrupModal(false);
      setEditingGrup(null);
      resetGrupForm();
    } catch (error) {
      console.error("Hata:", error);
      alert("İşlem başarısız!");
    }
  };

  const handleGrupDelete = async (id: string, grupAdi: string) => {
    if (confirm(`"${grupAdi}" etiketini silmek istediğinize emin misiniz?\n\nBu işlem tüm personellerden bu etiketi kaldıracak!`)) {
      try {
        // 1. Tüm personellerde bu etiketi bul ve kaldır
        const personnelQuery = query(collection(db, "personnel"));
        const personnelSnapshot = await getDocs(personnelQuery);
        
        const batch = writeBatch(db);
        let updateCount = 0;
        
        personnelSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const grupEtiketleri = data.grupEtiketleri || [];
          
          if (grupEtiketleri.includes(grupAdi)) {
            batch.update(doc(db, "personnel", docSnap.id), {
              grupEtiketleri: arrayRemove(grupAdi)
            });
            updateCount++;
          }
        });
        
        // Batch commit
        if (updateCount > 0) {
          await batch.commit();
        }
        
        // 2. Grup etiketini sil
        await deleteDoc(doc(db, "groupTags", id));
        
        alert(`"${grupAdi}" etiketi silindi ve ${updateCount} personelden kaldırıldı.`);
      } catch (error) {
        console.error("Hata:", error);
        alert("İşlem başarısız!");
      }
    }
  };

  const openGrupEditModal = (grup: GrupEtiketi) => {
    setEditingGrup(grup);
    setGrupFormData(grup);
    setShowGrupModal(true);
  };

  const resetGrupForm = () => {
    setGrupFormData({
      id: "",
      grupAdi: "",
      renk: "gray",
      sira: 0,
      olusturulmaTarihi: null,
      sonDuzenleme: null
    });
  };

  // =====================
  // FİRMA FONKSİYONLARI
  // =====================
  const handleFirmaAddEdit = async () => {
    if (!firmaFormData.firmaAdi.trim()) {
      alert("Firma adı zorunludur!");
      return;
    }
    if (!firmaFormData.kisaltma.trim()) {
      alert("Kısaltma zorunludur!");
      return;
    }

    try {
      if (editingFirma) {
        await updateDoc(doc(db, "companies", editingFirma.id), {
          firmaAdi: firmaFormData.firmaAdi.trim(),
          kisaltma: firmaFormData.kisaltma.trim().toUpperCase(),
          renk: firmaFormData.renk,
          aktif: firmaFormData.aktif,
          sonDuzenleme: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "companies"), {
          firmaAdi: firmaFormData.firmaAdi.trim(),
          kisaltma: firmaFormData.kisaltma.trim().toUpperCase(),
          renk: firmaFormData.renk,
          aktif: firmaFormData.aktif,
          olusturulmaTarihi: serverTimestamp(),
          sonDuzenleme: serverTimestamp()
        });
      }
      setShowFirmaModal(false);
      resetFirmaForm();
    } catch (error) {
      console.error("Firma kaydetme hatası:", error);
      alert("Firma kaydedilemedi!");
    }
  };

  const handleFirmaDelete = async (id: string, firmaAdi: string) => {
    // Bu firmada çalışan personel var mı kontrol et
    const personnelQuery = query(collection(db, "personnel"), where("firma", "==", id));
    const personnelSnapshot = await getDocs(personnelQuery);
    
    if (!personnelSnapshot.empty) {
      alert(`"${firmaAdi}" firmasında ${personnelSnapshot.size} personel çalışıyor. Önce personelleri başka firmaya taşıyın.`);
      return;
    }

    if (confirm(`"${firmaAdi}" firmasını silmek istediğinize emin misiniz?`)) {
      try {
        await deleteDoc(doc(db, "companies", id));
      } catch (error) {
        console.error("Firma silme hatası:", error);
        alert("Firma silinemedi!");
      }
    }
  };

  const openFirmaEditModal = (firma: Firma) => {
    setEditingFirma(firma);
    setFirmaFormData(firma);
    setShowFirmaModal(true);
  };

  const resetFirmaForm = () => {
    setEditingFirma(null);
    setFirmaFormData({
      id: "",
      firmaAdi: "",
      kisaltma: "",
      renk: "blue",
      aktif: true,
      olusturulmaTarihi: null,
      sonDuzenleme: null
    });
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
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold text-gray-800">⚙️ Ayarlar</h1>
            <p className="text-sm text-gray-500">Sistem ayarlarını yönetin</p>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b">
          <div className="flex px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? 'text-pink-600 border-b-2 border-pink-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <main className="p-6">
          {/* TAB 0: Genel Ayarlar */}
          {activeTab === 0 && (
            <div className="space-y-6">
              {/* Şirket Ayarları */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🏢</span> Şirket Ayarları
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şirket Adı</label>
                    <input type="text" defaultValue="Gizem Yolcu Studio" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yönetici Bilgileri</label>
                    <textarea rows={3} defaultValue="Gizem Yolcu - Kurucu" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                </div>
              </div>

              {/* İzin Ayarları */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🏖️</span> İzin Ayarları
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Hafta sonu günleri izin hesaplamalarına dahil</p>
                      <p className="text-xs text-gray-500">Cumartesi ve Pazar günleri izin hesabına dahil edilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Hafta içi kapatan izinler için otomatik e-posta</p>
                      <p className="text-xs text-gray-500">İzin onaylandığında personele otomatik mail gönder</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Mobil'de yıllık/saatlik izin talep etme</p>
                      <p className="text-xs text-gray-500">Personel mobil uygulamadan izin talebinde bulunabilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">İzin onaylarında yönetici ön onayı zorunlu</p>
                      <p className="text-xs text-gray-500">İzin talebi önce yönetici onayından geçsin mi?</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Uygulama Ayarları */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>📱</span> Uygulama Ayarları
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Varsayılan Açılış Sayfası</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
                      <option>Genel Bakış</option>
                      <option>Gelinler</option>
                      <option>Takvim</option>
                      <option>Personel</option>
                    </select>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">QR kamera izni</p>
                      <p className="text-xs text-gray-500">QR kod okutma özelliği aktif olsun mu?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Konum tabanlı işlem izinleri</p>
                      <p className="text-xs text-gray-500">Konum kontrolü yapılsın mı?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Kişisel QR kod ile işlem</p>
                      <p className="text-xs text-gray-500">Her personel kendi QR kodu ile işlem yapabilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Vardiya planları görüntüleme</p>
                      <p className="text-xs text-gray-500">Personel vardiyalarını görebilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">İşlem geçmişi</p>
                      <p className="text-xs text-gray-500">Personel kendi giriş-çıkış geçmişini görebilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Profil fotoğrafı yükleme</p>
                      <p className="text-xs text-gray-500">Personel profil fotoğrafı ekleyebilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">Mazeret bildirme</p>
                      <p className="text-xs text-gray-500">Personel mazeret bildirimi yapabilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">QR kameralı mola işlemi</p>
                      <p className="text-xs text-gray-500">Mola için QR okutma zorunlu olsun mu?</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bildirim Ayarları */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🔔</span> Bildirim Ayarları
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">İşe giriş-çıkış hatırlatıcıları</p>
                      <p className="text-xs text-gray-500">Personele giriş ve çıkış saatinde bildirim gönderilsin mi?</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Yetkili Ayarları */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🔑</span> Yetkili Ayarları
                </h2>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-3">Yetkili grupları için menü erişim izinleri:</p>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">"Raporlar" menüsü erişimi</p>
                      <p className="text-xs text-gray-500">Yetkililer raporları görebilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">"İzinler" menüsü erişimi</p>
                      <p className="text-xs text-gray-500">Yetkililer izin yönetimini görebilsin mi?</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" defaultChecked className="w-5 h-5 text-pink-600 rounded mt-1" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">"Giriş-Çıkış Ekle" erişimi</p>
                      <p className="text-xs text-gray-500">Yetkililer manuel giriş-çıkış ekleyebilsin mi?</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kaydet Butonu */}
              <div className="flex justify-end">
                <button className="px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium">
                  💾 Ayarları Kaydet
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Konumlar */}
          {activeTab === 2 && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">📍 Konumlar</h2>
                <button
                  onClick={() => { setShowKonumModal(true); setEditingKonum(null); resetKonumForm(); }}
                  className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  ➕ Yeni Konum
                </button>
              </div>

              {konumlar.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                  <span className="text-5xl mb-4 block">📍</span>
                  <p className="text-lg font-medium">Konum bulunamadı</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QR Kod</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Karekod</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Konum Adı</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Max Uzaklık</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">GPS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {konumlar.map(konum => (
                        <tr key={konum.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="flex flex-col items-center gap-2">
                              <img 
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(konum.karekod)}`} 
                                alt="QR" 
                                className="w-16 h-16 border rounded"
                              />
                              <a
                                href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(konum.karekod)}`}
                                download={`QR-${konum.karekod}.png`}
                                target="_blank"
                                className="text-xs text-pink-600 hover:text-pink-700 font-medium"
                              >
                                📥 İndir
                              </a>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm font-mono text-gray-900">{konum.karekod}</td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">{konum.konumAdi}</td>
                          <td className="px-4 py-4 text-sm text-gray-600">{konum.maksimumOkutmaUzakligi} m</td>
                          <td className="px-4 py-4">
                            {konum.lat && konum.lng ? (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">✓ Ayarlı</span>
                            ) : (
                              <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">✗ Ayarlanmadı</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 text-xs rounded-full ${konum.aktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {konum.aktif ? 'Aktif' : 'Pasif'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => openKonumEditModal(konum)} className="w-8 h-8 hover:bg-yellow-50 text-yellow-600 rounded" title="Düzenle">✏️</button>
                              <button onClick={() => handleKonumDelete(konum.id)} className="w-8 h-8 hover:bg-red-50 text-red-600 rounded" title="Sil">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: Firmalar */}
          {activeTab === 1 && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">🏢 Firmalar</h2>
                <button
                  onClick={() => { setShowFirmaModal(true); setEditingFirma(null); resetFirmaForm(); }}
                  className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  ➕ Yeni Firma
                </button>
              </div>

              {firmalar.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                  <p className="text-4xl mb-4">🏢</p>
                  <p>Henüz firma eklenmemiş</p>
                  <p className="text-sm mt-2">Yukarıdaki butona tıklayarak firma ekleyin</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firma</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kısaltma</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {firmalar.map((firma) => (
                        <tr key={firma.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`w-3 h-3 rounded-full bg-${firma.renk}-500`}></span>
                              <span className="font-medium text-gray-900">{firma.firmaAdi}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium bg-${firma.renk}-100 text-${firma.renk}-700`}>
                              {firma.kisaltma}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs ${firma.aktif ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {firma.aktif ? 'Aktif' : 'Pasif'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => openFirmaEditModal(firma)} className="w-8 h-8 hover:bg-yellow-50 text-yellow-600 rounded" title="Düzenle">✏️</button>
                              <button onClick={() => handleFirmaDelete(firma.id, firma.firmaAdi)} className="w-8 h-8 hover:bg-red-50 text-red-600 rounded" title="Sil">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Grup Etiketleri */}
          {activeTab === 3 && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">🏷️ Grup Etiketleri</h2>
                <button
                  onClick={() => { setShowGrupModal(true); setEditingGrup(null); resetGrupForm(); }}
                  className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  ➕ Yeni Grup
                </button>
              </div>

              {grupEtiketleri.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                  <span className="text-5xl mb-4 block">🏷️</span>
                  <p className="text-lg font-medium">Grup etiketi bulunamadı</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grup Adı</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renk</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Önizleme</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Oluşturulma</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {grupEtiketleri.map(grup => (
                        <tr key={grup.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-900">{grup.grupAdi}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`w-4 h-4 rounded-full bg-${grup.renk}-500`}></span>
                              <span className="text-sm text-gray-600 capitalize">{grup.renk}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 text-sm font-medium text-white rounded-full bg-${grup.renk}-500`}>
                              {grup.grupAdi}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {grup.olusturulmaTarihi ? new Date(grup.olusturulmaTarihi.seconds * 1000).toLocaleDateString('tr-TR') : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => openGrupEditModal(grup)} className="w-8 h-8 hover:bg-yellow-50 text-yellow-600 rounded" title="Düzenle">✏️</button>
                              <button onClick={() => handleGrupDelete(grup.id, grup.grupAdi)} className="w-8 h-8 hover:bg-red-50 text-red-600 rounded" title="Sil">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Konum Modal */}
      {showKonumModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{editingKonum ? "✏️ Konum Düzenle" : "➕ Yeni Konum"}</h3>
              <button onClick={() => { setShowKonumModal(false); resetKonumForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Karekod *</label>
                  <input type="text" value={konumFormData.karekod} onChange={(e) => setKonumFormData({ ...konumFormData, karekod: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="110-OFİS" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konum Adı *</label>
                  <input type="text" value={konumFormData.konumAdi} onChange={(e) => setKonumFormData({ ...konumFormData, konumAdi: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ofis Girişi" />
                </div>
              </div>

              {/* GPS Koordinatları */}
              <div className="p-4 bg-blue-50 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">📍 GPS Koordinatları</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setKonumFormData({
                              ...konumFormData,
                              lat: position.coords.latitude,
                              lng: position.coords.longitude
                            });
                          },
                          (error) => {
                            alert("Konum alınamadı: " + error.message);
                          },
                          { enableHighAccuracy: true }
                        );
                      } else {
                        alert("Tarayıcınız konum özelliğini desteklemiyor");
                      }
                    }}
                    className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition"
                  >
                    📍 Mevcut Konumu Al
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Enlem (Lat)</label>
                    <input type="number" step="any" value={konumFormData.lat || ""} onChange={(e) => setKonumFormData({ ...konumFormData, lat: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="41.0082" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Boylam (Lng)</label>
                    <input type="number" step="any" value={konumFormData.lng || ""} onChange={(e) => setKonumFormData({ ...konumFormData, lng: Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" placeholder="28.9784" />
                  </div>
                </div>
                {konumFormData.lat && konumFormData.lng && (
                  <p className="text-xs text-green-600 mt-2">✓ Koordinatlar alındı</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Maksimum Okutma Uzaklığı (metre)</label>
                  <input type="number" value={konumFormData.maksimumOkutmaUzakligi} onChange={(e) => setKonumFormData({ ...konumFormData, maksimumOkutmaUzakligi: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giriş Saat Limiti</label>
                  <input type="text" value={konumFormData.girisSaatLimiti} onChange={(e) => setKonumFormData({ ...konumFormData, girisSaatLimiti: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Limit yok" />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={konumFormData.konumDisiOkutabilme} onChange={(e) => setKonumFormData({ ...konumFormData, konumDisiOkutabilme: e.target.checked })} className="w-4 h-4 text-pink-600 rounded" />
                  <span className="text-sm text-gray-700">Konum Dışı Okutabilme</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={konumFormData.aktif} onChange={(e) => setKonumFormData({ ...konumFormData, aktif: e.target.checked })} className="w-4 h-4 text-pink-600 rounded" />
                  <span className="text-sm text-gray-700">Aktif</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleKonumAddEdit} className="flex-1 px-4 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium">💾 Kaydet</button>
              <button onClick={() => { setShowKonumModal(false); resetKonumForm(); }} className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition font-medium">↩️ İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Firma Modal */}
      {showFirmaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{editingFirma ? "✏️ Firma Düzenle" : "➕ Yeni Firma"}</h3>
              <button onClick={() => { setShowFirmaModal(false); resetFirmaForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firma Adı *</label>
                <input 
                  type="text" 
                  value={firmaFormData.firmaAdi} 
                  onChange={(e) => setFirmaFormData({ ...firmaFormData, firmaAdi: e.target.value })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" 
                  placeholder="Gizem Yolcu Studio" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kısaltma *</label>
                <input 
                  type="text" 
                  value={firmaFormData.kisaltma} 
                  onChange={(e) => setFirmaFormData({ ...firmaFormData, kisaltma: e.target.value.toUpperCase() })} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 uppercase" 
                  placeholder="GYS" 
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Maksimum 10 karakter</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Renk *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'red', color: 'bg-red-500' },
                    { id: 'orange', color: 'bg-orange-500' },
                    { id: 'yellow', color: 'bg-yellow-500' },
                    { id: 'green', color: 'bg-green-500' },
                    { id: 'teal', color: 'bg-teal-500' },
                    { id: 'blue', color: 'bg-blue-500' },
                    { id: 'indigo', color: 'bg-indigo-500' },
                    { id: 'purple', color: 'bg-purple-500' },
                    { id: 'pink', color: 'bg-pink-500' },
                    { id: 'gray', color: 'bg-gray-500' },
                  ].map((renk) => (
                    <button
                      key={renk.id}
                      type="button"
                      onClick={() => setFirmaFormData({ ...firmaFormData, renk: renk.id })}
                      className={`w-8 h-8 rounded-full ${renk.color} ${firmaFormData.renk === renk.id ? 'ring-2 ring-offset-2 ring-gray-800' : 'hover:scale-110'} transition`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={firmaFormData.aktif} 
                  onChange={(e) => setFirmaFormData({ ...firmaFormData, aktif: e.target.checked })} 
                  className="w-4 h-4 text-pink-600 rounded" 
                />
                <span className="text-sm text-gray-700">Aktif</span>
              </div>
              
              {/* Önizleme */}
              <div className="pt-2 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">Önizleme</label>
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full bg-${firmaFormData.renk}-500`}></span>
                  <span className="font-medium">{firmaFormData.firmaAdi || "Firma Adı"}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${firmaFormData.renk}-100 text-${firmaFormData.renk}-700`}>
                    {firmaFormData.kisaltma || "KIS"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleFirmaAddEdit} className="flex-1 px-4 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium">💾 Kaydet</button>
              <button onClick={() => { setShowFirmaModal(false); resetFirmaForm(); }} className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition font-medium">↩️ İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Grup Modal */}
      {showGrupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">{editingGrup ? "✏️ Grup Düzenle" : "➕ Yeni Grup"}</h3>
              <button onClick={() => { setShowGrupModal(false); resetGrupForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grup Adı *</label>
                <input type="text" value={grupFormData.grupAdi} onChange={(e) => setGrupFormData({ ...grupFormData, grupAdi: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="ekip, GYS, MG..." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Renk *</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'red', color: 'bg-red-500' },
                    { id: 'orange', color: 'bg-orange-500' },
                    { id: 'yellow', color: 'bg-yellow-500' },
                    { id: 'green', color: 'bg-green-500' },
                    { id: 'teal', color: 'bg-teal-500' },
                    { id: 'blue', color: 'bg-blue-500' },
                    { id: 'indigo', color: 'bg-indigo-500' },
                    { id: 'purple', color: 'bg-purple-500' },
                    { id: 'pink', color: 'bg-pink-500' },
                    { id: 'gray', color: 'bg-gray-500' },
                  ].map((renk) => (
                    <button
                      key={renk.id}
                      type="button"
                      onClick={() => setGrupFormData({ ...grupFormData, renk: renk.id })}
                      className={`w-8 h-8 rounded-full ${renk.color} ${grupFormData.renk === renk.id ? 'ring-2 ring-offset-2 ring-gray-800' : 'hover:scale-110'} transition`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Önizleme */}
              <div className="pt-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Önizleme</label>
                <span className={`inline-block px-3 py-1 rounded-full text-white text-sm font-medium bg-${grupFormData.renk}-500`}>
                  {grupFormData.grupAdi || "Örnek"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={handleGrupAddEdit} className="flex-1 px-4 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium">💾 Kaydet</button>
              <button onClick={() => { setShowGrupModal(false); resetGrupForm(); }} className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition font-medium">↩️ İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}