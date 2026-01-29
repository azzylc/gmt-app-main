"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp
} from "firebase/firestore";

interface Personel {
  id: string;
  ad: string;
  soyad: string;
  kisaltma?: string;
  grupEtiketleri: string[];
  aktif: boolean;
}

interface Gelin {
  id: string;
  ad: string;
  soyad: string;
  tarih: string;
  saat: string;
  makyajPersonelId: string;  // YENİ: Personel ID
  turbanPersonelId: string;  // YENİ: Personel ID
  notlar: string;
  createdAt: any;
}

export default function GelinlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gelinler, setGelinler] = useState<Gelin[]>([]);
  const [personeller, setPersoneller] = useState<Personel[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGelin, setEditingGelin] = useState<Gelin | null>(null);
  const router = useRouter();

  const [formData, setFormData] = useState<Gelin>({
    id: "",
    ad: "",
    soyad: "",
    tarih: "",
    saat: "",
    makyajPersonelId: "",
    turbanPersonelId: "",
    notlar: "",
    createdAt: null
  });

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

  // Gelinleri çek
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "brides"), orderBy("tarih", "desc"), orderBy("saat", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        makyajPersonelId: "",
        turbanPersonelId: "",
        ...doc.data()
      } as Gelin));
      setGelinler(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Personelleri çek (sadece aktifler)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "personnel"), orderBy("ad", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ad: doc.data().ad || "",
        soyad: doc.data().soyad || "",
        kisaltma: doc.data().kisaltma || "",
        grupEtiketleri: doc.data().grupEtiketleri || [],
        aktif: doc.data().aktif !== false
      } as Personel));
      // Sadece aktif personeller
      setPersoneller(data.filter(p => p.aktif));
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddEdit = async () => {
    if (!formData.ad || !formData.soyad || !formData.tarih || !formData.saat) {
      alert("Lütfen zorunlu alanları doldurun!");
      return;
    }

    try {
      if (editingGelin) {
        const { id, ...dataToUpdate } = formData;
        await updateDoc(doc(db, "brides", editingGelin.id), dataToUpdate);
      } else {
        const { id, ...dataToAdd } = formData;
        await addDoc(collection(db, "brides"), {
          ...dataToAdd,
          createdAt: serverTimestamp()
        });
      }

      setShowModal(false);
      setEditingGelin(null);
      resetForm();
    } catch (error) {
      console.error("Hata:", error);
      alert("İşlem başarısız!");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bu gelini silmek istediğinize emin misiniz?")) {
      try {
        await deleteDoc(doc(db, "brides", id));
      } catch (error) {
        console.error("Hata:", error);
      }
    }
  };

  const openEditModal = (gelin: Gelin) => {
    setEditingGelin(gelin);
    setFormData(gelin);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      id: "",
      ad: "",
      soyad: "",
      tarih: "",
      saat: "",
      makyajPersonelId: "",
      turbanPersonelId: "",
      notlar: "",
      createdAt: null
    });
  };

  // Personel ID'sinden kısaltma bul
  const getPersonelKisaltma = (personelId: string): string => {
    if (!personelId) return "-";
    const personel = personeller.find(p => p.id === personelId);
    if (!personel) return "-";
    return personel.kisaltma || `${personel.ad} ${personel.soyad}`;
  };

  // Personel ID'sinden tam ad bul
  const getPersonelFullName = (personelId: string): string => {
    if (!personelId) return "Seçilmemiş";
    const personel = personeller.find(p => p.id === personelId);
    if (!personel) return "Bulunamadı";
    return `${personel.ad} ${personel.soyad}`;
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
      
      <div className="md:ml-64 pt-14 md:pt-0 pb-20 md:pb-0">
        <header className="bg-white border-b px-6 py-4 sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">👰 Gelin Yönetimi</h1>
              <p className="text-sm text-gray-500">Gelin randevularını ve hazırlayan personelleri yönetin</p>
            </div>
            <button
              onClick={() => { setShowModal(true); setEditingGelin(null); resetForm(); }}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm"
            >
              ➕ Yeni Gelin
            </button>
          </div>
        </header>

        <main className="p-6">
          {gelinler.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-500 border border-gray-100">
              <span className="text-5xl mb-4 block">👰</span>
              <p className="text-lg font-medium">Gelin bulunamadı</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gelin</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saat</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Makyaj</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Türban</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {gelinler.map(gelin => (
                      <tr key={gelin.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                              <span className="text-pink-600 font-semibold text-sm">
                                {gelin.ad[0]}{gelin.soyad[0]}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{gelin.ad} {gelin.soyad}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(gelin.tarih).toLocaleDateString('tr-TR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{gelin.saat}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-sm font-semibold bg-purple-100 text-purple-700 rounded-lg">
                            {getPersonelKisaltma(gelin.makyajPersonelId)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-lg">
                            {getPersonelKisaltma(gelin.turbanPersonelId)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => openEditModal(gelin)} 
                              className="w-8 h-8 hover:bg-yellow-50 text-yellow-600 rounded flex items-center justify-center text-lg transition"
                              title="Düzenle"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDelete(gelin.id)} 
                              className="w-8 h-8 hover:bg-red-50 text-red-600 rounded flex items-center justify-center text-lg transition"
                              title="Sil"
                            >
                              🗑️
                            </button>
                          </div>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">
                {editingGelin ? "✏️ Gelin Düzenle" : "➕ Yeni Gelin"}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ad *</label>
                  <input 
                    type="text" 
                    value={formData.ad} 
                    onChange={(e) => setFormData({ ...formData, ad: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" 
                    placeholder="Ayşe" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Soyad *</label>
                  <input 
                    type="text" 
                    value={formData.soyad} 
                    onChange={(e) => setFormData({ ...formData, soyad: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" 
                    placeholder="Yılmaz" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tarih *</label>
                  <input 
                    type="date" 
                    value={formData.tarih} 
                    onChange={(e) => setFormData({ ...formData, tarih: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Saat *</label>
                  <input 
                    type="time" 
                    value={formData.saat} 
                    onChange={(e) => setFormData({ ...formData, saat: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">💄 Makyaj Personeli</label>
                  <select
                    value={formData.makyajPersonelId}
                    onChange={(e) => setFormData({ ...formData, makyajPersonelId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    <option value="">Seçiniz...</option>
                    {personeller.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.kisaltma ? `${p.kisaltma} - ` : ""}{p.ad} {p.soyad} ({p.grupEtiketleri.join(", ")})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">🧕 Türban Personeli</label>
                  <select
                    value={formData.turbanPersonelId}
                    onChange={(e) => setFormData({ ...formData, turbanPersonelId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
                  >
                    <option value="">Seçiniz...</option>
                    {personeller.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.kisaltma ? `${p.kisaltma} - ` : ""}{p.ad} {p.soyad} ({p.grupEtiketleri.join(", ")})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={formData.notlar}
                  onChange={(e) => setFormData({ ...formData, notlar: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500"
                  placeholder="Özel notlar..."
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button 
                onClick={handleAddEdit} 
                className="flex-1 px-4 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition font-medium"
              >
                💾 Kaydet
              </button>
              <button 
                onClick={() => { setShowModal(false); resetForm(); }} 
                className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition font-medium"
              >
                ↩️ İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}