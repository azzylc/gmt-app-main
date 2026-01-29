"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from "firebase/firestore";

interface WorkHour {
  id: string;
  isim: string;
  tur: "sabit" | "esnek" | "parttime";
  baslangic: string;
  bitis: string;
  gunler: string[];
  haftalikSaat: number;
  molaSuresi: number;
  aciklama: string;
  aktif: boolean;
}

export default function CalismaSaatleriPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<WorkHour[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<WorkHour | null>(null);
  const [filterTur, setFilterTur] = useState("hepsi");
  const [formData, setFormData] = useState({ 
    isim: '', 
    tur: 'sabit' as 'sabit' | 'esnek' | 'parttime',
    baslangic: '09:00', 
    bitis: '18:00', 
    gunler: [] as string[],
    haftalikSaat: 40,
    molaSuresi: 60,
    aciklama: '',
    aktif: true
  });
  const router = useRouter();

  const turler = {
    sabit: { label: "Sabit Mesai", icon: "🕐", color: "bg-blue-100 text-blue-700", desc: "Belirli saatlerde çalışma" },
    esnek: { label: "Esnek Mesai", icon: "⏰", color: "bg-green-100 text-green-700", desc: "Esnek çalışma saatleri" },
    parttime: { label: "Part-Time", icon: "⏱️", color: "bg-purple-100 text-purple-700", desc: "Yarım gün çalışma" }
  };

  const gunler = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

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

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "workHours"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkHour));
      setSchedules(data);
    });
    return () => unsubscribe();
  }, [user]);

  const aktifSchedules = schedules.filter(s => s.aktif);
  const pasifSchedules = schedules.filter(s => !s.aktif);

  const filteredSchedules = schedules.filter(s => {
    return filterTur === "hepsi" || s.tur === filterTur;
  });

  const calculateHaftalikSaat = (baslangic: string, bitis: string, gunSayisi: number) => {
    const [bh, bm] = baslangic.split(':').map(Number);
    const [bth, btm] = bitis.split(':').map(Number);
    const gunlukSaat = ((bth * 60 + btm) - (bh * 60 + bm)) / 60;
    return gunlukSaat * gunSayisi;
  };

  const handleAdd = async () => {
    if (!formData.isim || formData.gunler.length === 0) {
      alert("Lütfen isim girin ve çalışma günlerini seçin!");
      return;
    }
    
    const haftalikSaat = calculateHaftalikSaat(formData.baslangic, formData.bitis, formData.gunler.length);
    
    try {
      await addDoc(collection(db, "workHours"), { 
        ...formData,
        haftalikSaat,
        createdAt: serverTimestamp() 
      });
      setShowModal(false);
      setFormData({ isim: '', tur: 'sabit', baslangic: '09:00', bitis: '18:00', gunler: [], haftalikSaat: 40, molaSuresi: 60, aciklama: '', aktif: true });
    } catch (error) {
      console.error("Hata:", error);
      alert("Çalışma saati eklenemedi!");
    }
  };

  const handleEdit = async () => {
    if (!selectedSchedule) return;
    
    const haftalikSaat = calculateHaftalikSaat(formData.baslangic, formData.bitis, formData.gunler.length);
    
    try {
      await updateDoc(doc(db, "workHours", selectedSchedule.id), { ...formData, haftalikSaat });
      setShowEditModal(false);
      setSelectedSchedule(null);
      setFormData({ isim: '', tur: 'sabit', baslangic: '09:00', bitis: '18:00', gunler: [], haftalikSaat: 40, molaSuresi: 60, aciklama: '', aktif: true });
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  const handleToggleAktif = async (schedule: WorkHour) => {
    try {
      await updateDoc(doc(db, "workHours", schedule.id), { aktif: !schedule.aktif });
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu çalışma saatini silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "workHours", id));
      } catch (error) {
        console.error("Hata:", error);
      }
    }
  };

  const openEditModal = (schedule: WorkHour) => {
    setSelectedSchedule(schedule);
    setFormData({
      isim: schedule.isim,
      tur: schedule.tur,
      baslangic: schedule.baslangic,
      bitis: schedule.bitis,
      gunler: schedule.gunler,
      haftalikSaat: schedule.haftalikSaat,
      molaSuresi: schedule.molaSuresi,
      aciklama: schedule.aciklama,
      aktif: schedule.aktif
    });
    setShowEditModal(true);
  };

  const toggleGun = (gun: string) => {
    setFormData(prev => ({
      ...prev,
      gunler: prev.gunler.includes(gun) ? prev.gunler.filter(g => g !== gun) : [...prev.gunler, gun]
    }));
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
      
      <div className="md:ml-64 pb-20 md:pb-0">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">⏰ Çalışma Saatleri</h1>
              <p className="text-sm text-gray-500">Mesai saati tanımlamaları</p>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
              ➕ Saat Tanımla
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-blue-100 text-sm mb-1">Toplam Tanım</p>
              <p className="text-3xl font-bold">{schedules.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-green-100 text-sm mb-1">Aktif</p>
              <p className="text-3xl font-bold">{aktifSchedules.length}</p>
            </div>
            <div className="bg-gradient-to-br from-gray-500 to-gray-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-gray-100 text-sm mb-1">Pasif</p>
              <p className="text-3xl font-bold">{pasifSchedules.length}</p>
            </div>
          </div>

          {/* Filtre */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <label className="text-sm font-medium text-gray-700 mb-2 block">🏷️ Mesai Türü:</label>
            <select value={filterTur} onChange={e => setFilterTur(e.target.value)} className="w-full md:w-64 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
              <option value="hepsi">Tüm Türler</option>
              {Object.entries(turler).map(([key, value]) => <option key={key} value={key}>{value.icon} {value.label}</option>)}
            </select>
          </div>

          {/* Liste */}
          <div className="space-y-3">
            {filteredSchedules.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                <span className="text-5xl mb-4 block">⏰</span>
                <p className="text-lg font-medium">Çalışma saati tanımı bulunamadı</p>
              </div>
            ) : (
              filteredSchedules.map(schedule => {
                const tur = turler[schedule.tur];
                
                return (
                  <div key={schedule.id} className={`bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition cursor-pointer ${!schedule.aktif ? 'opacity-60' : ''}`} onClick={() => { setSelectedSchedule(schedule); setShowDetailModal(true); }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800 text-lg">{schedule.isim}</h3>
                          <span className={`text-xs px-3 py-1 rounded-full ${tur.color} font-medium`}>
                            {tur.icon} {tur.label}
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full ${schedule.aktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} font-medium`}>
                            {schedule.aktif ? '✅ Aktif' : '⏸️ Pasif'}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p className="flex items-center gap-2">
                            <span className="font-medium">🕐 Saat:</span>
                            <span>{schedule.baslangic} - {schedule.bitis}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="font-medium">📅 Günler:</span>
                            <span>{schedule.gunler.map(g => g.slice(0, 3)).join(', ')}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="font-medium">⏱️ Haftalık:</span>
                            <span className="font-semibold text-gray-800">{schedule.haftalikSaat} saat</span>
                          </p>
                          {schedule.molaSuresi > 0 && (
                            <p className="flex items-center gap-2">
                              <span className="font-medium">☕ Mola:</span>
                              <span>{schedule.molaSuresi} dakika</span>
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleToggleAktif(schedule)} className={`px-3 py-1 rounded-lg text-sm ${schedule.aktif ? 'bg-gray-200 text-gray-700' : 'bg-green-500 text-white'}`}>
                          {schedule.aktif ? '⏸️' : '▶️'}
                        </button>
                        <button onClick={() => openEditModal(schedule)} className="p-2 hover:bg-gray-100 rounded-lg transition">✏️</button>
                        <button onClick={() => handleDelete(schedule.id)} className="p-2 hover:bg-red-100 rounded-lg transition">🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Yeni Çalışma Saati Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">⏰ Çalışma Saati Tanımla</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">İsim * (örn: Normal Mesai)</label>
                <input type="text" value={formData.isim} onChange={e => setFormData({...formData, isim: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Normal Mesai, Yarım Gün..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mesai Türü *</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(turler).map(([key, value]) => (
                    <button key={key} type="button" onClick={() => setFormData({...formData, tur: key as any})} className={`p-4 rounded-xl border-2 transition text-left ${formData.tur === key ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="text-2xl mb-1">{value.icon}</div>
                      <div className="font-medium text-sm">{value.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{value.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Saati</label>
                  <input type="time" value={formData.baslangic} onChange={e => setFormData({...formData, baslangic: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Saati</label>
                  <input type="time" value={formData.bitis} onChange={e => setFormData({...formData, bitis: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Günleri * ({formData.gunler.length} gün seçili)</label>
                <div className="flex flex-wrap gap-2">
                  {gunler.map(gun => (
                    <button key={gun} type="button" onClick={() => toggleGun(gun)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${formData.gunler.includes(gun) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                      {gun}
                    </button>
                  ))}
                </div>
              </div>
              {formData.baslangic && formData.bitis && formData.gunler.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">📊 Haftalık Toplam Saat: {calculateHaftalikSaat(formData.baslangic, formData.bitis, formData.gunler.length).toFixed(1)} saat</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mola Süresi (dakika)</label>
                <input type="number" value={formData.molaSuresi} onChange={e => setFormData({...formData, molaSuresi: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="60" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ek notlar (opsiyonel)" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium">İptal</button>
                <button onClick={handleAdd} className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium shadow-sm">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Düzenleme Modal - Aynı yapıda */}
      {showEditModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">✏️ Çalışma Saatini Düzenle</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">İsim *</label>
                <input type="text" value={formData.isim} onChange={e => setFormData({...formData, isim: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mesai Türü *</label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(turler).map(([key, value]) => (
                    <button key={key} type="button" onClick={() => setFormData({...formData, tur: key as any})} className={`p-4 rounded-xl border-2 transition text-left ${formData.tur === key ? 'border-pink-500 bg-pink-50' : 'border-gray-200'}`}>
                      <div className="text-2xl mb-1">{value.icon}</div>
                      <div className="font-medium text-sm">{value.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç</label>
                  <input type="time" value={formData.baslangic} onChange={e => setFormData({...formData, baslangic: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş</label>
                  <input type="time" value={formData.bitis} onChange={e => setFormData({...formData, bitis: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Günleri *</label>
                <div className="flex flex-wrap gap-2">
                  {gunler.map(gun => (
                    <button key={gun} type="button" onClick={() => toggleGun(gun)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${formData.gunler.includes(gun) ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      {gun}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mola Süresi (dk)</label>
                <input type="number" value={formData.molaSuresi} onChange={e => setFormData({...formData, molaSuresi: parseInt(e.target.value) || 0})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowEditModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium">İptal</button>
                <button onClick={handleEdit} className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium shadow-sm">Güncelle</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedSchedule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">⏰ Çalışma Saati Detayları</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-500 mb-1">İsim</p>
                <p className="font-semibold text-gray-800 text-lg">{selectedSchedule.isim}</p>
              </div>
              <div className="flex gap-2">
                <span className={`px-4 py-2 rounded-xl ${turler[selectedSchedule.tur].color} font-medium flex-1 text-center`}>
                  {turler[selectedSchedule.tur].icon} {turler[selectedSchedule.tur].label}
                </span>
                <span className={`px-4 py-2 rounded-xl ${selectedSchedule.aktif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'} font-medium`}>
                  {selectedSchedule.aktif ? '✅ Aktif' : '⏸️ Pasif'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-sm text-green-600 mb-1">🕐 Başlangıç</p>
                  <p className="font-bold text-gray-800 text-xl">{selectedSchedule.baslangic}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-600 mb-1">🕐 Bitiş</p>
                  <p className="font-bold text-gray-800 text-xl">{selectedSchedule.bitis}</p>
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-600 mb-2">📅 Çalışma Günleri</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSchedule.gunler.map(gun => (
                    <span key={gun} className="px-3 py-1 bg-blue-200 text-blue-800 rounded-lg text-sm font-medium">{gun}</span>
                  ))}
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-sm text-purple-600 mb-1">⏱️ Haftalık Toplam</p>
                <p className="font-bold text-gray-800 text-2xl">{selectedSchedule.haftalikSaat} saat</p>
              </div>
              {selectedSchedule.molaSuresi > 0 && (
                <div className="p-4 bg-orange-50 rounded-xl">
                  <p className="text-sm text-orange-600 mb-1">☕ Mola Süresi</p>
                  <p className="font-semibold text-gray-800">{selectedSchedule.molaSuresi} dakika</p>
                </div>
              )}
              {selectedSchedule.aciklama && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-2">📝 Açıklama:</p>
                  <p className="text-gray-700">{selectedSchedule.aciklama}</p>
                </div>
              )}
            </div>
            <div className="mt-6">
              <button onClick={() => setShowDetailModal(false)} className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}