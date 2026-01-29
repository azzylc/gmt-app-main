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
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit
} from "firebase/firestore";
import { Scanner } from "@yudiel/react-qr-scanner";

interface Konum {
  id: string;
  karekod: string;
  konumAdi: string;
  lat: number;
  lng: number;
  maksimumOkutmaUzakligi: number;
  aktif: boolean;
}

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  email: string;
  foto: string;
}

interface SonIslem {
  tip: "giris" | "cikis";
  tarih: any;
  konumAdi: string;
}

export default function QRGirisPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [personel, setPersonel] = useState<Personel | null>(null);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [durum, setDurum] = useState<"bekleniyor" | "basarili" | "hata">("bekleniyor");
  const [mesaj, setMesaj] = useState("");
  const [sonIslem, setSonIslem] = useState<SonIslem | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  // Mobil kontrolü
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        const q = query(collection(db, "personnel"), where("email", "==", user.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setPersonel({
            id: snapshot.docs[0].id,
            ad: data.ad,
            soyad: data.soyad,
            email: data.email,
            foto: data.foto || ""
          });
          await fetchSonIslem(snapshot.docs[0].id);
        }
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSonIslem = async (personelId: string) => {
    try {
      const q = query(
        collection(db, "attendance"),
        where("personelId", "==", personelId),
        orderBy("tarih", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSonIslem({
          tip: data.tip,
          tarih: data.tarih,
          konumAdi: data.konumAdi
        });
      }
    } catch (error) {
      console.log("Son işlem çekilemedi:", error);
    }
  };

  const getLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Tarayıcınız konum özelliğini desteklemiyor"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (error) => {
          const messages: Record<number, string> = {
            1: "Konum izni reddedildi",
            2: "Konum bilgisi alınamadı",
            3: "Konum alma zaman aşımı"
          };
          reject(new Error(messages[error.code] || "Konum hatası"));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const startScanning = async () => {
    setLocationError("");
    setMesaj("");
    setDurum("bekleniyor");
    try {
      const location = await getLocation();
      setUserLocation(location);
      setScanning(true);
    } catch (error: any) {
      setLocationError(error.message);
    }
  };

  const handleScan = async (result: any) => {
    if (!result || !result[0]?.rawValue || processing) return;
    
    const decodedText = result[0].rawValue;
    setProcessing(true);
    setScanning(false);

    try {
      const q = query(collection(db, "locations"), where("karekod", "==", decodedText), where("aktif", "==", true));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setDurum("hata");
        setMesaj("QR kod tanınmadı!");
        setProcessing(false);
        return;
      }

      const konum = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Konum;

      if (!userLocation) {
        setDurum("hata");
        setMesaj("Konum alınamadı");
        setProcessing(false);
        return;
      }

      const mesafe = calculateDistance(userLocation.lat, userLocation.lng, konum.lat, konum.lng);

      if (mesafe > konum.maksimumOkutmaUzakligi) {
        setDurum("hata");
        setMesaj(`Çok uzaktasınız! (${Math.round(mesafe)}m)`);
        setProcessing(false);
        return;
      }

      const islemTipi: "giris" | "cikis" = sonIslem?.tip === "giris" ? "cikis" : "giris";

      await addDoc(collection(db, "attendance"), {
        personelId: personel?.id,
        personelAd: `${personel?.ad} ${personel?.soyad}`,
        personelEmail: personel?.email,
        konumId: konum.id,
        konumAdi: konum.konumAdi,
        karekod: decodedText,
        tip: islemTipi,
        tarih: serverTimestamp(),
        lat: userLocation.lat,
        lng: userLocation.lng,
        mesafe: Math.round(mesafe)
      });

      setDurum("basarili");
      setMesaj(`${islemTipi === "giris" ? "Giriş" : "Çıkış"} kaydedildi!`);
      setSonIslem({ tip: islemTipi, tarih: new Date(), konumAdi: konum.konumAdi });
    } catch (error: any) {
      setDurum("hata");
      setMesaj("Bir hata oluştu");
    } finally {
      setProcessing(false);
    }
  };

  const formatTarih = (tarih: any) => {
    if (!tarih) return "";
    const date = tarih.toDate ? tarih.toDate() : new Date(tarih);
    return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const formatSaat = (tarih: any) => {
    if (!tarih) return "";
    const date = tarih.toDate ? tarih.toDate() : new Date(tarih);
    return date.toLocaleString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 md:bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent"></div>
      </div>
    );
  }

  // Tam ekran kamera modu (her iki görünümde de aynı)
  if (scanning) {
    return (
      <div className="fixed inset-0 bg-black z-50">
        <Scanner
          onScan={handleScan}
          constraints={{ facingMode: "environment" }}
          styles={{ container: { width: "100%", height: "100%" }, video: { width: "100%", height: "100%", objectFit: "cover" } }}
        />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/70 to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/70 to-transparent"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-white rounded-3xl">
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-pink-500 rounded-tl-2xl"></div>
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-pink-500 rounded-tr-2xl"></div>
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-pink-500 rounded-bl-2xl"></div>
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-pink-500 rounded-br-2xl"></div>
          </div>
        </div>
        <div className="absolute top-0 left-0 right-0 p-6 text-center">
          <p className="text-white text-lg font-medium">QR Kodu Çerçeveye Hizalayın</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button onClick={() => setScanning(false)} className="w-full py-4 bg-white/20 backdrop-blur text-white rounded-2xl font-medium text-lg">
            ✕ İptal
          </button>
        </div>
      </div>
    );
  }

  // ============ MOBİL GÖRÜNÜM ============
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-500 to-pink-600">
        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center justify-between">
            <a href="/" className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white text-xl">←</span>
            </a>
            <h1 className="text-white text-lg font-semibold">Giriş-Çıkış</h1>
            <div className="w-10"></div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="bg-white/20 backdrop-blur rounded-3xl p-5">
            <div className="flex items-center gap-4">
              {personel?.foto ? (
                <img src={personel.foto} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-white/50" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-white/30 flex items-center justify-center text-2xl text-white font-bold">
                  {personel?.ad?.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-white text-xl font-bold">{personel?.ad} {personel?.soyad}</h2>
                <p className="text-white/70 text-sm">{personel?.email}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[40px] min-h-[60vh] px-6 pt-8 pb-12">
          {sonIslem && (
            <div className={`mb-6 p-5 rounded-2xl ${sonIslem.tip === "giris" ? "bg-green-50 border border-green-200" : "bg-orange-50 border border-orange-200"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl text-white ${sonIslem.tip === "giris" ? "bg-green-500" : "bg-orange-500"}`}>
                    {sonIslem.tip === "giris" ? "✓" : "→"}
                  </div>
                  <div>
                    <p className={`font-semibold ${sonIslem.tip === "giris" ? "text-green-700" : "text-orange-700"}`}>
                      {sonIslem.tip === "giris" ? "Giriş Yapıldı" : "Çıkış Yapıldı"}
                    </p>
                    <p className="text-sm text-gray-500">{sonIslem.konumAdi}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${sonIslem.tip === "giris" ? "text-green-600" : "text-orange-600"}`}>{formatSaat(sonIslem.tarih)}</p>
                  <p className="text-xs text-gray-400">{formatTarih(sonIslem.tarih).split(" ")[0]}</p>
                </div>
              </div>
            </div>
          )}

          {locationError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <p className="text-red-600 text-center">⚠️ {locationError}</p>
            </div>
          )}

          {durum !== "bekleniyor" && (
            <div className={`mb-6 p-5 rounded-2xl text-center ${durum === "basarili" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <span className="text-4xl mb-2 block">{durum === "basarili" ? "✅" : "❌"}</span>
              <p className={`font-semibold ${durum === "basarili" ? "text-green-700" : "text-red-700"}`}>{mesaj}</p>
            </div>
          )}

          {processing ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">İşleniyor...</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-pink-50 rounded-3xl flex items-center justify-center">
                <span className="text-6xl">📱</span>
              </div>
              <p className="text-gray-500 mb-8 text-lg">
                {sonIslem?.tip === "giris" ? "Çıkış yapmak için QR okutun" : "Giriş yapmak için QR okutun"}
              </p>
              <button
                onClick={startScanning}
                className={`w-full py-5 rounded-2xl font-semibold text-xl text-white shadow-lg transition active:scale-95 ${
                  sonIslem?.tip === "giris" ? "bg-gradient-to-r from-orange-500 to-orange-600" : "bg-gradient-to-r from-green-500 to-green-600"
                }`}
              >
                {sonIslem?.tip === "giris" ? "🚪 Çıkış Yap" : "✓ Giriş Yap"}
              </button>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">Kamerayı QR koda tutun, otomatik okuyacak</p>
          </div>
        </div>
      </div>
    );
  }

  // ============ DESKTOP GÖRÜNÜM ============
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar user={user} />
      <div className="flex-1 ml-64">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-bold text-gray-800">📱 QR Giriş-Çıkış</h1>
            <p className="text-sm text-gray-500">QR kod okutarak giriş veya çıkış yapın</p>
          </div>
        </header>

        <main className="p-6">
          <div className="max-w-lg mx-auto">
            {/* Personel Bilgisi */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <div className="flex items-center gap-4">
                {personel?.foto ? (
                  <img src={personel.foto} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-2xl">
                    {personel?.ad?.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{personel?.ad} {personel?.soyad}</h2>
                  <p className="text-sm text-gray-500">{personel?.email}</p>
                </div>
              </div>

              {sonIslem && (
                <div className={`mt-4 p-3 rounded-xl ${sonIslem.tip === "giris" ? "bg-green-50" : "bg-orange-50"}`}>
                  <p className="text-sm font-medium">
                    Son İşlem: <span className={sonIslem.tip === "giris" ? "text-green-600" : "text-orange-600"}>
                      {sonIslem.tip === "giris" ? "✅ Giriş" : "🚪 Çıkış"}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{formatTarih(sonIslem.tarih)} - {sonIslem.konumAdi}</p>
                </div>
              )}
            </div>

            {/* QR Scanner */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              {locationError && (
                <div className="mb-4 p-4 bg-red-50 rounded-xl text-red-600 text-sm">⚠️ {locationError}</div>
              )}

              {durum !== "bekleniyor" && (
                <div className={`mb-4 p-4 rounded-xl ${durum === "basarili" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
                  {durum === "basarili" ? "✅" : "❌"} {mesaj}
                </div>
              )}

              {processing ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-pink-500 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-600">İşleniyor...</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-28 h-28 mx-auto mb-6 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <span className="text-5xl">📷</span>
                  </div>
                  <p className="text-gray-600 mb-6">
                    {sonIslem?.tip === "giris" ? "Çıkış yapmak için QR kod okutun" : "Giriş yapmak için QR kod okutun"}
                  </p>
                  <button
                    onClick={startScanning}
                    className="w-full py-4 bg-pink-500 text-white rounded-xl font-medium text-lg hover:bg-pink-600 transition"
                  >
                    📱 {sonIslem?.tip === "giris" ? "Çıkış İçin QR Tara" : "Giriş İçin QR Tara"}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">💡 <strong>İpucu:</strong> Kamerayı QR koda tutun, otomatik okuyacak.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}