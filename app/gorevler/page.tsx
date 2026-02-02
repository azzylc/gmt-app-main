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
  getDocs
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
  turban: string;
  yorumIstesinMi?: string;
}

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  rol?: string;
}

export default function GorevlerPage() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [gorevler, setGorevler] = useState<Gorev[]>([]);
  const [tumGorevler, setTumGorevler] = useState<Gorev[]>([]); // Kurucu için
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [filtreliGorevler, setFiltreliGorevler] = useState<Gorev[]>([]);
  const [filtre, setFiltre] = useState<"hepsi" | "bekliyor" | "devam-ediyor" | "tamamlandi">("hepsi");
  const [aktifSekme, setAktifSekme] = useState<"gorevlerim" | "otomatik" | "tumgorevler">("gorevlerim");
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
        turban: doc.data().turban || "",
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
        rol: doc.data().rol || ""
      } as Personel));
      setPersoneller(data);
      
      // Kullanıcının rolünü bul
      const currentUser = data.find(p => p.email === user.email);
      if (currentUser?.rol) {
        setUserRole(currentUser.rol);
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

  // Kurucu için TÜM görevleri dinle
  useEffect(() => {
    if (!user || userRole !== "kurucu") return;

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

  // Otomatik Görev Oluşturma Kontrolü
  useEffect(() => {
    if (!user || gelinler.length === 0 || personeller.length === 0) return;

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
          // Makyajcıyı bul
          const makyajci = personeller.find(p => 
            p.ad.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR') ||
            `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.makyaj?.toLocaleLowerCase('tr-TR')
          );

          // Türbancıyı bul
          const turbanci = personeller.find(p => 
            p.ad.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR') ||
            `${p.ad} ${p.soyad}`.toLocaleLowerCase('tr-TR') === gelin.turban?.toLocaleLowerCase('tr-TR')
          );

          // Makyajcı ve türbancı aynı mı?
          const ayniKisi = makyajci?.email === turbanci?.email;

          // Görev oluşturulacak kişiler
          const kisiler: { email: string; ad: string; rol: string }[] = [];

          if (makyajci?.email) {
            kisiler.push({ email: makyajci.email, ad: `${makyajci.ad} ${makyajci.soyad}`, rol: "Makyaj" });
          }

          if (turbanci?.email && !ayniKisi) {
            kisiler.push({ email: turbanci.email, ad: `${turbanci.ad} ${turbanci.soyad}`, rol: "Türban" });
          }

          // Her kişi için görev oluştur
          for (const kisi of kisiler) {
            // Bu gelin + bu kişi için zaten görev var mı?
            const gorevlerRef = collection(db, "gorevler");
            const mevcutGorevQuery = query(
              gorevlerRef,
              where("gelinId", "==", gelin.id),
              where("atanan", "==", kisi.email),
              where("otomatikMi", "==", true)
            );
            
            const mevcutSnapshot = await getDocs(mevcutGorevQuery);
            
            if (mevcutSnapshot.empty) {
              await addDoc(collection(db, "gorevler"), {
                baslik: `${gelin.isim} - Yorum istensin mi alanını doldur`,
                aciklama: `${gelin.isim} için "Yorum istensin mi" alanı boş. Takvimden doldurun. (${kisi.rol})`,
                atayan: "Sistem",
                atayanAd: "Sistem (Otomatik)",
                atanan: kisi.email,
                atananAd: kisi.ad,
                durum: "bekliyor",
                oncelik: "yuksek",
                olusturulmaTarihi: serverTimestamp(),
                gelinId: gelin.id,
                otomatikMi: true
              });

              console.log(`✅ Otomatik görev oluşturuldu: ${gelin.isim} → ${kisi.ad} (${kisi.rol})`);
            }
          }
        }
      }
    });
  }, [user, gelinler, personeller]);

  // Yorum istensin mi doldurulunca otomatik görevleri SİL
  useEffect(() => {
    if (!user || gelinler.length === 0 || gorevler.length === 0) return;

    gelinler.forEach(async (gelin) => {
      // Yorum istensin mi DOLUYSA
      if (gelin.yorumIstesinMi && gelin.yorumIstesinMi.trim() !== "") {
        // Bu gelin için otomatik görevleri bul ve sil
        const otomatikGorevler = gorevler.filter(g => 
          g.gelinId === gelin.id && 
          g.otomatikMi === true
        );

        for (const gorev of otomatikGorevler) {
          try {
            await deleteDoc(doc(db, "gorevler", gorev.id));
            console.log(`🗑️ Otomatik görev silindi: ${gelin.isim} (Alan dolduruldu)`);
          } catch (error) {
            console.error("Otomatik görev silinemedi:", error);
          }
        }
      }
    });
  }, [user, gelinler, gorevler]);

  // Filtre uygula (sekme + durum filtresi)
  useEffect(() => {
    let sonuc: Gorev[] = [];
    
    // Önce sekmeye göre filtrele
    if (aktifSekme === "tumgorevler") {
      sonuc = [...tumGorevler];
    } else if (aktifSekme === "otomatik") {
      sonuc = gorevler.filter(g => g.otomatikMi === true);
    } else {
      sonuc = gorevler.filter(g => !g.otomatikMi);
    }
    
    // Sonra durum filtresini uygula
    if (filtre !== "hepsi") {
      sonuc = sonuc.filter(g => g.durum === filtre);
    }
    
    setFiltreliGorevler(sonuc);
  }, [gorevler, tumGorevler, filtre, aktifSekme]);

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
          <div className="px-4 md:px-6 py-3">
            <h1 className="text-lg md:text-xl font-bold text-stone-800">✅ Görevler</h1>
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
            
            {/* Kurucu için Tüm Görevler sekmesi */}
            {userRole === "kurucu" && (
              <button
                onClick={() => { setAktifSekme("tumgorevler"); setFiltre("hepsi"); }}
                className={`px-4 py-2.5 font-medium text-sm transition border-b-2 whitespace-nowrap ${
                  aktifSekme === "tumgorevler"
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
                    : "border-transparent text-stone-500 hover:text-stone-700"
                }`}
              >
                👑 Tüm Görevler
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
          {/* Otomatik sekmede açıklama */}
          {aktifSekme === "otomatik" && (
            <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800">
                <span className="font-medium">🤖 Sistem tarafından otomatik oluşturulan görevler.</span>
                <br />
                <span className="text-xs text-purple-600">Gelin bitişinden 1 saat sonra "Yorum istensin mi" boş olan gelinler için makyajcı ve türbancıya otomatik görev atanır.</span>
              </p>
            </div>
          )}
          
          {/* Tüm Görevler sekmesinde açıklama */}
          {aktifSekme === "tumgorevler" && (
            <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-sm text-emerald-800">
                <span className="font-medium">👑 Tüm personelin görevlerini görüntülüyorsunuz.</span>
                <br />
                <span className="text-xs text-emerald-600">Kurucu olarak sistemdeki tüm görevleri takip edebilirsiniz.</span>
              </p>
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