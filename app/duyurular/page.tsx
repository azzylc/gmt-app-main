"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";

interface Announcement {
  id: string;
  title: string;
  content: string;
  important: boolean;
  author: string;
  createdAt: any;
}

export default function DuyurularPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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

  // Firestore'dan duyuruları dinle
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Announcement));
      setAnnouncements(data);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      alert("Lütfen başlık ve içerik girin!");
      return;
    }

    try {
      await addDoc(collection(db, "announcements"), {
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        important: newAnnouncement.important,
        author: user?.email?.split('@')[0] || 'Admin',
        createdAt: serverTimestamp()
      });

      setShowModal(false);
      setNewAnnouncement({ title: '', content: '', important: false });
    } catch (error) {
      console.error("Duyuru eklenirken hata:", error);
      alert("Duyuru eklenemedi!");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (confirm("Bu duyuruyu silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "announcements", id));
      } catch (error) {
        console.error("Duyuru silinirken hata:", error);
        alert("Duyuru silinemedi!");
      }
    }
  };

  const formatTarih = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
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
          {announcements.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
              <span className="text-5xl mb-4 block">📭</span>
              <p className="text-lg font-medium">Henüz duyuru yok</p>
              <p className="text-sm text-gray-400 mt-2">Yeni duyuru eklemek için yukarıdaki butona tıklayın</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map(announcement => (
                <div 
                  key={announcement.id}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                    announcement.important 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-gray-100'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {announcement.important && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                            ÖNEMLİ
                          </span>
                        )}
                        <h3 className="text-lg font-semibold text-gray-800">{announcement.title}</h3>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="text-gray-400 hover:text-red-500 transition text-lg"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="text-gray-600 mb-4 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        👤 {announcement.author}
                      </span>
                      <span className="flex items-center gap-1">
                        📅 {formatTarih(announcement.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-800 mb-4">📢 Yeni Duyuru</h3>
            
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