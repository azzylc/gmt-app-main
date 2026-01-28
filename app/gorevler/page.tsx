"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi } from "../lib/data";

// Task interface
interface Task {
  id: string;
  baslik: string;
  aciklama: string;
  oncelik: "dusuk" | "orta" | "yuksek";
  durum: "yapilacak" | "devamEdiyor" | "tamamlandi";
  atananKisi?: string;
  bitisTarihi?: string;
  olusturulmaTarihi: string;
}

export default function GorevlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      baslik: "Şubat Ayı Toplantısı Hazırlığı",
      aciklama: "Toplantı gündemini hazırla ve katılımcıları bilgilendir",
      oncelik: "yuksek",
      durum: "yapilacak",
      atananKisi: "Gizem",
      bitisTarihi: "2026-01-31",
      olusturulmaTarihi: "2026-01-28"
    },
    {
      id: "2",
      baslik: "Yeni Ürün Stoklarını Kontrol Et",
      aciklama: "MAC ve Bobbi Brown ürünlerinin envanterini çıkar",
      oncelik: "orta",
      durum: "devamEdiyor",
      atananKisi: "Saliha",
      bitisTarihi: "2026-01-30",
      olusturulmaTarihi: "2026-01-27"
    },
    {
      id: "3",
      baslik: "Fırça Temizleyici Sipariş Et",
      aciklama: "Stoklar azaldı, yeni sipariş verilmeli",
      oncelik: "orta",
      durum: "yapilacak",
      atananKisi: "Saliha",
      bitisTarihi: "2026-02-01",
      olusturulmaTarihi: "2026-01-28"
    }
  ]);
  const [filter, setFilter] = useState<'hepsi' | 'bekleyen' | 'tamamlanan'>('hepsi');
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({ 
    baslik: '', 
    aciklama: '', 
    atananKisi: '', 
    bitisTarihi: '', 
    oncelik: 'orta' as 'dusuk' | 'orta' | 'yuksek' 
  });
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

  const handleAddTask = () => {
    if (!newTask.baslik || !newTask.atananKisi || !newTask.bitisTarihi) return;
    const task: Task = {
      id: Date.now().toString(),
      baslik: newTask.baslik,
      aciklama: newTask.aciklama,
      oncelik: newTask.oncelik,
      durum: "yapilacak",
      atananKisi: newTask.atananKisi,
      bitisTarihi: newTask.bitisTarihi,
      olusturulmaTarihi: new Date().toISOString().split('T')[0]
    };
    setTasks([...tasks, task]);
    setShowModal(false);
    setNewTask({ baslik: '', aciklama: '', atananKisi: '', bitisTarihi: '', oncelik: 'orta' });
  };

  const handleToggleComplete = (task: Task) => {
    setTasks(tasks.map(t => 
      t.id === task.id 
        ? { ...t, durum: t.durum === 'tamamlandi' ? 'yapilacak' : 'tamamlandi' }
        : t
    ));
  };

  const handleDeleteTask = (id: string) => {
    if (confirm("Bu görevi silmek istediğinize emin misiniz?")) {
      setTasks(tasks.filter(t => t.id !== id));
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'bekleyen') return t.durum !== 'tamamlandi';
    if (filter === 'tamamlanan') return t.durum === 'tamamlandi';
    return true;
  });

  const bugun = new Date().toISOString().split('T')[0];
  const bekleyenSayi = tasks.filter(t => t.durum !== 'tamamlandi').length;
  const gecikmisGorevsayi = tasks.filter(t => t.durum !== 'tamamlandi' && t.bitisTarihi && t.bitisTarihi < bugun).length;

  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

  const priorityColors = {
    dusuk: 'bg-green-100 text-green-700',
    orta: 'bg-yellow-100 text-yellow-700',
    yuksek: 'bg-red-100 text-red-700'
  };

  const priorityLabels = { dusuk: 'Düşük', orta: 'Orta', yuksek: 'Yüksek' };

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
              <h1 className="text-xl font-bold text-gray-800">📋 Görevler</h1>
              <p className="text-sm text-gray-500">Ekip görevlerini yönet</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              ➕ Yeni Görev
            </button>
          </div>
        </header>

        <main className="p-6">
          {/* İstatistikler */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Toplam Görev</p>
              <p className="text-2xl font-bold text-gray-800">{tasks.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Bekleyen</p>
              <p className="text-2xl font-bold text-yellow-600">{bekleyenSayi}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Gecikmiş</p>
              <p className="text-2xl font-bold text-red-600">{gecikmisGsayi}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-500 text-xs">Tamamlanan</p>
              <p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.completed).length}</p>
            </div>
          </div>

          {/* Filtreler */}
          <div className="flex gap-2 mb-6">
            {(['hepsi', 'bekleyen', 'tamamlanan'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  filter === f 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f === 'hepsi' ? 'Tümü' : f === 'bekleyen' ? 'Bekleyen' : 'Tamamlanan'}
              </button>
            ))}
          </div>

          {/* Görev Listesi */}
          <div className="space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center text-gray-500">
                <span className="text-4xl">📭</span>
                <p className="mt-4">Görev bulunamadı</p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isOverdue = task.durum !== "tamamlandi" && task.bitisTarihi < bugun;
                const personel = personelListesi.find(p => p.isim === task.atananKisi);
                
                return (
                  <div 
                    key={task.id} 
                    className={`bg-white rounded-2xl shadow-sm border p-4 ${
                      task.durum === "tamamlandi" ? 'opacity-60 border-gray-100' : 
                      isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button 
                        onClick={() => handleToggleComplete(task)}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          task.durum === "tamamlandi" 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'border-gray-300 hover:border-pink-500'
                        }`}
                      >
                        {task.durum === "tamamlandi" && '✓'}
                      </button>

                      {/* İçerik */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-semibold text-gray-800 ${task.durum === "tamamlandi" ? 'line-through' : ''}`}>
                            {task.baslik}
                          </h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[task.oncelik]}`}>
                            {priorityLabels[task.oncelik]}
                          </span>
                          {isOverdue && (
                            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                              Gecikmiş!
                            </span>
                          )}
                        </div>
                        {task.aciklama && (
                          <p className="text-gray-500 text-sm mb-2">{task.aciklama}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            {personel?.emoji || '👤'} {task.atananKisi}
                          </span>
                          <span className="flex items-center gap-1">
                            📅 {formatTarih(task.bitisTarihi)}
                          </span>
                        </div>
                      </div>

                      {/* Silme Butonu */}
                      <button 
                        onClick={() => task.id && handleDeleteTask(task.id)}
                        className="text-gray-400 hover:text-red-500 p-2"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Yeni Görev Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">📋 Yeni Görev</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Görev Başlığı *</label>
                <input 
                  type="text"
                  value={newTask.baslik}
                  onChange={e => setNewTask({...newTask, baslik: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Görev başlığı"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea 
                  value={newTask.aciklama}
                  onChange={e => setNewTask({...newTask, aciklama: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 h-24"
                  placeholder="Detaylı açıklama..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Atanan Kişi *</label>
                <select 
                  value={newTask.atananKisi}
                  onChange={e => setNewTask({...newTask, atananKisi: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                >
                  <option value="">Seçin...</option>
                  {personelListesi.map(p => (
                    <option key={p.id} value={p.isim}>{p.emoji} {p.isim}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi *</label>
                  <input 
                    type="date"
                    value={newTask.bitisTarihi}
                    onChange={e => setNewTask({...newTask, bitisTarihi: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik</label>
                  <select 
                    value={newTask.oncelik}
                    onChange={e => setNewTask({...newTask, oncelik: e.target.value as any})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    <option value="low">🟢 Düşük</option>
                    <option value="medium">🟡 Orta</option>
                    <option value="high">🔴 Yüksek</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddTask}
                  disabled={!newTask.baslik || !newTask.atananKisi || !newTask.bitisTarihi}
                  className="flex-1 px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition disabled:opacity-50"
                >
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
