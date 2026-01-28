"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { getIzinliler, resmiTatiller } from "../lib/data";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  kisaltma?: string;
  aktif: boolean;
}

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
  kinaGunu: string;
  telefon: string;
  esiTelefon: string;
  instagram: string;
  fotografci: string;
  modaevi: string;
  anlasildigiTarih: string;
  bilgilendirmeGonderildi: boolean;
  ucretYazildi: boolean;
  malzemeListesiGonderildi: boolean;
  paylasimIzni: boolean;
  yorumIstesinMi: boolean;
  yorumIstendiMi: boolean;
  gelinNotu: string;
  dekontGorseli: string;
}

const API_URL = "https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec";
const CACHE_KEY = "gmt_gelinler_cache";

export default function TakvimPage() {
  const [user, setUser] = useState<any>(null);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedGelin, setSelectedGelin] = useState<Gelin | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
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

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "personnel"), orderBy("ad", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad || "",
        soyad: doc.data().soyad || "",
        kisaltma: doc.data().kisaltma || "",
        aktif: doc.data().aktif !== false
      } as Personel));
      setPersoneller(data.filter(p => p.aktif));
    });
    return () => unsubscribe();
  }, [user]);

  const fetchGelinler = async () => {
    try {
      const response = await fetch(`${API_URL}?action=gelinler`);
      const data = await response.json();
      setGelinler(data);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    }
    setDataLoading(false);
  };

  const getKisaltma = (isim: string): string => {
    if (!isim) return "-";
    const normalized = isim.trim();
    const personel = personeller.find(p => 
      p.ad.toLocaleLowerCase('tr-TR') === normalized.toLocaleLowerCase('tr-TR')
    );
    return personel?.kisaltma || normalized;
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

  const isTatil = (tarih: string) => {
    return resmiTatiller.some(t => {
      const tatilTarih = new Date(t.tarih);
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
      <div className="min-h-screen flex items-center justify-center bg-neutral-warm">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-warm">
      <Sidebar user={user} />
      
      <div className="ml-64">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">📅 Takvim</h1>
              <p className="page-subtitle">Aylık program görünümü</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">◀️</button>
              <div className="gradient-primary text-white px-4 py-2 rounded-lg font-semibold min-w-[160px] text-center">
                {aylar[month]} {year}
              </div>
              <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition">▶️</button>
              <button onClick={goToToday} className="btn btn-ghost btn-sm ml-2">
                Bugün
              </button>
            </div>
          </div>
        </header>

        <main className="p-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="stat-card">
              <p className="stat-label">Gelin Sayısı</p>
              <p className="stat-value stat-value-primary">{ayGelinler.length}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Kalan Bakiye</p>
              <p className="stat-value stat-value-accent">{ayKalan.toLocaleString('tr-TR')} ₺</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Günlük Ortalama</p>
              <p className="stat-value stat-value-gold">{(ayGelinler.length / daysInMonth).toFixed(1)}</p>
            </div>
          </div>

          {/* Calendar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-7 bg-neutral-cream border-b">
              {gunler.map((gun) => (
                <div key={gun} className="p-2 text-center text-xs font-medium text-gray-600 uppercase">{gun}</div>
              ))}
            </div>

            {dataLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
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
                      className={`calendar-day ${
                        !isValidDay ? 'bg-gray-50' : 
                        tatil ? 'bg-primary-50' :
                        isToday ? 'bg-accent-50' : 
                        isPast ? 'bg-gray-50' :
                        isWeekend ? 'bg-neutral-cream/30' : 'bg-white'
                      }`}
                    >
                      {isValidDay && (
                        <>
                          <div className="calendar-day-header">
                            <div className={`calendar-day-number ${
                              isToday ? 'text-primary-500' : tatil ? 'text-primary-500' : isPast ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {isToday ? (
                                <span className="calendar-day-today">{dayNumber}</span>
                              ) : dayNumber}
                            </div>
                            {gunGelinler.length > 0 && (
                              <button 
                                onClick={() => setSelectedDay(dateStr)}
                                className="text-[10px] text-primary-500 hover:text-primary-600 font-medium"
                              >
                                →
                              </button>
                            )}
                          </div>
                          
                          {tatilIsmi && (
                            <div className="text-[10px] bg-primary-100 text-primary-700 px-1 py-0.5 rounded mb-0.5 truncate font-medium">
                              🏛️ {tatilIsmi}
                            </div>
                          )}
                          
                          <div className="space-y-0.5 max-h-[75px] overflow-y-auto scrollbar-thin">
                            {gunIzinliler.map((izin, idx) => (
                              <div key={idx} className="calendar-event calendar-event-accent">
                                {izin.personel?.emoji} İzinli
                              </div>
                            ))}
                            {gunGelinler.map((gelin) => (
                              <div
                                key={gelin.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGelin(gelin);
                                }}
                                className={`calendar-event ${
                                  isPast ? 'calendar-event-past' : 'calendar-event-primary'
                                }`}
                              >
                                {gelin.saat} {gelin.isim.split(' ')[0]}
                              </div>
                            ))}
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

      {/* Gelin Modal */}
      {selectedGelin && (
        <div className="modal-overlay" onClick={() => setSelectedGelin(null)}>
          <div className="modal modal-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">👰 {selectedGelin.isim}</h3>
              <button onClick={() => setSelectedGelin(null)} className="modal-close">×</button>
            </div>

            <div className="space-y-3">
              {/* Temel */}
              <div className="bg-primary-50 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">📅 Tarih</p>
                    <p className="font-semibold">{new Date(selectedGelin.tarih).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">🕐 Saat</p>
                    <p className="font-semibold">{selectedGelin.saat}</p>
                  </div>
                </div>
              </div>

              {/* Personel */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">💄 Makyaj</p>
                  <p className="font-bold text-sm">{getKisaltma(selectedGelin.makyaj)} - {selectedGelin.makyaj}</p>
                </div>
                <div className="bg-gold-100 rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-1">🧕 Türban</p>
                  <p className="font-bold text-sm">{getKisaltma(selectedGelin.turban)} - {selectedGelin.turban}</p>
                </div>
              </div>

              {/* Mali */}
              <div className="gradient-accent text-white rounded-lg p-3">
                <h4 className="font-bold text-sm mb-2">💰 Mali Bilgiler</h4>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs opacity-80 mb-0.5">Ücret</p>
                    <p className="font-bold">
                      {selectedGelin.ucret === -1 ? '-' : `${selectedGelin.ucret.toLocaleString('tr-TR')} ₺`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs opacity-80 mb-0.5">Kapora</p>
                    <p className="font-bold">{selectedGelin.kapora.toLocaleString('tr-TR')} ₺</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-80 mb-0.5">Kalan</p>
                    <p className="font-bold">
                      {selectedGelin.ucret === -1 ? '-' : `${selectedGelin.kalan.toLocaleString('tr-TR')} ₺`}
                    </p>
                  </div>
                </div>
              </div>

              {selectedGelin.kinaGunu && (
                <div className="bg-gold-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">🎉 Kına Günü</p>
                  <p className="font-semibold text-sm">{selectedGelin.kinaGunu}</p>
                </div>
              )}

              {(selectedGelin.telefon || selectedGelin.esiTelefon || selectedGelin.instagram) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">📞 İletişim</h4>
                  <div className="space-y-1.5 text-sm">
                    {selectedGelin.telefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Telefon:</span>
                        <a href={`tel:${selectedGelin.telefon}`} className="font-semibold text-primary-600 hover:underline">{selectedGelin.telefon}</a>
                      </div>
                    )}
                    {selectedGelin.esiTelefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Eşi Tel:</span>
                        <a href={`tel:${selectedGelin.esiTelefon}`} className="font-semibold text-primary-600 hover:underline">{selectedGelin.esiTelefon}</a>
                      </div>
                    )}
                    {selectedGelin.instagram && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Instagram:</span>
                        <a href={`https://instagram.com/${selectedGelin.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:underline">
                          {selectedGelin.instagram}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedGelin.fotografci || selectedGelin.modaevi) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">🎨 Hizmet Sağlayıcılar</h4>
                  <div className="space-y-1.5 text-sm">
                    {selectedGelin.fotografci && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">📷 Fotoğrafçı:</span>
                        <span className="font-semibold">{selectedGelin.fotografci}</span>
                      </div>
                    )}
                    {selectedGelin.modaevi && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">👗 Modaevi:</span>
                        <span className="font-semibold">{selectedGelin.modaevi}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedGelin.anlasildigiTarih && (
                <div className="bg-gold-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📝 Anlaşıldığı Tarih</p>
                  <p className="font-semibold text-sm">
                    {new Date(selectedGelin.anlasildigiTarih).toLocaleDateString('tr-TR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-bold text-sm mb-2">✅ Durum</h4>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.bilgilendirmeGonderildi ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.bilgilendirmeGonderildi ? '✅' : '⬜'} Bilgilendirme
                  </div>
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.ucretYazildi ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.ucretYazildi ? '✅' : '⬜'} Ücret Yazıldı
                  </div>
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.malzemeListesiGonderildi ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.malzemeListesiGonderildi ? '✅' : '⬜'} Malzeme Listesi
                  </div>
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.paylasimIzni ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.paylasimIzni ? '✅' : '⬜'} Paylaşım İzni
                  </div>
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.yorumIstesinMi ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.yorumIstesinMi ? '✅' : '⬜'} Yorum İstesin
                  </div>
                  <div className={`px-2 py-1.5 rounded text-xs ${selectedGelin.yorumIstendiMi ? 'badge-success' : 'badge-gray'}`}>
                    {selectedGelin.yorumIstendiMi ? '✅' : '⬜'} Yorum İstendi
                  </div>
                </div>
              </div>

              {selectedGelin.gelinNotu && (
                <div className="bg-accent-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-1.5">📝 Not</h4>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{selectedGelin.gelinNotu}</p>
                </div>
              )}

              {selectedGelin.dekontGorseli && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-1.5">🧾 Dekont</h4>
                  <a href={selectedGelin.dekontGorseli} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline break-all">
                    {selectedGelin.dekontGorseli}
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button onClick={() => setSelectedGelin(null)} className="btn btn-ghost w-full">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Günlük Modal */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="modal modal-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                📅 {new Date(selectedDay).toLocaleDateString('tr-TR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h3>
              <button onClick={() => setSelectedDay(null)} className="modal-close">×</button>
            </div>

            <div className="space-y-3">
              {getGelinlerForDate(selectedDay).length === 0 ? (
                <p className="text-center text-gray-500 py-8">Bu gün için gelin bulunmuyor</p>
              ) : (
                getGelinlerForDate(selectedDay).map((gelin) => (
                  <div 
                    key={gelin.id} 
                    className="card card-compact hover:bg-gray-50 transition cursor-pointer"
                    onClick={() => {
                      setSelectedDay(null);
                      setSelectedGelin(gelin);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-base font-bold text-primary-600">{gelin.saat}</span>
                          <span className="text-base font-bold">{gelin.isim}</span>
                        </div>
                        
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="badge badge-primary">{getKisaltma(gelin.makyaj)}</span>
                          <span className="badge badge-gold">{getKisaltma(gelin.turban)}</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs">
                          {gelin.ucret > 0 && <span className="text-gray-600">💰 {gelin.ucret.toLocaleString('tr-TR')} ₺</span>}
                          {gelin.kapora > 0 && <span className="text-gold-600">✅ {gelin.kapora.toLocaleString('tr-TR')} ₺</span>}
                          {gelin.kalan > 0 && <span className="text-primary-600 font-semibold">⏳ {gelin.kalan.toLocaleString('tr-TR')} ₺</span>}
                        </div>
                      </div>

                      <span className="text-gray-400 text-xl">›</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}