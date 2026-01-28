"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi } from "../lib/data";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";

interface Task {
  id: string;
  baslik: string;
  aciklama: string;
  oncelik: "dusuk" | "orta" | "yuksek";
  durum: "yapilacak" | "devamEdiyor" | "tamamlandi";
  atananKisi: string;
  bitisTarihi: string;
  olusturulmaTarihi: string;
  tamamlanmaTarihi?: string;
  tamamlanmaAciklamasi?: string;
}

export default function GorevlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  const [filterKisi, setFilterKisi] = useState("hepsi");
  const [filterOncelik, setFilterOncelik] = useState("hepsi");
  const [filterDurum, setFilterDurum] = useState<"hepsi" | "aktif" | "tamamlandi">("aktif");
  const [showTamamlananlar, setShowTamamlananlar] = useState(false);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    baslik: '',
    aciklama: '',
    atananKisi: '',
    bitisTarihi: '',
    oncelik: 'orta' as 'dusuk' | 'orta' | 'yuksek'
  });
  const [completeNote, setCompleteNote] = useState("");
  
  const router = useRouter();

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

  // Firestore'dan görevleri dinle
  useEffect(() => {
    if (!user) return;
    
    const q = query(collection(db, "tasks"), orderBy("olusturulmaTarihi", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));
      setTasks(data);
    });
    
    return () => unsubscribe();
  }, [user]);

  const bugun = new Date().toISOString().split('T')[0];

  // İstatistikler
  const aktifGorevler = tasks.filter(t => t.durum !== 'tamamlandi');
  const tamamlananGorevler = tasks.filter(t => t.durum === 'tamamlandi');
  const gecikmisGorevler = aktifGorevler.filter(t => t.bitisTarihi < bugun);

  // Filtreleme
  const filteredTasks = tasks.filter(t => {
    const kisiMatch = filterKisi === "hepsi" || t.atananKisi === filterKisi;
    const oncelikMatch = filterOncelik === "hepsi" || t.oncelik === filterOncelik;
    const durumMatch = filterDurum === "hepsi" || 
                       (filterDurum === "aktif" && t.durum !== "tamamlandi") ||
                       (filterDurum === "tamamlandi" && t.durum === "tamamlandi");
    return kisiMatch && oncelikMatch && durumMatch;
  });

  const aktifFiltered = filteredTasks.filter(t => t.durum !== 'tamamlandi');
  const tamamlananFiltered = filteredTasks.filter(t => t.durum === 'tamamlandi');

  // Görev Ekleme
  const handleAddTask = async () => {
    if (!formData.baslik || !formData.atananKisi || !formData.bitisTarihi) {
      alert("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }
    
    try {
      await addDoc(collection(db, "tasks"), {
        baslik: formData.baslik,
        aciklama: formData.aciklama,
        oncelik: formData.oncelik,
        durum: "yapilacak",
        atananKisi: formData.atananKisi,
        bitisTarihi: formData.bitisTarihi,
        olusturulmaTarihi: bugun,
        createdAt: serverTimestamp()
      });
      
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error("Görev eklenirken hata:", error);
      alert("Görev eklenemedi!");
    }
  };

  // Görev Düzenleme
  const handleEditTask = async () => {
    if (!selectedTask || !formData.baslik || !formData.atananKisi || !formData.bitisTarihi) {
      alert("Lütfen tüm zorunlu alanları doldurun!");
      return;
    }
    
    try {
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        baslik: formData.baslik,
        aciklama: formData.aciklama,
        oncelik: formData.oncelik,
        atananKisi: formData.atananKisi,
        bitisTarihi: formData.bitisTarihi
      });
      
      setShowEditModal(false);
      setSelectedTask(null);
      resetForm();
    } catch (error) {
      console.error("Görev güncellenirken hata:", error);
      alert("Görev güncellenemedi!");
    }
  };

  // Görev Tamamlama
  const handleCompleteTask = async () => {
    if (!selectedTask || !completeNote.trim()) {
      alert("Lütfen tamamlanma açıklaması yazın!");
      return;
    }
    
    try {
      await updateDoc(doc(db, "tasks", selectedTask.id), {
        durum: "tamamlandi",
        tamamlanmaTarihi: bugun,
        tamamlanmaAciklamasi: completeNote
      });
      
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompleteNote("");
    } catch (error) {
      console.error("Görev tamamlanırken hata:", error);
      alert("Görev tamamlanamadı!");
    }
  };

  // Durum Değiştirme
  const handleChangeStatus = async (task: Task, newStatus: Task['durum']) => {
    if (newStatus === "tamamlandi") {
      setSelectedTask(task);
      setShowCompleteModal(true);
    } else {
      try {
        await updateDoc(doc(db, "tasks", task.id), {
          durum: newStatus
        });
      } catch (error) {
        console.error("Durum değiştirilirken hata:", error);
      }
    }
  };

  // Görev Silme
  const handleDeleteTask = async (id: string) => {
    if (confirm("Bu görevi silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "tasks", id));
      } catch (error) {
        console.error("Görev silinirken hata:", error);
        alert("Görev silinemedi!");
      }
    }
  };

  // Düzenleme için modal aç
  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      baslik: task.baslik,
      aciklama: task.aciklama,
      atananKisi: task.atananKisi,
      bitisTarihi: task.bitisTarihi,
      oncelik: task.oncelik
    });
    setShowEditModal(true);
  };

  // Detay modal aç
  const openDetailModal = (task: Task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({ baslik: '', aciklama: '', atananKisi: '', bitisTarihi: '', oncelik: 'orta' });
  };

  const formatTarih = (tarih: string) => {
    return new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const priorityConfig = {
    dusuk: { label: 'Düşük', color: 'bg-green-100 text-green-700', icon: '🟢' },
    orta: { label: 'Orta', color: 'bg-yellow-100 text-yellow-700', icon: '🟡' },
    yuksek: { label: 'Yüksek', color: 'bg-red-100 text-red-700', icon: '🔴' }
  };

  const statusConfig = {
    yapilacak: { label: 'Yapılacak', color: 'bg-gray-100 text-gray-700', icon: '⏳' },
    devamEdiyor: { label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-700', icon: '🔄' },
    tamamlandi: { label: 'Tamamlandı', color: 'bg-green-100 text-green-700', icon: '✅' }
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
        {/* Header */}
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">📋 Görev Yönetimi</h1>
              <p className="text-sm text-gray-500">Ekip görevlerini takip edin</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm"
            >
              ➕ Yeni Görev
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* İstatistikler */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-blue-100 text-sm mb-1">Toplam Görev</p>
              <p className="text-3xl font-bold">{tasks.length}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-yellow-100 text-sm mb-1">Aktif Görevler</p>
              <p className="text-3xl font-bold">{aktifGorevler.length}</p>
            </div>
            <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-red-100 text-sm mb-1">Gecikmiş</p>
              <p className="text-3xl font-bold">{gecikmisGorevler.length}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-2xl shadow-md text-white">
              <p className="text-green-100 text-sm mb-1">Tamamlanan</p>
              <p className="text-3xl font-bold">{tamamlananGorevler.length}</p>
            </div>
          </div>

          {/* Filtreler */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">👤 Kişi:</label>
                <select
                  value={filterKisi}
                  onChange={(e) => setFilterKisi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  <option value="hepsi">Tüm Kişiler</option>
                  {personelListesi.map(p => (
                    <option key={p.id} value={p.isim}>{p.emoji} {p.isim}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">⚡ Öncelik:</label>
                <select
                  value={filterOncelik}
                  onChange={(e) => setFilterOncelik(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  <option value="hepsi">Tüm Öncelikler</option>
                  <option value="yuksek">🔴 Yüksek</option>
                  <option value="orta">🟡 Orta</option>
                  <option value="dusuk">🟢 Düşük</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">📊 Durum:</label>
                <select
                  value={filterDurum}
                  onChange={(e) => setFilterDurum(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  <option value="hepsi">Tümü</option>
                  <option value="aktif">Aktif Görevler</option>
                  <option value="tamamlandi">Tamamlananlar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Aktif Görevler */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">🔥 Aktif Görevler</h2>
            <div className="space-y-3">
              {aktifFiltered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
                  <span className="text-5xl mb-4 block">📭</span>
                  <p className="text-lg font-medium">Aktif görev bulunamadı</p>
                </div>
              ) : (
                aktifFiltered.map(task => <TaskCard 
                  key={task.id} 
                  task={task}
                  bugun={bugun}
                  onChangeStatus={handleChangeStatus}
                  onEdit={openEditModal}
                  onDelete={handleDeleteTask}
                  onClick={openDetailModal}
                  priorityConfig={priorityConfig}
                  statusConfig={statusConfig}
                />)
              )}
            </div>
          </div>

          {/* Tamamlanan Görevler */}
          <div>
            <button
              onClick={() => setShowTamamlananlar(!showTamamlananlar)}
              className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-4 hover:text-pink-600 transition"
            >
              <span className={`transform transition-transform ${showTamamlananlar ? 'rotate-90' : ''}`}>▶</span>
              ✅ Tamamlanan Görevler ({tamamlananFiltered.length})
            </button>
            
            {showTamamlananlar && (
              <div className="space-y-3">
                {tamamlananFiltered.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
                    <p>Henüz tamamlanan görev yok</p>
                  </div>
                ) : (
                  tamamlananFiltered.map(task => <TaskCard 
                    key={task.id}
                    task={task}
                    bugun={bugun}
                    onChangeStatus={handleChangeStatus}
                    onEdit={openEditModal}
                    onDelete={handleDeleteTask}
                    onClick={openDetailModal}
                    priorityConfig={priorityConfig}
                    statusConfig={statusConfig}
                    isCompleted
                  />)
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Yeni Görev Modal */}
      {showAddModal && (
        <TaskModal
          title="➕ Yeni Görev"
          formData={formData}
          setFormData={setFormData}
          onSave={handleAddTask}
          onClose={() => { setShowAddModal(false); resetForm(); }}
          personelListesi={personelListesi}
        />
      )}

      {/* Düzenle Modal */}
      {showEditModal && selectedTask && (
        <TaskModal
          title="✏️ Görevi Düzenle"
          formData={formData}
          setFormData={setFormData}
          onSave={handleEditTask}
          onClose={() => { setShowEditModal(false); setSelectedTask(null); resetForm(); }}
          personelListesi={personelListesi}
          isEdit
        />
      )}

      {/* Tamamlama Modal */}
      {showCompleteModal && selectedTask && (
        <CompleteModal
          task={selectedTask}
          note={completeNote}
          setNote={setCompleteNote}
          onComplete={handleCompleteTask}
          onClose={() => { setShowCompleteModal(false); setSelectedTask(null); setCompleteNote(""); }}
        />
      )}

      {/* Detay Modal */}
      {showDetailModal && selectedTask && (
        <DetailModal
          task={selectedTask}
          onClose={() => { setShowDetailModal(false); setSelectedTask(null); }}
          formatTarih={formatTarih}
          priorityConfig={priorityConfig}
          statusConfig={statusConfig}
        />
      )}
    </div>
  );
}

// Task Card Component
function TaskCard({ task, bugun, onChangeStatus, onEdit, onDelete, onClick, priorityConfig, statusConfig, isCompleted = false }: any) {
  const isOverdue = !isCompleted && task.bitisTarihi < bugun;
  const personel = personelListesi.find(p => p.isim === task.atananKisi);
  const priority = priorityConfig[task.oncelik];
  const status = statusConfig[task.durum];

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition cursor-pointer ${
        isCompleted ? 'opacity-70' : ''
      } ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-100'}`}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start gap-4">
        {/* Sol: Durum */}
        <div className="flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${
            task.durum === 'tamamlandi' ? 'bg-green-500' :
            task.durum === 'devamEdiyor' ? 'bg-blue-500' : 'bg-gray-300'
          }`}></div>
        </div>

        {/* Orta: İçerik */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-gray-800 text-lg">{task.baslik}</h3>
            <div className="flex gap-2 flex-shrink-0">
              <span className={`text-xs px-2 py-1 rounded-full ${priority.color} font-medium`}>
                {priority.icon} {priority.label}
              </span>
            </div>
          </div>

          {task.aciklama && (
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{task.aciklama}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm">
            {/* Atanan Kişi */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-lg">
                {personel?.emoji || '👤'}
              </div>
              <span className="text-gray-700 font-medium">{task.atananKisi}</span>
            </div>

            {/* Tarih */}
            <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
              📅 {new Date(task.bitisTarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
              {isOverdue && <span className="ml-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">GECİKMİŞ!</span>}
            </div>

            {/* Durum Badge */}
            <span className={`text-xs px-3 py-1 rounded-full ${status.color} font-medium`}>
              {status.icon} {status.label}
            </span>
          </div>
        </div>

        {/* Sağ: Aksiyonlar */}
        <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
          {!isCompleted && (
            <div className="flex gap-1">
              {task.durum !== 'devamEdiyor' && (
                <button
                  onClick={() => onChangeStatus(task, 'devamEdiyor')}
                  className="p-2 hover:bg-blue-100 rounded-lg transition"
                  title="Devam Ediyor"
                >
                  🔄
                </button>
              )}
              {task.durum !== 'tamamlandi' && (
                <button
                  onClick={() => onChangeStatus(task, 'tamamlandi')}
                  className="p-2 hover:bg-green-100 rounded-lg transition"
                  title="Tamamla"
                >
                  ✅
                </button>
              )}
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(task)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Düzenle"
            >
              ✏️
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-2 hover:bg-red-100 rounded-lg transition"
              title="Sil"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Task Modal Component
function TaskModal({ title, formData, setFormData, onSave, onClose, personelListesi, isEdit = false }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Görev Başlığı *</label>
            <input
              type="text"
              value={formData.baslik}
              onChange={e => setFormData({ ...formData, baslik: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Görev başlığını yazın..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
            <textarea
              value={formData.aciklama}
              onChange={e => setFormData({ ...formData, aciklama: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Görev detaylarını açıklayın..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Atanan Kişi *</label>
              <select
                value={formData.atananKisi}
                onChange={e => setFormData({ ...formData, atananKisi: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
              >
                <option value="">Seçin...</option>
                {personelListesi.map((p: any) => (
                  <option key={p.id} value={p.isim}>{p.emoji} {p.isim}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Tarihi *</label>
              <input
                type="date"
                value={formData.bitisTarihi}
                onChange={e => setFormData({ ...formData, bitisTarihi: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Öncelik</label>
            <div className="grid grid-cols-3 gap-3">
              {(['dusuk', 'orta', 'yuksek'] as const).map(oncelik => (
                <button
                  key={oncelik}
                  type="button"
                  onClick={() => setFormData({ ...formData, oncelik })}
                  className={`px-4 py-3 rounded-xl border-2 transition ${
                    formData.oncelik === oncelik
                      ? 'border-pink-500 bg-pink-50 text-pink-700 font-semibold'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {oncelik === 'dusuk' && '🟢 Düşük'}
                  {oncelik === 'orta' && '🟡 Orta'}
                  {oncelik === 'yuksek' && '🔴 Yüksek'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium"
            >
              İptal
            </button>
            <button
              onClick={onSave}
              className="flex-1 px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium shadow-sm"
            >
              {isEdit ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Complete Modal Component
function CompleteModal({ task, note, setNote, onComplete, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">✅ Görevi Tamamla</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
        </div>

        <div className="mb-6 p-4 bg-green-50 rounded-xl border border-green-200">
          <p className="text-sm text-green-700 mb-1">Tamamlanacak Görev:</p>
          <p className="font-semibold text-gray-800">{task.baslik}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tamamlanma Açıklaması *
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Görevi nasıl tamamladınız? Ne yaptınız? Sonuç nedir?"
          />
          <p className="text-xs text-gray-500 mt-2">Bu açıklama görev geçmişinde saklanacak.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition font-medium"
          >
            İptal
          </button>
          <button
            onClick={onComplete}
            disabled={!note.trim()}
            className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tamamla
          </button>
        </div>
      </div>
    </div>
  );
}

// Detail Modal Component
function DetailModal({ task, onClose, formatTarih, priorityConfig, statusConfig }: any) {
  const priority = priorityConfig[task.oncelik];
  const status = statusConfig[task.durum];
  const personel = personelListesi.find(p => p.isim === task.atananKisi);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800">📋 Görev Detayları</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-3xl">×</button>
        </div>

        <div className="space-y-6">
          {/* Başlık */}
          <div>
            <h4 className="text-2xl font-bold text-gray-900">{task.baslik}</h4>
          </div>

          {/* Durum ve Öncelik */}
          <div className="flex gap-3">
            <span className={`px-4 py-2 rounded-xl ${status.color} font-medium`}>
              {status.icon} {status.label}
            </span>
            <span className={`px-4 py-2 rounded-xl ${priority.color} font-medium`}>
              {priority.icon} {priority.label}
            </span>
          </div>

          {/* Atanan Kişi */}
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-2xl">
              {personel?.emoji || '👤'}
            </div>
            <div>
              <p className="text-sm text-gray-500">Atanan Kişi</p>
              <p className="font-semibold text-gray-800">{task.atananKisi}</p>
            </div>
          </div>

          {/* Açıklama */}
          {task.aciklama && (
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Açıklama:</p>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-xl">{task.aciklama}</p>
            </div>
          )}

          {/* Tarihler */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-sm text-blue-600 mb-1">📅 Oluşturulma</p>
              <p className="font-semibold text-gray-800">{formatTarih(task.olusturulmaTarihi)}</p>
            </div>
            <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
              <p className="text-sm text-orange-600 mb-1">⏰ Bitiş Tarihi</p>
              <p className="font-semibold text-gray-800">{formatTarih(task.bitisTarihi)}</p>
            </div>
          </div>

          {/* Tamamlanma Bilgisi */}
          {task.durum === 'tamamlandi' && task.tamamlanmaAciklamasi && (
            <div className="p-5 bg-green-50 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-green-800">Tamamlandı</p>
                  {task.tamamlanmaTarihi && (
                    <p className="text-sm text-green-600">{formatTarih(task.tamamlanmaTarihi)}</p>
                  )}
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-500 mb-2">Tamamlanma Açıklaması:</p>
                <p className="text-gray-700">{task.tamamlanmaAciklamasi}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}