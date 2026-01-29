"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi } from "../lib/data";

interface GelinRapor {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  makyaj: string;
  turban: string;
  hizmetTuru: string;
}

const API_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";
const CACHE_KEY = "gmt_gelinler_cache";
const CACHE_TIME_KEY = "gmt_gelinler_cache_time";

export default function GelinRaporlariPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gelinler, setGelinler] = useState<GelinRapor[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [selectedPersonel, setSelectedPersonel] = useState<string>("hepsi");
  const [selectedAy, setSelectedAy] = useState<string>("hepsi");
  const router = useRouter();

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

  const saveToCache = (data: GelinRapor[]) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
      setLastUpdate(new Date().toLocaleTimeString('tr-TR'));
    } catch (e) {}
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        const hasCache = loadFromCache();
        if (!hasCache) fetchGelinler();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchGelinler = async () => {
    setDataLoading(true);
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
      
      <div className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0">
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">📊 Gelin Raporları</h1>
              <p className="text-sm text-gray-500">Personel ve hizmet türü bazında iş dağılımı</p>
            </div>
            <div className="flex items-center gap-4">
              {lastUpdate && (
                <div className="bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                  <span className="text-green-700 text-sm font-medium">✓ Son güncelleme: {lastUpdate}</span>
                </div>
              )}
              <button
                onClick={fetchGelinler}
                disabled={dataLoading}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
              >
                {dataLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div> : "🔄"}
                Yenile
              </button>
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
                  {personelListesi.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersonel(p.isim)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                        selectedPersonel === p.isim
                          ? "bg-pink-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {p.emoji} {p.isim}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ay Filtresi */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Ay:</label>
                <select
                  value={selectedAy}
                  onChange={(e) => setSelectedAy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  <option value="hepsi">📅 Tüm Aylar</option>
                  {aylar.map(ay => (
                    <option key={ay.value} value={ay.value}>{ay.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Hizmet Türü İstatistikleri */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">📋 Hizmet Türü Dağılımı</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {hizmetTurleri.map(ht => (
                <div key={ht.value} className={`bg-${ht.color}-50 p-3 rounded-xl border border-${ht.color}-200`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{ht.emoji}</span>
                    <span className="text-xs font-medium text-gray-700">{ht.label}</span>
                  </div>
                  <p className={`text-2xl font-bold text-${ht.color}-600`}>{hizmetStats[ht.value] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Personel İstatistikleri */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {personelListesi.map(personel => {
              const stats = getPersonelStats(personel.isim);
              return (
                <div key={personel.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    <span className="text-3xl">{personel.emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-800 text-lg">{personel.isim}</p>
                      <p className="text-xs text-gray-500">Toplam: {stats.toplam} iş</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {hizmetTurleri.map(ht => {
                      const count = stats[ht.value] || 0;
                      if (count === 0) return null;
                      return (
                        <div key={ht.value} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                          <span className="text-xs text-gray-600">{ht.emoji} {ht.label.split(' ')[0]}</span>
                          <span className="text-xs font-bold text-gray-800">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detaylı Liste */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                📋 Detaylı İş Listesi ({filteredGelinler.length} iş)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saat</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gelin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">💄 Makyaj</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">🧕 Türban</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hizmet Türü</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredGelinler
                    .sort((a, b) => a.tarih.localeCompare(b.tarih))
                    .map(gelin => {
                      const hizmet = hizmetTurleri.find(ht => ht.value === gelin.hizmetTuru);
                      return (
                        <tr key={gelin.id} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(gelin.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{gelin.saat}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-medium text-gray-900">{gelin.isim}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {gelin.makyaj ? (
                              <span className="px-2 py-1 text-xs font-medium bg-pink-100 text-pink-700 rounded-full">
                                {gelin.makyaj}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {gelin.turban ? (
                              <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                {gelin.turban}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {hizmet && (
                              <span className={`px-2 py-1 text-xs font-medium bg-${hizmet.color}-100 text-${hizmet.color}-700 rounded-full`}>
                                {hizmet.emoji} {hizmet.label}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}