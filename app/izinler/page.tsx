"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

interface Leave {
  id: string;
  personel: string;
  izinTuru: "yillik" | "saglik" | "mazeret" | "ucretsiz";
  baslangic: string;
  bitis: string;
  gun: number;
  aciklama: string;
  durum: "beklemede" | "onaylandi" | "reddedildi";
  olusturulmaTarihi: string;
  onaylayanKisi?: string;
  onayTarihi?: string;
  redNedeni?: string;
}

export default function IzinlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<Leave | null>(null);
  const [redNedeni, setRedNedeni] = useState("");
  const [filterDurum, setFilterDurum] = useState<"hepsi" | "beklemede" | "onaylandi" | "reddedildi">("hepsi");
  const [filterPersonel, setFilterPersonel] = useState("hepsi");
  const [formData, setFormData] = useState({ 
    personel: '', 
    izinTuru: 'yillik' as 'yillik' | 'saglik' | 'mazeret' | 'ucretsiz', 
    baslangic: '', 
    bitis: '', 
    aciklama: '' 
  });
  const router = useRouter();

  const personelListesi = ["Gizem", "Saliha", "Selen", "Betül", "Zehra"];
  const izinTurleri = {
    yillik: { label: "Yıllık İzin", icon: "🏖️", color: "bg-blue-100 text-blue-700" },
    saglik: { label: "Sağlık İzni", icon: "🏥", color: "bg-red-100 text-red-700" },
    mazeret: { label: "Mazeret İzni", icon: "📋", color: "bg-yellow-100 text-yellow-700" },
    ucretsiz: { label: "Ücretsiz İzin", icon: "💼", color: "bg-gray-100 text-gray-700" }
  };

  const durumConfig = {
    beklemede: { label: "Beklemede", color: "bg-yellow-100 text-yellow-700", icon: "⏳" },
    onaylandi: { label: "Onaylandı", color: "bg-green-100 text-green-700", icon: "✅" },
    reddedildi: { label: "Reddedildi", color: "bg-red-100 text-red-700", icon: "❌" }
  };

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
    const q = query(collection(db, "leaves"), orderBy("olusturulmaTarihi", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave));
      setLeaves(data);
    });
    return () => unsubscribe();
  }, [user]);

  const bugun = new Date().toISOString().split('T')[0];
  const bekleyen = leaves.filter(l => l.durum === 'beklemede');
  const onaylanan = leaves.filter(l => l.durum === 'onaylandi');
  const reddedilen = leaves.filter(l => l.durum === 'reddedildi');

  const filteredLeaves = leaves.filter(l => {
    const durumMatch = filterDurum === "hepsi" || l.durum === filterDurum;
    const personelMatch = filterPersonel === "hepsi" || l.personel === filterPersonel;
    return durumMatch && personelMatch;
  });

  const calculateDays = (start: string, end: string) => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleAdd = async () => {
    if (!formData.personel || !formData.baslangic || !formData.bitis) {
      alert("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }
    
    const gun = calculateDays(formData.baslangic, formData.bitis);
    
    try {
      await addDoc(collection(db, "leaves"), { 
        ...formData, 
        gun, 
        durum: "beklemede",
        olusturulmaTarihi: bugun,
        createdAt: serverTimestamp() 
      });
      setShowAddModal(false);
      setFormData({ personel: '', izinTuru: 'yillik', baslangic: '', bitis: '', aciklama: '' });
    } catch (error) {
      console.error("İzin eklenirken hata:", error);
      alert("İzin eklenemedi!");
    }
  };

  const handleApprove = async (leave: Leave) => {
    try {
      await updateDoc(doc(db, "leaves", leave.id), { 
        durum: "onaylandi",
        onaylayanKisi: user?.email?.split('@')[0] || 'Yönetici',
        onayTarihi: bugun
      });
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  const handleReject = async () => {
    if (!selectedLeave || !redNedeni.trim()) {
      alert("Lütfen red nedeni yazın!");
      return;
    }
    
    try {
      await updateDoc(doc(db, "leaves", selectedLeave.id), { 
        durum: "reddedildi",
        redNedeni,
        onaylayanKisi: user?.email?.split('@')[0] || 'Yönetici',
        onayTarihi: bugun
      });
      setShowRejectModal(false);
      setSelectedLeave(null);
      setRedNedeni("");
    } catch (error) {
      console.error("Hata:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu izni silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "leaves", id));
      } catch (error) {
        console.error("Hata:", error);
      }
    }
  };

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
              <h1 className="text-xl font-bold text-gray-800">🏖️ İzin Yönetimi</h1>
              <p className="text-sm text-gray-500">İzin talepleri ve onayları</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
              ➕ Yeni İzin Talebi
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-blue-100 text-sm mb-1">Toplam İzin</p>
              <p className="text-3xl font-bold">{leaves.length}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-yellow-100 text-sm mb-1">Bekleyen</p>
              <p className="text-3xl font-bold">{bekleyen.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-green-100 text-sm mb-1">Onaylanan</p>
              <p className="text-3xl font-bold">{onaylanan.length}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-red-100 text-sm mb-1">Reddedilen</p>
              <p className="text-3xl font-bold">{reddedilen.length}</p>
            </div>
          </div>

          {/* Filtreler */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">📊 Durum:</label>
                <select value={filterDurum} onChange={(e) => setFilterDurum(e.target.value as any)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
                  <option value="hepsi">Tüm Durumlar</option>
                  <option value="beklemede">⏳ Beklemede</option>
                  <option value="onaylandi">✅ Onaylananlar</option>
                  <option value="reddedildi">❌ Reddedilenler</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">👤 Personel:</label>
                <select value={filterPersonel} onChange={(e) => setFilterPersonel(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white">
                  <option value="hepsi">Tüm Personel</option>
                  {personelListesi.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* İzin Listesi */}
          <div className="space-y-3">
            {filteredLeaves.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                <span className="text-5xl mb-4 block">🏖️</span>
                <p className="text-lg font-medium">İzin talebi bulunamadı</p>
              </div>
            ) : (
              filteredLeaves.map(leave => {
                const izinTipi = izinTurleri[leave.izinTuru];
                const durum = durumConfig[leave.durum];
                
                return (
                  <div key={leave.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition cursor-pointer" onClick={() => { setSelectedLeave(leave); setShowDetailModal(true); }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-800 text-lg">{leave.personel}</h3>
                          <span className={`text-xs px-3 py-1 rounded-full ${izinTipi.color} font-medium`}>
                            {izinTipi.icon} {izinTipi.label}
                          </span>
                          <span className={`text-xs px-3 py-1 rounded-full ${durum.color} font-medium`}>
                            {durum.icon} {durum.label}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>📅 {formatTarih(leave.baslangic)} - {formatTarih(leave.bitis)} <span className="font-semibold">({leave.gun} gün)</span></p>
                          {leave.aciklama && <p className="text-gray-500">{leave.aciklama}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {leave.durum === 'beklemede' && (
                          <>
                            <button onClick={() => handleApprove(leave)} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium">✓ Onayla</button>
                            <button onClick={() => { setSelectedLeave(leave); setShowRejectModal(true); }} className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium">✗ Reddet</button>
                          </>
                        )}
                        <button onClick={() => handleDelete(leave.id)} className="p-2 hover:bg-red-100 rounded-lg transition text-lg">🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Yeni İzin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">🏖️ Yeni İzin Talebi</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">İzin Türü *</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(izinTurleri).map(([key, value]) => (
                    <button key={key} type="button" onClick={() => setFormData({...formData, izinTuru: key as any})} className={`px-4 py-3 rounded-xl border-2 transition text-left ${formData.izinTuru === key ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-lg">{value.icon}</span>
                      <span className="ml-2 font-medium">{value.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç *</label>
                  <input type="date" value={formData.baslangic} onChange={e => setFormData({...formData, baslangic: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş *</label>
                  <input type="date" value={formData.bitis} onChange={e => setFormData({...formData, bitis: e.target.value})} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
              </div>
              {formData.baslangic && formData.bitis && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-700 font-medium">📅 Toplam İzin Süresi: {calculateDays(formData.baslangic, formData.bitis)} gün</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                <textarea value={formData.aciklama} onChange={e => setFormData({...formData, aciklama: e.target.value})} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" placeholder="İzin sebebi (opsiyonel)" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium">İptal</button>
                <button onClick={handleAdd} className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium shadow-sm">Talep Oluştur</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Red Nedeni Modal */}
      {showRejectModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">❌ İzin Talebini Reddet</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200">
              <p className="text-sm text-red-700 mb-1">Reddedilecek Talep:</p>
              <p className="font-semibold text-gray-800">{selectedLeave.personel} - {izinTurleri[selectedLeave.izinTuru].label}</p>
              <p className="text-sm text-gray-600">{formatTarih(selectedLeave.baslangic)} - {formatTarih(selectedLeave.bitis)}</p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Red Nedeni *</label>
              <textarea value={redNedeni} onChange={e => setRedNedeni(e.target.value)} rows={4} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="İzin talebinin neden reddedildiğini açıklayın..." />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium">İptal</button>
              <button onClick={handleReject} disabled={!redNedeni.trim()} className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-medium shadow-sm disabled:opacity-50">Reddet</button>
            </div>
          </div>
        </div>
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedLeave && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-800">🏖️ İzin Detayları</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-2xl">👤</div>
                <div>
                  <p className="text-sm text-gray-500">Personel</p>
                  <p className="font-semibold text-gray-800 text-lg">{selectedLeave.personel}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className={`px-4 py-2 rounded-xl ${izinTurleri[selectedLeave.izinTuru].color} font-medium`}>
                  {izinTurleri[selectedLeave.izinTuru].icon} {izinTurleri[selectedLeave.izinTuru].label}
                </span>
                <span className={`px-4 py-2 rounded-xl ${durumConfig[selectedLeave.durum].color} font-medium`}>
                  {durumConfig[selectedLeave.durum].icon} {durumConfig[selectedLeave.durum].label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm text-blue-600 mb-1">📅 Başlangıç</p>
                  <p className="font-semibold text-gray-800">{formatTarih(selectedLeave.baslangic)}</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="text-sm text-orange-600 mb-1">📅 Bitiş</p>
                  <p className="font-semibold text-gray-800">{formatTarih(selectedLeave.bitis)}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-600 mb-1">⏱️ Süre</p>
                  <p className="font-semibold text-gray-800">{selectedLeave.gun} gün</p>
                </div>
              </div>
              {selectedLeave.aciklama && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Açıklama:</p>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-xl">{selectedLeave.aciklama}</p>
                </div>
              )}
              {selectedLeave.durum === 'reddedildi' && selectedLeave.redNedeni && (
                <div className="p-5 bg-red-50 rounded-xl border-2 border-red-200">
                  <p className="font-semibold text-red-800 mb-2">❌ Red Nedeni:</p>
                  <p className="text-gray-700">{selectedLeave.redNedeni}</p>
                  {selectedLeave.onaylayanKisi && (
                    <p className="text-sm text-gray-500 mt-2">Reddeden: {selectedLeave.onaylayanKisi} • {selectedLeave.onayTarihi && formatTarih(selectedLeave.onayTarihi)}</p>
                  )}
                </div>
              )}
              {selectedLeave.durum === 'onaylandi' && selectedLeave.onaylayanKisi && (
                <div className="p-5 bg-green-50 rounded-xl border-2 border-green-200">
                  <p className="font-semibold text-green-800 mb-1">✅ Onaylanan Talep</p>
                  <p className="text-sm text-gray-600">Onaylayan: {selectedLeave.onaylayanKisi} • {selectedLeave.onayTarihi && formatTarih(selectedLeave.onayTarihi)}</p>
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