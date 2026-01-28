"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, where, serverTimestamp } from "firebase/firestore";

interface Attendance {
  id: string;
  personel: string;
  tarih: string;
  giris: string;
  cikis: string;
  toplamSure: number;
  gecikme: number;
  erkenCikis: number;
  notlar: string;
}

export default function GirisCikisPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Attendance | null>(null);
  const [filterTarih, setFilterTarih] = useState(new Date().toISOString().split('T')[0]);
  const [filterPersonel, setFilterPersonel] = useState("hepsi");
  const [formData, setFormData] = useState({ 
    personel: '', 
    tarih: new Date().toISOString().split('T')[0], 
    giris: '', 
    cikis: '', 
    notlar: '' 
  });
  const router = useRouter();

  const personelListesi = ["Gizem", "Saliha", "Selen", "Betül", "Zehra"];
  const mesaiBaslangic = "09:00";
  const mesaiBitis = "18:00";

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
    const q = query(collection(db, "attendance"), orderBy("tarih", "desc"), orderBy("giris", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance));
      setRecords(data);
    });
    return () => unsubscribe();
  }, [user]);

  const calculateDuration = (giris: string, cikis: string) => {
    const [gh, gm] = giris.split(':').map(Number);
    const [ch, cm] = cikis.split(':').map(Number);
    const gMinutes = gh * 60 + gm;
    const cMinutes = ch * 60 + cm;
    return (cMinutes - gMinutes) / 60;
  };

  const calculateDelay = (giris: string) => {
    const [h, m] = giris.split(':').map(Number);
    const minutes = h * 60 + m;
    const [eh, em] = mesaiBaslangic.split(':').map(Number);
    const expectedStart = eh * 60 + em;
    return Math.max(0, minutes - expectedStart);
  };

  const calculateEarlyLeave = (cikis: string) => {
    const [h, m] = cikis.split(':').map(Number);
    const minutes = h * 60 + m;
    const [eh, em] = mesaiBitis.split(':').map(Number);
    const expectedEnd = eh * 60 + em;
    return Math.max(0, expectedEnd - minutes);
  };

  const handleAdd = async () => {
    if (!formData.personel || !formData.tarih || !formData.giris || !formData.cikis) {
      alert("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }
    
    const toplamSure = calculateDuration(formData.giris, formData.cikis);
    const gecikme = calculateDelay(formData.giris);
    const erkenCikis = calculateEarlyLeave(formData.cikis);
    
    try {
      await addDoc(collection(db, "attendance"), {
        ...formData,
        toplamSure,
        gecikme,
        erkenCikis,
        createdAt: serverTimestamp()
      });
      setShowModal(false);
      setFormData({ personel: '', tarih: new Date().toISOString().split('T')[0], giris: '', cikis: '', notlar: '' });
    } catch (error) {
      console.error("Hata:", error);
      alert("Kayıt eklenemedi!");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu kaydı silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "attendance", id));
      } catch (error) {
        console.error("Hata:", error);
      }
    }
  };

  const filteredRecords = records.filter(r => {
    const tarihMatch = r.tarih === filterTarih;
    const personelMatch = filterPersonel === "hepsi" || r.personel === filterPersonel;
    return tarihMatch && personelMatch;
  });

  const bugunToplamSure = filteredRecords.reduce((sum, r) => sum + (r.toplamSure || 0), 0);
  const bugunGecikme = filteredRecords.reduce((sum, r) => sum + (r.gecikme || 0), 0);
  const gecikenSayisi = filteredRecords.filter(r => r.gecikme > 0).length;

  const formatTarih = (tarih: string) => {
    return new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
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
              <h1 className="text-xl font-bold text-gray-800">🕐 Giriş-Çıkış Kayıtları</h1>
              <p className="text-sm text-gray-500">Personel mesai takibi</p>
            </div>
            <button onClick={() => setShowModal(true)} className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
              ➕ Yeni Kayıt
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* Filtreler */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">📅 Tarih:</label>
                <input type="date" value={filterTarih} onChange={e => setFilterTarih(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">👤 Personel:</label>
                <select value={filterPersonel} onChange={e => setFilterPersonel(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
                  <option value="hepsi">Tüm Personel</option>
                  {personelListesi.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* İstatistikler */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-blue-100 text-sm mb-1">Toplam Kayıt</p>
              <p className="text-3xl font-bold">{filteredRecords.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-green-100 text-sm mb-1">Toplam Saat</p>
              <p className="text-3xl font-bold">{bugunToplamSure.toFixed(1)}h</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-red-100 text-sm mb-1">Geciken</p>
              <p className="text-3xl font-bold">{gecikenSayisi}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-orange-100 text-sm mb-1">Toplam Gecikme</p>
              <p className="text-3xl font-bold">{bugunGecikme} dk</p>
            </div>
          </div>

          {/* Kayıt Tablosu */}
          {filteredRecords.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
              <span className="text-5xl mb-4 block">🕐</span>
              <p className="text-lg font-medium">Bu tarihte kayıt bulunamadı</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Personel</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Giriş</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Çıkış</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Toplam</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecords.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center">
                              <span className="text-pink-600 font-semibold text-sm">{record.personel[0]}</span>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{record.personel}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.giris}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{record.cikis}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{record.toplamSure?.toFixed(1)}h</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            {record.gecikme > 0 ? (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full inline-flex items-center gap-1">
                                ⚠️ {record.gecikme} dk gecikme
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full inline-flex items-center gap-1">
                                ✅ Zamanında
                              </span>
                            )}
                            {record.erkenCikis > 0 && (
                              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full inline-flex items-center gap-1">
                                ⏰ {record.erkenCikis} dk erken
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:text-red-800 text-lg">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Yeni Kayıt Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">🕐 Yeni Giriş-Çıkış Kaydı</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Personel *</label>
                <select value={formData.personel} onChange={e => setFormData({...formData, personel: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
                  <option value="">Seçin...</option>
                  {personelListesi.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tarih *</label>
                <input type="date" value={formData.tarih} onChange={e => setFormData({...formData, tarih: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Saati *</label>
                  <input type="time" value={formData.giris} onChange={e => setFormData({...formData, giris: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Saati *</label>
                  <input type="time" value={formData.cikis} onChange={e => setFormData({...formData, cikis: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
              </div>
              {formData.giris && formData.cikis && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-2">
                  <p className="text-sm text-blue-700 font-medium">⏱️ Toplam Çalışma: {calculateDuration(formData.giris, formData.cikis).toFixed(1)} saat</p>
                  {calculateDelay(formData.giris) > 0 && (
                    <p className="text-sm text-red-600 font-medium">⚠️ Gecikme: {calculateDelay(formData.giris)} dakika</p>
                  )}
                  {calculateEarlyLeave(formData.cikis) > 0 && (
                    <p className="text-sm text-orange-600 font-medium">⏰ Erken Çıkış: {calculateEarlyLeave(formData.cikis)} dakika</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                <textarea value={formData.notlar} onChange={e => setFormData({...formData, notlar: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="Ek notlar (opsiyonel)" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium">İptal</button>
                <button onClick={handleAdd} className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium shadow-sm">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">🕐 Kayıt Detayları</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center text-xl">👤</div>
                <div>
                  <p className="text-sm text-gray-500">Personel</p>
                  <p className="font-semibold text-gray-800">{selectedRecord.personel}</p>
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-600 mb-1">📅 Tarih</p>
                <p className="font-semibold text-gray-800">{formatTarih(selectedRecord.tarih)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-green-50 rounded-xl">
                  <p className="text-sm text-green-600 mb-1">🟢 Giriş</p>
                  <p className="font-bold text-gray-800 text-xl">{selectedRecord.giris}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl">
                  <p className="text-sm text-red-600 mb-1">🔴 Çıkış</p>
                  <p className="font-bold text-gray-800 text-xl">{selectedRecord.cikis}</p>
                </div>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl">
                <p className="text-sm text-purple-600 mb-1">⏱️ Toplam Çalışma Süresi</p>
                <p className="font-bold text-gray-800 text-2xl">{selectedRecord.toplamSure?.toFixed(1)} saat</p>
              </div>
              {selectedRecord.gecikme > 0 && (
                <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                  <p className="text-sm text-red-600 mb-1">⚠️ Gecikme</p>
                  <p className="font-semibold text-red-700">{selectedRecord.gecikme} dakika</p>
                </div>
              )}
              {selectedRecord.erkenCikis > 0 && (
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="text-sm text-orange-600 mb-1">⏰ Erken Çıkış</p>
                  <p className="font-semibold text-orange-700">{selectedRecord.erkenCikis} dakika</p>
                </div>
              )}
              {selectedRecord.notlar && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500 mb-2">📝 Notlar:</p>
                  <p className="text-gray-700">{selectedRecord.notlar}</p>
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