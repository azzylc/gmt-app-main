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
  orderBy
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
}

interface Gelin {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  makyaj: string;
  yorumIstesinMi?: string;
}

export default function GorevlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [filtreliGorevler, setFiltreliGorevler] = useState<Gorev[]>([]);
  const [filtre, setFiltre] = useState<"hepsi" | "bekliyor" | "devam-ediyor" | "tamamlandi">("hepsi");
  const [selectedGorev, setSelectedGorev] = useState<Gorev | null>(null);
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

  // ✅ Gelinler - Firestore'dan (real-time) - APPS SCRIPT YERİNE!
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
        yorumIstesinMi: doc.data().yorumIstesinMi || "",
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

  // Görevleri dinle
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "gorevler"),
      where("atanan", "==", user.uid),
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

  // Otomatik Görev Oluşturma Kontrolü
  useEffect(() => {
    if (!user || gelinler.length === 0 || gorevler.length === 0) return;

    const simdi = new Date();

    gelinler.forEach(async (gelin) => {
      // Yorum istensin mi boşsa kontrol et
      if (!gelin.yorumIstesinMi || gelin.yorumIstesinMi.trim() === "") {
        const gelinTarih = new Date(gelin.tarih);
        const gelinSaat = gelin.saat.split(":");
        gelinTarih.setHours(parseInt(gelinSaat[0]), parseInt(gelinSaat[1]));
        
        // Bitiş saati: +4 saat (ortalama düğün süresi)
        const bitisSaati = new Date(gelinTarih.getTime() + 4 * 60 * 60 * 1000);
        
        // Hatırlatma zamanı: Bitiş + 1 saat
        const hatirlatmaZamani = new Date(bitisSaati.getTime() + 1 * 60 * 60 * 1000);

        // Şimdi hatırlatma zamanını geçti mi?
        if (simdi >= hatirlatmaZamani) {
          // Bu gelin için zaten görev oluşturulmuş mu kontrol et
          const mevcutGorev = gorevler.find(g => 
            g.gelinId === gelin.id && 
            g.baslik.includes("yorum istensin mi")
          );

          if (!mevcutGorev) {
            // Yeni görev oluştur
            const makyajPersonelId = gelin.makyaj; // TODO: Personel ID'ye çevir
            
            await addDoc(collection(db, "gorevler"), {
              baslik: `${gelin.isim} - Yorum istensin mi alanını doldur`,
              aciklama: `${gelin.isim} için "Yorum istensin mi" alanı boş bırakılmış. Lütfen takvimden bu alanı doldurun.`,
              atayan: "Sistem",
              atayanAd: "Sistem (Otomatik)",
              atanan: makyajPersonelId, // Makyajı yapan kişiye atanacak
              atananAd: gelin.makyaj,
              durum: "bekliyor",
              oncelik: "yuksek",
              olusturulmaTarihi: serverTimestamp(),
              gelinId: gelin.id,
              otomatikMi: true
            });

            console.log(`Otomatik görev oluşturuldu: ${gelin.isim}`);
          }
        }
      }
    });
  }, [user, gelinler, gorevler]);

  // Filtre uygula
  useEffect(() => {
    if (filtre === "hepsi") {
      setFiltreliGorevler(gorevler);
    } else {
      setFiltreliGorevler(gorevler.filter(g => g.durum === filtre));
    }
  }, [gorevler, filtre]);

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
          <div className="px-4 md:px-6 py-4">
            <h1 className="text-xl md:text-2xl font-bold text-stone-800">✅ Görevlerim</h1>
            <p className="text-sm text-stone-500 mt-1">Firestore Real-time</p>
          </div>
        </header>

        <main className="p-4 md:p-6">
          {/* Filtre Butonları */}
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              onClick={() => setFiltre("hepsi")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtre === "hepsi"
                  ? "bg-rose-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              Hepsi ({gorevler.length})
            </button>
            <button
              onClick={() => setFiltre("bekliyor")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtre === "bekliyor"
                  ? "bg-rose-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              ⏳ Bekliyor ({gorevler.filter(g => g.durum === "bekliyor").length})
            </button>
            <button
              onClick={() => setFiltre("devam-ediyor")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtre === "devam-ediyor"
                  ? "bg-rose-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              🔄 Devam Ediyor ({gorevler.filter(g => g.durum === "devam-ediyor").length})
            </button>
            <button
              onClick={() => setFiltre("tamamlandi")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filtre === "tamamlandi"
                  ? "bg-rose-500 text-white"
                  : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
              }`}
            >
              ✅ Tamamlandı ({gorevler.filter(g => g.durum === "tamamlandi").length})
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

                  {/* Aksiyon Butonları */}
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
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}