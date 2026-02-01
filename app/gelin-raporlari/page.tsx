"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { usePersoneller } from "../hooks/usePersoneller";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface GelinRapor {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  makyaj: string;
  turban: string;
  hizmetTuru: string;
}

export default function GelinRaporlariPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gelinler, setGelinler] = useState<GelinRapor[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedPersonel, setSelectedPersonel] = useState<string>("hepsi");
  const [selectedAy, setSelectedAy] = useState<string>("hepsi");
  const router = useRouter();

  // Personeller (Firebase'den)
  const { personeller } = usePersoneller();

  const aylar = [
    { value: "01", label: "Ocak" }, { value: "02", label: "Şubat" }, { value: "03", label: "Mart" },
    { value: "04", label: "Nisan" }, { value: "05", label: "Mayıs" }, { value: "06", label: "Haziran" },
    { value: "07", label: "Temmuz" }, { value: "08", label: "Ağustos" }, { value: "09", label: "Eylül" },
    { value: "10", label: "Ekim" }, { value: "11", label: "Kasım" }, { value: "12", label: "Aralık" },
  ];

  const hizmetTurleri = [
    { value: "Gelin", label: "Gelin", emoji: "👰", color: "pink" },
    { value: "Makyaj", label: "Makyaj", emoji: "💄", color: "red" },
    { value: "Türban", label: "Türban", emoji: "🧕", color: "purple" },
    { value: "Makyaj Provası", label: "Makyaj Provası", emoji: "🎨", color: "orange" },
    { value: "Türban Provası", label: "Türban Provası", emoji: "📿", color: "indigo" },
    { value: "Makyaj + Türban Provası", label: "Makyaj + Türban Provası", emoji: "✨", color: "blue" },
    { value: "Makyaj Freelance", label: "Makyaj Freelance", emoji: "💼", color: "green" },
    { value: "Türban Freelance", label: "Türban Freelance", emoji: "🎒", color: "teal" },
    { value: "Makyaj + Türban Freelance", label: "Makyaj + Türban Freelance", emoji: "🌟", color: "cyan" },
    { value: "Kına Takibi", label: "Kına Takibi", emoji: "🤲", color: "yellow" },
    { value: "Takip Yardımı", label: "Takip Yardımı", emoji: "🤝", color: "gray" },
  ];

  // Auth kontrolü
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

  // ✅ Gelin verisi - Firestore'dan (real-time) - APPS SCRIPT YERİNE!
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Firestore gelinler listener başlatılıyor (Raporlar)...');
    
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
        hizmetTuru: doc.data().hizmetTuru || "Gelin", // Default
      } as GelinRapor));

      console.log(`✅ ${data.length} gelin Firestore'dan yüklendi (Raporlar, real-time)`);
      setGelinler(data);
      setDataLoading(false);
    }, (error) => {
      console.error('❌ Firestore listener hatası (Raporlar):', error);
      setDataLoading(false);
    });

    return () => {
      console.log('🛑 Firestore gelinler listener kapatılıyor (Raporlar)...');
      unsubscribe();
    };
  }, [user]);

  // Filtrelenmiş gelinler
  const filteredGelinler = gelinler.filter(g => {
    const personelMatch = selectedPersonel === "hepsi" || g.makyaj === selectedPersonel || g.turban === selectedPersonel;
    const ayMatch = selectedAy === "hepsi" || g.tarih.slice(5, 7) === selectedAy;
    return personelMatch && ayMatch;
  });

  // Personel bazında istatistikler (filtrelenmiş veriye göre)
  const getPersonelStats = (personelIsim: string) => {
    const personelIsler = filteredGelinler.filter(g => g.makyaj === personelIsim || g.turban === personelIsim);
    
    const stats: any = {
      toplam: personelIsler.length,
    };
    
    hizmetTurleri.forEach(ht => {
      stats[ht.value] = personelIsler.filter(g => g.hizmetTuru === ht.value).length;
    });
    
    return stats;
  };

  // Hizmet türü bazında toplam istatistikler
  const getHizmetTuruStats = () => {
    const stats: any = {};
    hizmetTurleri.forEach(ht => {
      stats[ht.value] = filteredGelinler.filter(g => g.hizmetTuru === ht.value).length;
    });
    return stats;
  };

  const hizmetStats = getHizmetTuruStats();

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
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">📊 Gelin Raporları</h1>
              <p className="text-sm text-gray-500">Personel ve hizmet türü bazında iş dağılımı (Firestore Real-time)</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                <span className="text-green-700 text-sm font-medium">✓ Real-time güncel</span>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Filtreler */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Personel Filtresi */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Personel:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedPersonel("hepsi")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                      selectedPersonel === "hepsi"
                        ? "bg-pink-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    👥 Hepsi
                  </button>
                  {personeller.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersonel(p.isim)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                        selectedPersonel === p.isim
                          ? "bg-pink-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {p.isim}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ay Filtresi */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Ay:</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedAy("hepsi")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                      selectedAy === "hepsi"
                        ? "bg-pink-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    📅 Tümü
                  </button>
                  {aylar.map(ay => (
                    <button
                      key={ay.value}
                      onClick={() => setSelectedAy(ay.value)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                        selectedAy === ay.value
                          ? "bg-pink-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {ay.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
          ) : (
            <>
              {/* Özet İstatistikler */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <div className="text-3xl font-bold text-pink-600">{filteredGelinler.length}</div>
                  <div className="text-sm text-gray-500 mt-1">Toplam İş</div>
                </div>
                
                {hizmetTurleri.slice(0, 3).map(ht => (
                  <div key={ht.value} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-3xl font-bold text-gray-800">{hizmetStats[ht.value] || 0}</div>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                      <span>{ht.emoji}</span>
                      <span>{ht.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Personel Bazlı Raporlar */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-800">Personel Bazlı İstatistikler</h2>
                  <p className="text-sm text-gray-500">
                    {selectedAy === "hepsi" ? "Tüm aylar" : aylar.find(a => a.value === selectedAy)?.label} - 
                    {selectedPersonel === "hepsi" ? " Tüm personel" : ` ${selectedPersonel}`}
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Personel
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Toplam İş
                        </th>
                        {hizmetTurleri.map(ht => (
                          <th key={ht.value} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <span className="flex items-center gap-1">
                              <span>{ht.emoji}</span>
                              <span>{ht.label}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {personeller.map(personel => {
                        const stats = getPersonelStats(personel.isim);
                        if (selectedPersonel !== "hepsi" && selectedPersonel !== personel.isim) return null;
                        if (stats.toplam === 0) return null;
                        
                        return (
                          <tr key={personel.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-medium text-gray-900">{personel.isim}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-lg font-bold text-pink-600">{stats.toplam}</div>
                            </td>
                            {hizmetTurleri.map(ht => (
                              <td key={ht.value} className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm ${stats[ht.value] > 0 ? 'font-semibold' : 'text-gray-400'}`}>
                                  {stats[ht.value] || '-'}
                                </div>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Detaylı Liste */}
              <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-800">Detaylı Liste</h2>
                  <p className="text-sm text-gray-500">{filteredGelinler.length} kayıt</p>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {filteredGelinler.map(gelin => (
                    <div key={gelin.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{gelin.isim}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {new Date(gelin.tarih).toLocaleDateString('tr-TR', { 
                              day: 'numeric', 
                              month: 'long',
                              year: 'numeric' 
                            })} • {gelin.saat}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm">
                            <span className="text-gray-500">Makyaj:</span>{' '}
                            <span className="font-medium">{gelin.makyaj}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500">Türban:</span>{' '}
                            <span className="font-medium">{gelin.turban}</span>
                          </div>
                          <div className="px-3 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-700">
                            {gelin.hizmetTuru}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}