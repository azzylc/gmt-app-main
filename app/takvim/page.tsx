"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { getIzinliler, getPersonelByIsim, resmiTatiller } from "../lib/data";

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

export default function TakvimPage() {
  const [user, setUser] = useState<any>(null);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedGelin, setSelectedGelin] = useState<Gelin | null>(null);
  const router = useRouter();

  const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const gunler = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setGelinler(JSON.parse(cached));
        setDataLoading(false);
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
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
    setDataLoading(false);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = lastDayOfMonth.getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  const bugun = new Date().toISOString().split('T')[0];
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getGelinlerForDate = (date: string) => gelinler.filter(g => g.tarih === date);

  // Resmi tatil kontrolü
  const isTatil = (tarih: string) => {
    return resmiTatiller.some(t => {
      const tatilTarih = new Date(t.tarih);
      const kontrol = new Date(tarih);
      for (let i = 0; i < t.sure; i++) {
        const gun = new Date(tatilTarih);
        gun.setDate(tatilTarih.getDate() + i);
        if (gun.toISOString().split('T')[0] === tarih) return true;
      }
      return false;
    });
  };

  const getTatilIsmi = (tarih: string) => {
    for (const t of resmiTatiller) {
      const tatilTarih = new Date(t.tarih);
      for (let i = 0; i < t.sure; i++) {
        const gun = new Date(tatilTarih);
        gun.setDate(tatilTarih.getDate() + i);
        if (gun.toISOString().split('T')[0] === tarih) return t.isim;
      }
    }
    return null;
  };

  const ayGelinler = gelinler.filter(g => g.tarih.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`));
  const ayKalan = ayGelinler.reduce((sum, g) => sum + (g.kalan > 0 ? g.kalan : 0), 0);

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
              <h1 className="text-xl font-bold text-gray-800">📅 Takvim</h1>
              <p className="text-sm text-gray-500">Aylık program görünümü</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">◀️</button>
              <div className="bg-pink-100 text-pink-700 px-4 py-2 rounded-xl font-semibold min-w-[180px] text-center">
                {aylar[month]} {year}
              </div>
              <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">▶️</button>
              <button onClick={goToToday} className="ml-2 bg-gray-100 px-3 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-200">
                Bugün
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {/* Ay özeti */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">{aylar[month]} Gelin Sayısı</p>
              <p className="text-2xl font-bold text-pink-600">{ayGelinler.length}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">{aylar[month]} Kalan Bakiye</p>
              <p className="text-2xl font-bold text-red-600">{ayKalan.toLocaleString('tr-TR')} ₺</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Günlük Ortalama</p>
              <p className="text-2xl font-bold text-blue-600">{(ayGelinler.length / daysInMonth).toFixed(1)}</p>
            </div>
          </div>

          {/* Takvim */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Gün başlıkları */}
            <div className="grid grid-cols-7 bg-gray-50">
              {gunler.map((gun) => (
                <div key={gun} className="p-3 text-center text-xs font-medium text-gray-500">{gun}</div>
              ))}
            </div>

            {dataLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: totalCells }).map((_, index) => {
                  const dayNumber = index - startDay + 1;
                  const isValidDay = dayNumber > 0 && dayNumber <= daysInMonth;
                  const dateStr = isValidDay ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}` : '';
                  const gunGelinler = isValidDay ? getGelinlerForDate(dateStr) : [];
                  const gunIzinliler = isValidDay ? getIzinliler(dateStr) : [];
                  const isToday = dateStr === bugun;
                  const isPast = dateStr < bugun;
                  const isWeekend = index % 7 >= 5;
                  const tatil = isValidDay && isTatil(dateStr);
                  const tatilIsmi = tatil ? getTatilIsmi(dateStr) : null;

                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] border-b border-r p-1 ${
                        !isValidDay ? 'bg-gray-50' : 
                        tatil ? 'bg-red-50' :
                        isToday ? 'bg-pink-50' : 
                        isPast ? 'bg-gray-50' :
                        isWeekend ? 'bg-purple-50/30' : 'bg-white'
                      }`}
                    >
                      {isValidDay && (
                        <>
                          <div className={`text-right text-sm font-medium mb-1 ${
                            isToday ? 'text-pink-600' : tatil ? 'text-red-600' : isPast ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {isToday ? (
                              <span className="bg-pink-500 text-white w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">
                                {dayNumber}
                              </span>
                            ) : dayNumber}
                          </div>
                          
                          {tatilIsmi && (
                            <div className="text-xs bg-red-100 text-red-700 p-1 rounded mb-1 truncate">
                              🏛️ {tatilIsmi}
                            </div>
                          )}
                          
                          <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                            {gunIzinliler.map((izin, idx) => (
                              <div key={idx} className="text-xs bg-orange-100 text-orange-700 p-1 rounded truncate">
                                {izin.personel?.emoji} İzinli
                              </div>
                            ))}
                            {gunGelinler.slice(0, 3).map((gelin) => (
                              <div
                                key={gelin.id}
                                onClick={() => setSelectedGelin(gelin)}
                                className={`text-xs p-1 rounded truncate cursor-pointer ${
                                  isPast ? 'bg-gray-200 text-gray-500' : 'bg-pink-100 text-pink-700 hover:bg-pink-200'
                                }`}
                              >
                                {gelin.saat} {gelin.isim.split(' ')[0]}
                              </div>
                            ))}
                            {gunGelinler.length > 3 && (
                              <div className="text-xs text-gray-500 text-center">+{gunGelinler.length - 3}</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal */}
      {selectedGelin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGelin(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">👰 {selectedGelin.isim}</h3>
              <button onClick={() => setSelectedGelin(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <p className="text-gray-600">📅 {new Date(selectedGelin.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="text-gray-600">🕐 {selectedGelin.saat}</p>
              <p className="text-gray-600">💄 Makyaj: <span className="font-medium">{selectedGelin.makyaj || 'Atanmamış'}</span></p>
              <p className="text-gray-600">🧕 Türban: <span className="font-medium">{selectedGelin.turban || 'Atanmamış'}</span></p>
              <div className="pt-3 border-t">
                <p className="text-gray-600">💰 Ücret: <span className="font-medium">{selectedGelin.ucret === -1 ? 'İşlenmemiş' : `${selectedGelin.ucret.toLocaleString('tr-TR')} ₺`}</span></p>
                <p className="text-gray-600">💳 Kapora: <span className="font-medium text-green-600">{selectedGelin.kapora.toLocaleString('tr-TR')} ₺</span></p>
                <p className="text-gray-600">📌 Kalan: <span className="font-bold text-red-600">{selectedGelin.ucret === -1 ? '-' : `${selectedGelin.kalan.toLocaleString('tr-TR')} ₺`}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
