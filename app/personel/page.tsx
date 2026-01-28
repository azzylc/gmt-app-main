"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi, Personel, izinler, getPersonelById } from "../lib/data";

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

export default function PersonelPage() {
  const [user, setUser] = useState<any>(null);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersonel, setSelectedPersonel] = useState<Personel | null>(null);
  const router = useRouter();

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setGelinler(JSON.parse(cached));
        return true;
      }
    } catch (e) {}
    return false;
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

  const fetchGelinler = async () => {
    try {
      const response = await fetch(`${API_URL}?action=gelinler`);
      const data = await response.json();
      setGelinler(data);
    } catch (error) {}
  };

  const bugun = new Date().toISOString().split('T')[0];
  const buAyStr = bugun.slice(0, 7);

  const getPersonelStats = (isim: string) => {
    const makyajlar = gelinler.filter(g => g.makyaj === isim);
    const turbanlar = gelinler.filter(g => g.turban === isim && g.makyaj !== isim);
    const buAyMakyaj = makyajlar.filter(g => g.tarih.startsWith(buAyStr));
    const buAyTurban = turbanlar.filter(g => g.tarih.startsWith(buAyStr));
    const yaklasanIsler = [...makyajlar, ...turbanlar].filter(g => g.tarih >= bugun).sort((a, b) => a.tarih.localeCompare(b.tarih));
    return {
      toplamIs: makyajlar.length + turbanlar.length,
      makyaj: makyajlar.length,
      turban: turbanlar.length,
      buAyToplam: buAyMakyaj.length + buAyTurban.length,
      yaklasanIsler
    };
  };

  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const formatDogumGunu = (tarih: string) => {
    const d = new Date(tarih);
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  };

  // Doğum günü yakın mı kontrol et
  const isDogumGunuYakin = (dogumGunu: string) => {
    const bugun = new Date();
    const dg = new Date(dogumGunu);
    const buYilDg = new Date(bugun.getFullYear(), dg.getMonth(), dg.getDate());
    if (buYilDg < bugun) buYilDg.setFullYear(bugun.getFullYear() + 1);
    const fark = Math.ceil((buYilDg.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24));
    return fark <= 7;
  };

  // Bugün izinli mi
  const isIzinli = (personelId: string) => {
    return izinler.some(i => i.personelId === personelId && i.baslangic <= bugun && i.bitis >= bugun && i.onayDurumu === 'onaylandi');
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
      
      <div className="ml-64">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">👥 Personel</h1>
              <p className="text-sm text-gray-500">{personelListesi.length} çalışan</p>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Personel Kartları */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {personelListesi.map((personel) => {
              const stats = getPersonelStats(personel.isim);
              const izinli = isIzinli(personel.id);
              const dogumGunuYakin = isDogumGunuYakin(personel.dogumGunu);

              return (
                <div
                  key={personel.id}
                  onClick={() => setSelectedPersonel(personel)}
                  className={`bg-white p-4 rounded-2xl shadow-sm border cursor-pointer transition hover:shadow-md ${
                    izinli ? 'border-orange-200 bg-orange-50' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 bg-gradient-to-br ${personel.renk} rounded-xl flex items-center justify-center text-2xl`}>
                      {personel.emoji}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{personel.isim}</p>
                      <p className="text-xs text-gray-500">{personel.rol}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Bu ay:</span>
                    <span className="font-bold text-pink-600">{stats.buAyToplam} iş</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-500">Toplam:</span>
                    <span className="font-bold text-gray-700">{stats.toplamIs} iş</span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {izinli && (
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">🏖️ İzinli</span>
                    )}
                    {dogumGunuYakin && (
                      <span className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded-full">🎂 Yakında!</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Personel Detay Modal */}
      {selectedPersonel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPersonel(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Personel Detayı</h3>
                <button onClick={() => setSelectedPersonel(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
              </div>

              {/* Profil */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-20 h-20 bg-gradient-to-br ${selectedPersonel.renk} rounded-2xl flex items-center justify-center text-4xl`}>
                  {selectedPersonel.emoji}
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-800">{selectedPersonel.isim}</p>
                  <p className="text-gray-500">{selectedPersonel.rol}</p>
                  {isIzinli(selectedPersonel.id) && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full mt-1 inline-block">🏖️ Bugün İzinli</span>
                  )}
                </div>
              </div>

              {/* Bilgiler */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-gray-500 text-sm">📱 Telefon</p>
                  <p className="font-medium text-gray-800">{selectedPersonel.telefon}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-gray-500 text-sm">📸 Instagram</p>
                  <p className="font-medium text-pink-600">{selectedPersonel.instagram}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-gray-500 text-sm">🎂 Doğum Günü</p>
                  <p className="font-medium text-gray-800">{formatDogumGunu(selectedPersonel.dogumGunu)}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-gray-500 text-sm">🕐 Çalışma Saatleri</p>
                  <p className="font-medium text-gray-800">{selectedPersonel.calismaSaatleri}</p>
                </div>
              </div>

              {/* İstatistikler */}
              <div className="grid grid-cols-4 gap-3 mb-6">
                <div className="bg-pink-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-bold text-pink-600">{getPersonelStats(selectedPersonel.isim).toplamIs}</p>
                  <p className="text-xs text-gray-500">Toplam İş</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-bold text-purple-600">{getPersonelStats(selectedPersonel.isim).makyaj}</p>
                  <p className="text-xs text-gray-500">Makyaj</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-bold text-blue-600">{getPersonelStats(selectedPersonel.isim).turban}</p>
                  <p className="text-xs text-gray-500">Türban</p>
                </div>
                <div className="bg-green-50 p-3 rounded-xl text-center">
                  <p className="text-2xl font-bold text-green-600">{getPersonelStats(selectedPersonel.isim).buAyToplam}</p>
                  <p className="text-xs text-gray-500">Bu Ay</p>
                </div>
              </div>

              {/* Yaklaşan İşler */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <h4 className="font-medium text-gray-800 mb-3">📅 Yaklaşan İşler</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {getPersonelStats(selectedPersonel.isim).yaklasanIsler.slice(0, 5).map((gelin) => (
                    <div key={gelin.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{gelin.isim}</p>
                        <p className="text-xs text-gray-500">{formatTarih(gelin.tarih)} • {gelin.saat}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        gelin.makyaj === selectedPersonel.isim && gelin.turban === selectedPersonel.isim
                          ? 'bg-green-100 text-green-700'
                          : gelin.makyaj === selectedPersonel.isim
                          ? 'bg-pink-100 text-pink-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {gelin.makyaj === selectedPersonel.isim && gelin.turban === selectedPersonel.isim
                          ? 'Tam Set'
                          : gelin.makyaj === selectedPersonel.isim
                          ? 'Makyaj'
                          : 'Türban'}
                      </span>
                    </div>
                  ))}
                  {getPersonelStats(selectedPersonel.isim).yaklasanIsler.length === 0 && (
                    <p className="text-gray-500 text-sm text-center py-4">Yaklaşan iş yok</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
