"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import GelinModal from "../components/GelinModal";
import { resmiTatiller } from "../lib/data";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  kisaltma?: string;
  dogumGunu?: string;
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
  kinaGunu?: string;
  telefon?: string;
  esiTelefon?: string;
  instagram?: string;
  fotografci?: string;
  modaevi?: string;
  anlasildigiTarih?: string;
  bilgilendirmeGonderildi?: boolean;
  ucretYazildi?: boolean;
  malzemeListesiGonderildi?: boolean;
  paylasimIzni?: boolean;
  yorumIstesinMi?: string;  // Kişi ismi veya boş
  yorumIstendiMi?: boolean;
  gelinNotu?: string;
  dekontGorseli?: string;
}

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

  // ✅ Personel verisi - Firestore'dan (real-time)
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

  // ✅ Gelin verisi - Firestore'dan (real-time) - APPS SCRIPT YERİNE!
  useEffect(() => {
    if (!user) return;

    console.log('🔄 Firestore gelinler listener başlatılıyor...');
    
    const q = query(
      collection(db, "gelinler"),
      orderBy("tarih", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Gelin));

      console.log(`✅ ${data.length} gelin Firestore'dan yüklendi (real-time)`);
      setGelinler(data);
      setDataLoading(false);
    }, (error) => {
      console.error('❌ Firestore listener hatası:', error);
      setDataLoading(false);
    });

    return () => {
      console.log('🛑 Firestore gelinler listener kapatılıyor...');
      unsubscribe();
    };
  }, [user]);

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

  // Doğum günü kontrolü (ay ve gün eşleşmesi)
  const getDogumGunuPersoneller = (tarih: string) => {
    const [, ay, gun] = tarih.split('-');
    return personeller.filter(p => {
      if (!p.dogumGunu || !p.aktif) return false;
      const [, pAy, pGun] = p.dogumGunu.split('-');
      return pAy === ay && pGun === gun;
    });
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
      
      <div className="md:ml-64 pb-20 md:pb-0">
        <header className="page-header">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">📅 Takvim</h1>
              <p className="page-subtitle">Aylık program görünümü (Firestore Real-time)</p>
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
                  const dayGelinler = isValidDay ? getGelinlerForDate(dateStr) : [];
                  const isToday = dateStr === bugun;
                  const tatilIsmi = isValidDay ? getTatilIsmi(dateStr) : null;
                  const dayOfWeek = isValidDay ? new Date(dateStr).getDay() : -1;
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <div 
                      key={index}
                      className={`
                        border border-gray-100 min-h-[120px] p-2 
                        ${!isValidDay ? 'bg-gray-50' : ''}
                        ${isToday ? 'bg-blue-50 border-blue-300' : ''}
                        ${tatilIsmi ? 'bg-red-50' : ''}
                        ${isWeekend && !tatilIsmi ? 'bg-orange-50' : ''}
                        hover:bg-gray-50 transition-colors cursor-pointer
                      `}
                      onClick={() => {
                        if (isValidDay) {
                          setSelectedDay(dateStr);
                        }
                      }}
                    >
                      {isValidDay && (
                        <>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`
                              text-sm font-medium
                              ${isToday ? 'text-blue-600' : ''}
                              ${tatilIsmi ? 'text-red-600' : ''}
                              ${isWeekend && !tatilIsmi ? 'text-orange-600' : ''}
                            `}>
                              {dayNumber}
                            </span>
                            {dayGelinler.length > 0 && (
                              <span className="text-xs bg-primary-500 text-white px-1.5 py-0.5 rounded-full">
                                {dayGelinler.length}
                              </span>
                            )}
                          </div>

                          {tatilIsmi && (
                            <div className="text-xs text-red-600 font-medium mb-1">
                              🎉 {tatilIsmi}
                            </div>
                          )}

                          {/* Doğum günleri */}
                          {getDogumGunuPersoneller(dateStr).map(p => (
                            <div key={p.id} className="text-xs text-pink-600 font-medium mb-1">
                              🎂 {p.kisaltma || p.ad}
                            </div>
                          ))}

                          <div className="space-y-1">
                            {dayGelinler.slice(0, 3).map((gelin) => (
                              <div 
                                key={gelin.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedGelin(gelin);
                                }}
                                className="text-xs bg-white border border-gray-200 rounded p-1 hover:bg-primary-50 hover:border-primary-300 transition-colors cursor-pointer"
                              >
                                <div className="font-medium text-gray-900 truncate">{gelin.isim}</div>
                                <div className="text-gray-500 text-[10px]">{gelin.saat}</div>
                                <div className="text-gray-600 text-[10px] flex items-center gap-1">
                                  <span>{getKisaltma(gelin.makyaj)}</span>
                                  {gelin.turban && gelin.turban !== gelin.makyaj && (
                                    <>
                                      <span className="text-gray-400">&</span>
                                      <span>{getKisaltma(gelin.turban)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                            {dayGelinler.length > 3 && (
                              <div className="text-xs text-center text-gray-500 py-1">
                                +{dayGelinler.length - 3} daha
                              </div>
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

      {/* Gelin detay modal */}
      {selectedGelin && (
        <GelinModal
          gelin={selectedGelin}
          onClose={() => setSelectedGelin(null)}
        />
      )}

      {/* Gün detay modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {new Date(selectedDay).toLocaleDateString('tr-TR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </h2>
              <button 
                onClick={() => setSelectedDay(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {/* Doğum günleri */}
              {getDogumGunuPersoneller(selectedDay).length > 0 && (
                <div className="mb-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
                  <h4 className="font-semibold text-pink-700 mb-2">🎂 Doğum Günleri</h4>
                  <div className="flex flex-wrap gap-2">
                    {getDogumGunuPersoneller(selectedDay).map(p => (
                      <span key={p.id} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">
                        🎉 {p.ad} {p.soyad}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {getGelinlerForDate(selectedDay).length === 0 ? (
                <p className="text-gray-500 text-center py-8">Bu gün için gelin kaydı yok</p>
              ) : (
                <div className="space-y-3">
                  {getGelinlerForDate(selectedDay).map((gelin) => (
                    <div 
                      key={gelin.id}
                      onClick={() => {
                        setSelectedDay(null);
                        setSelectedGelin(gelin);
                      }}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{gelin.isim}</h3>
                        <span className="text-sm text-gray-500">{gelin.saat}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Makyaj:</span>{' '}
                          <span className="font-medium">{gelin.makyaj || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Türban:</span>{' '}
                          <span className="font-medium">{gelin.turban || '-'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Ücret:</span>{' '}
                          <span className="font-medium">{gelin.ucret.toLocaleString('tr-TR')} ₺</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Kalan:</span>{' '}
                          <span className="font-medium text-amber-600">{gelin.kalan.toLocaleString('tr-TR')} ₺</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}