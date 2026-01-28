"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { personelListesi } from "../lib/data";

export default function AyarlarPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'genel' | 'personel' | 'bildirimler'>('genel');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUser(user);
      else router.push("/login");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

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
          <div>
            <h1 className="text-xl font-bold text-gray-800">⚙️ Ayarlar</h1>
            <p className="text-sm text-gray-500">Uygulama ayarlarını yönet</p>
          </div>
        </header>

        <main className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {(['genel', 'personel', 'bildirimler'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  activeTab === tab 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {tab === 'genel' ? '🏠 Genel' : tab === 'personel' ? '👥 Personel' : '🔔 Bildirimler'}
              </button>
            ))}
          </div>

          {/* Genel Ayarlar */}
          {activeTab === 'genel' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Studio Bilgileri</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Studio Adı</label>
                    <input 
                      type="text" 
                      defaultValue="Gizem Yolcu Studio"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input 
                      type="text" 
                      defaultValue="0532 xxx xx xx"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
                    <textarea 
                      defaultValue="İstanbul, Türkiye"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Çalışma Saatleri</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Açılış</label>
                    <input 
                      type="time" 
                      defaultValue="09:00"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kapanış</label>
                    <input 
                      type="time" 
                      defaultValue="18:00"
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-800 mb-4">Veri Yönetimi</h2>
                <div className="space-y-3">
                  <button className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                    <span className="text-gray-700">📥 Verileri Yedekle</span>
                    <span className="text-gray-400">→</span>
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.removeItem('gmt_gelinler_cache');
                      localStorage.removeItem('gmt_gelinler_cache_time');
                      alert('Önbellek temizlendi!');
                    }}
                    className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <span className="text-gray-700">🗑️ Önbelleği Temizle</span>
                    <span className="text-gray-400">→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Personel Ayarları */}
          {activeTab === 'personel' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-800">Personel Listesi</h2>
                <button className="bg-pink-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-pink-600 transition">
                  + Ekle
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {personelListesi.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{p.emoji}</span>
                      <div>
                        <p className="font-medium text-gray-800">{p.isim}</p>
                        <p className="text-xs text-gray-500">{p.rol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{p.kisaltma}</span>
                      <button className="text-gray-400 hover:text-blue-500 p-1">✏️</button>
                      <button className="text-gray-400 hover:text-red-500 p-1">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bildirim Ayarları */}
          {activeTab === 'bildirimler' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Bildirim Tercihleri</h2>
              <div className="space-y-4">
                {[
                  { label: 'Yeni gelin kaydı bildirimi', key: 'yeniGelin' },
                  { label: 'İzin talebi bildirimi', key: 'izinTalebi' },
                  { label: 'Doğum günü hatırlatması', key: 'dogumGunu' },
                  { label: 'Günlük özet', key: 'gunlukOzet' },
                  { label: 'Haftalık rapor', key: 'haftalikRapor' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-gray-700">{item.label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kaydet Butonu */}
          <div className="mt-6 flex justify-end">
            <button className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-2 rounded-xl font-medium transition">
              Değişiklikleri Kaydet
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
