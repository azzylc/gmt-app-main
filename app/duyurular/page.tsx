"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";

interface Announcement {
  id: string;
  title: string;
  content: string;
  important: boolean;
  author: string;
  date: string;
}

export default function DuyurularPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    {
      id: "1",
      title: "Şubat Ayı Toplantısı",
      content: "Şubat ayı genel değerlendirme toplantımız 5 Şubat Çarşamba günü saat 14:00'te yapılacaktır. Tüm ekibin katılımı beklenmektedir.",
      important: true,
      author: "Gizem",
      date: "2026-01-28"
    },
    {
      id: "2",
      title: "Yeni Ürün Stokları Geldi",
      content: "MAC ve Bobbi Brown ürünlerinin yeni stokları depoya ulaştı. İhtiyacınız olan ürünleri Saliha'dan temin edebilirsiniz.",
      important: false,
      author: "Saliha",
      date: "2026-01-27"
    },
    {
      id: "3",
      title: "Mesai Saatleri Güncellemesi",
      content: "Mart ayından itibaren hafta içi mesai saatleri 10:00-19:00 olarak güncellenecektir.",
      important: false,
      author: "Gizem",
      date: "2026-01-25"
    }
  ]);
  const [showModal, setShowModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', important: false });
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

  const handleAddAnnouncement = () => {
    if (!newAnnouncement.title || !newAnnouncement.content) return;
    const announcement: Announcement = {
      id: Date.now().toString(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      important: newAnnouncement.important,
      author: user?.email?.split('@')[0] || 'Admin',
      date: new Date().toISOString().split('T')[0]
    };
    setAnnouncements([announcement, ...announcements]);
    setShowModal(false);
    setNewAnnouncement({ title: '', content: '', important: false });
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) {
      setAnnouncements(announcements.filter(a => a.id !== id));
    }
  };

  const formatTarih = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });
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
              <h1 className="text-xl font-bold text-gray-800">📢 Duyurular</h1>
              <p className="text-sm text-gray-500">Ekip için önemli duyurular</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
            >
              ➕ Yeni Duyuru
            </button>
          </div>
        </header>

        <main className="p-6">
          <div className="space-y-4">
            {announcements.map(announcement => (
              <div 
                key={announcement.id}
                className={`bg-white rounded-2xl shadow-sm border ${
                  announcement.important 
                    ? 'border-red-200 bg-red-50' 
                    : 'border-gray-100'
                } overflow-hidden`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {announcement.important && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                          ÖNEMLİ
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-gray-800">{announcement.title}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(announcement.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">{announcement.content}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>👤 {announcement.author}</span>
                    <span>📅 {formatTarih(announcement.date)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-4">Yeni Duyuru</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                <input
                  type="text"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Duyuru başlığı..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">İçerik</label>
                <textarea
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Duyuru içeriği..."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="important"
                  checked={newAnnouncement.important}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, important: e.target.checked})}
                  className="rounded"
                />
                <label htmlFor="important" className="text-sm text-gray-700">Önemli duyuru olarak işaretle</label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddAnnouncement}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-xl font-medium transition"
                >
                  Ekle
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-medium transition"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}