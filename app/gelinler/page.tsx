"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi, getPersonelByIsim } from "../lib/data";

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
}

const API_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";
const CACHE_KEY = "gmt_gelinler_cache";
const CACHE_TIME_KEY = "gmt_gelinler_cache_time";
const CACHE_DURATION = 30 * 60 * 1000;

export default function GelinlerPage() {
  const [user, setUser] = useState<any>(null);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [filteredGelinler, setFilteredGelinler] = useState<Gelin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [personelFilter, setPersonelFilter] = useState("hepsi");
  const [ayFilter, setAyFilter] = useState("hepsi");
  const [searchTerm, setSearchTerm] = useState("");
  const [ozelFiltre, setOzelFiltre] = useState<string | null>(null);
  const [selectedGelin, setSelectedGelin] = useState<Gelin | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const filtre = searchParams.get('filtre');
    if (filtre) {
      setOzelFiltre(filtre);
    }
  }, [searchParams]);

  const aylar = [
    { value: "01", label: "Ocak" }, { value: "02", label: "Şubat" }, { value: "03", label: "Mart" },
    { value: "04", label: "Nisan" }, { value: "05", label: "Mayıs" }, { value: "06", label: "Haziran" },
    { value: "07", label: "Temmuz" }, { value: "08", label: "Ağustos" }, { value: "09", label: "Eylül" },
    { value: "10", label: "Ekim" }, { value: "11", label: "Kasım" }, { value: "12", label: "Aralık" },
  ];

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const cacheTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cached && cacheTime) {
        const data = JSON.parse(cached);
        setGelinler(data);
        setFilteredGelinler(data);
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        if (!loadFromCache()) fetchGelinler();
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const bugun = new Date().toISOString().split('T')[0];
    let filtered = gelinler;
    
    if (searchTerm) filtered = filtered.filter(g => g.isim.toLowerCase().includes(searchTerm.toLowerCase()));
    if (ayFilter !== "hepsi") filtered = filtered.filter(g => g.tarih.slice(5, 7) === ayFilter);
    if (personelFilter !== "hepsi") filtered = filtered.filter(g => g.makyaj === personelFilter || g.turban === personelFilter);
    
    if (ozelFiltre === 'atanmamis') {
      filtered = filtered.filter(g => g.tarih >= bugun && (!g.makyaj || !g.turban));
    } else if (ozelFiltre === 'islenmemis') {
      filtered = filtered.filter(g => g.tarih >= bugun && g.ucret === -1);
    } else if (ozelFiltre === 'kapora') {
      filtered = filtered.filter(g => g.tarih >= bugun && g.kapora === 0);
    }
    
    setFilteredGelinler(filtered);
  }, [personelFilter, ayFilter, searchTerm, gelinler, ozelFiltre]);

  const fetchGelinler = async () => {
    setDataLoading(true);
    try {
      const response = await fetch(`${API_URL}?action=gelinler`);
      const data = await response.json();
      setGelinler(data);
      setFilteredGelinler(data);
      saveToCache(data);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
    setDataLoading(false);
  };

  const toplamUcret = filteredGelinler.reduce((sum, g) => sum + (g.ucret > 0 ? g.ucret : 0), 0);
  const toplamKapora = filteredGelinler.reduce((sum, g) => sum + (g.kapora > 0 ? g.kapora : 0), 0);
  const toplamKalan = filteredGelinler.reduce((sum, g) => sum + (g.kalan > 0 ? g.kalan : 0), 0);

  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const bugun = new Date().toISOString().split('T')[0];

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
      
      <div className="ml-64">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">👰 Gelinler 2026</h1>
              <p className="text-sm text-gray-500">Toplam {gelinler.length} gelin</p>
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
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Gelin ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
              <select
                value={ayFilter}
                onChange={(e) => setAyFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
              >
                <option value="hepsi">📅 Tüm Aylar</option>
                {aylar.map(ay => <option key={ay.value} value={ay.value}>{ay.label}</option>)}
              </select>
              <select
                value={personelFilter}
                onChange={(e) => setPersonelFilter(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
              >
                <option value="hepsi">👥 Tüm Personel</option>
                {personelListesi.map(p => <option key={p.id} value={p.isim}>{p.emoji} {p.isim}</option>)}
              </select>
              <button
                onClick={() => { 
                  setSearchTerm(""); 
                  setAyFilter("hepsi"); 
                  setPersonelFilter("hepsi"); 
                  setOzelFiltre(null);
                  router.push('/gelinler');
                }}
                className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition text-gray-600"
              >
                ✕ Temizle
              </button>
            </div>
            
            {ozelFiltre && (
              <div className="mt-4 p-3 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-pink-600 font-semibold">
                    {ozelFiltre === 'atanmamis' && '👤 Atanmamış Gelinler'}
                    {ozelFiltre === 'islenmemis' && '💰 İşlenmemiş Ücretler'}
                    {ozelFiltre === 'kapora' && '🔴 Kapora Alınmamış'}
                  </span>
                  <span className="text-pink-500 text-sm">- Filtreleniyor</span>
                </div>
                <button
                  onClick={() => {
                    setOzelFiltre(null);
                    router.push('/gelinler');
                  }}
                  className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                >
                  Kaldır ✕
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Gelin Sayısı</p>
              <p className="text-2xl font-bold text-pink-600">{filteredGelinler.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Toplam Ücret</p>
              <p className="text-2xl font-bold text-blue-600">{toplamUcret.toLocaleString('tr-TR')} ₺</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Alınan Kapora</p>
              <p className="text-2xl font-bold text-green-600">{toplamKapora.toLocaleString('tr-TR')} ₺</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Kalan Bakiye</p>
              <p className="text-2xl font-bold text-red-600">{toplamKalan.toLocaleString('tr-TR')} ₺</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {dataLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
                <p className="mt-4">Yükleniyor...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-4 text-left text-xs font-medium text-gray-500">Gelin</th>
                      <th className="p-4 text-left text-xs font-medium text-gray-500">Tarih</th>
                      <th className="p-4 text-left text-xs font-medium text-gray-500">Saat</th>
                      <th className="p-4 text-left text-xs font-medium text-gray-500">Makyaj</th>
                      <th className="p-4 text-left text-xs font-medium text-gray-500">Türban</th>
                      <th className="p-4 text-right text-xs font-medium text-gray-500">Ücret</th>
                      <th className="p-4 text-right text-xs font-medium text-gray-500">Kapora</th>
                      <th className="p-4 text-right text-xs font-medium text-gray-500">Kalan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredGelinler.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">Gelin bulunamadı</td></tr>
                    ) : (
                      filteredGelinler.map((gelin) => {
                        const isToday = gelin.tarih === bugun;
                        const isPast = gelin.tarih < bugun;
                        return (
                          <tr 
                            key={gelin.id} 
                            onClick={() => setSelectedGelin(gelin)}
                            className={`hover:bg-gray-50 cursor-pointer ${isToday ? 'bg-pink-50' : isPast ? 'opacity-50' : ''}`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                                  {gelin.isim.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">{gelin.isim}</p>
                                  {isToday && <span className="text-xs text-pink-500">Bugün!</span>}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-gray-600">{formatTarih(gelin.tarih)}</td>
                            <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-sm">{gelin.saat}</span></td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs ${gelin.makyaj ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>
                                {gelin.makyaj || 'Atanmamış'}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs ${gelin.turban ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                {gelin.turban || 'Atanmamış'}
                              </span>
                            </td>
                            <td className="p-4 text-right text-sm">
                              {gelin.ucret === -1 ? <span className="text-gray-400">İşlenmemiş</span> : `${gelin.ucret.toLocaleString('tr-TR')} ₺`}
                            </td>
                            <td className="p-4 text-right text-sm text-green-600">{gelin.kapora.toLocaleString('tr-TR')} ₺</td>
                            <td className="p-4 text-right">
                              {gelin.ucret === -1 ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className={`font-bold ${gelin.kalan > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                  {gelin.kalan.toLocaleString('tr-TR')} ₺
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {selectedGelin && (
        <GelinModal gelin={selectedGelin} onClose={() => setSelectedGelin(null)} />
      )}
    </div>
  );
}

function GelinModal({ gelin, onClose }: { gelin: any; onClose: () => void }) {
  const makyajPersonel = getPersonelByIsim(gelin.makyaj);
  const turbanPersonel = gelin.turban && gelin.turban !== gelin.makyaj ? getPersonelByIsim(gelin.turban) : null;
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">👰 Gelin Detayı</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
          
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl flex items-center justify-center text-gray-600 text-2xl font-bold">
              {gelin.isim.charAt(0)}
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-800">{gelin.isim}</p>
              <p className="text-gray-500">{formatTarih(gelin.tarih)} • {gelin.saat}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-pink-50 rounded-xl">
              <p className="text-pink-600 text-sm font-medium mb-2">💄 Makyaj</p>
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
            <div className="p-4 bg-purple-50 rounded-xl">
              <p className="text-purple-600 text-sm font-medium mb-2">🧕 Türban</p>
              {turbanPersonel ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{turbanPersonel.emoji}</span>
                    <span className="font-semibold text-gray-800">{turbanPersonel.isim}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{turbanPersonel.instagram}</p>
                  <p className="text-xs text-gray-500">{turbanPersonel.telefon}</p>
                </>
              ) : makyajPersonel && gelin.turban === gelin.makyaj ? (
                <p className="text-gray-600 text-sm">Makyaj ile aynı</p>
              ) : (
                <p className="text-gray-500">Atanmamış</p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-xl">
            <h4 className="font-medium text-gray-700 mb-3">💰 Ödeme Bilgileri</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-xs">Ücret</p>
                <p className="font-bold text-gray-800">
                  {gelin.ucret === -1 ? <span className="text-gray-400">İşlenmemiş</span> : `${gelin.ucret.toLocaleString('tr-TR')} ₺`}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Kapora</p>
                <p className="font-bold text-green-600">{gelin.kapora.toLocaleString('tr-TR')} ₺</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Kalan</p>
                <p className="font-bold text-red-600">
                  {gelin.ucret === -1 ? '-' : `${gelin.kalan.toLocaleString('tr-TR')} ₺`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}