"use client";
import { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import { izinler, personelListesi, getPersonelById, Izin, IzinTuru } from "../lib/data";

export default function IzinlerPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'hepsi' | 'beklemede' | 'onaylandi' | 'reddedildi'>('hepsi');
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setUser(user);
      else router.push("/login");
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const filteredIzinler = izinler.filter(izin => {
    if (filter === 'hepsi') return true;
    return izin.onayDurumu === filter;
  });

  const formatTarih = (tarih: string) => {
    return new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const izinTuruLabel = (tur: IzinTuru) => {
    const labels: Record<IzinTuru, string> = {
      yillik: 'Yıllık İzin',
      mazeret: 'Mazeret İzni',
      hastalik: 'Hastalık İzni',
      ucretsiz: 'Ücretsiz İzin',
      diger: 'Diğer'
    };
    return labels[tur];
  };

  const durumBadge = (durum: string) => {
    const styles: Record<string, string> = {
      beklemede: 'bg-yellow-100 text-yellow-700',
      onaylandi: 'bg-green-100 text-green-700',
      reddedildi: 'bg-red-100 text-red-700'
    };
    const labels: Record<string, string> = {
      beklemede: 'Beklemede',
      onaylandi: 'Onaylandı',
      reddedildi: 'Reddedildi'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[durum]}`}>{labels[durum]}</span>;
  };

  const bekleyenSayi = izinler.filter(i => i.onayDurumu === 'beklemede').length;
  const onaylananSayi = izinler.filter(i => i.onayDurumu === 'onaylandi').length;

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
              <p className="text-sm text-gray-500">İzin taleplerini görüntüle ve yönet</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2"
            >
              ➕ Yeni İzin Talebi
            </button>
          </div>
        </header>

        <main className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">Bekleyen Talepler</p>
                  <p className="text-2xl font-bold text-yellow-600">{bekleyenSayi}</p>
                </div>
                <span className="text-2xl">⏳</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">Onaylanan</p>
                  <p className="text-2xl font-bold text-green-600">{onaylananSayi}</p>
                </div>
                <span className="text-2xl">✅</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-xs">Toplam Talep</p>
                  <p className="text-2xl font-bold text-gray-800">{izinler.length}</p>
                </div>
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {(['hepsi', 'beklemede', 'onaylandi', 'reddedildi'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                  filter === f ? 'bg-pink-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {f === 'hepsi' ? 'Tümü' : f === 'beklemede' ? 'Bekleyen' : f === 'onaylandi' ? 'Onaylanan' : 'Reddedilen'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Personel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">İzin Türü</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Tarih</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Açıklama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Durum</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredIzinler.map((izin) => {
                  const personel = getPersonelById(izin.personelId);
                  return (
                    <tr key={izin.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{personel?.emoji}</span>
                          <span className="font-medium text-gray-800">{personel?.isim}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{izinTuruLabel(izin.tur)}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {formatTarih(izin.baslangic)}
                        {izin.baslangic !== izin.bitis && ` - ${formatTarih(izin.bitis)}`}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{izin.aciklama}</td>
                      <td className="px-4 py-4">{durumBadge(izin.onayDurumu)}</td>
                      <td className="px-4 py-4">
                        {izin.onayDurumu === 'beklemede' && (
                          <div className="flex gap-2">
                            <button className="text-green-600 hover:text-green-700 text-sm font-medium">Onayla</button>
                            <button className="text-red-600 hover:text-red-700 text-sm font-medium">Reddet</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">🏖️ Yeni İzin Talebi</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personel</label>
                <select className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500">
                  <option value="">Seçin...</option>
                  {personelListesi.map(p => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.isim}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İzin Türü</label>
                <select className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500">
                  <option value="yillik">Yıllık İzin</option>
                  <option value="mazeret">Mazeret İzni</option>
                  <option value="hastalik">Hastalık İzni</option>
                  <option value="ucretsiz">Ücretsiz İzin</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                  <input type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                  <input type="date" className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea 
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 h-24"
                  placeholder="İzin sebebi..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                >
                  İptal
                </button>
                <button className="flex-1 px-4 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition">
                  Talep Oluştur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
