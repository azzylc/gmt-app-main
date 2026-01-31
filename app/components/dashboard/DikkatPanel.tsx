interface Gelin {
  id: string;
  isim: string;
  tarih: string;
  saat: string;
  ucret: number;
  kapora: number;
  kalan: number;
  makyaj: string;
  turban: string;
  kinaGunu?: string;
  telefon?: string;
  esiTelefon?: string;
  instagram?: string;
  fotografci?: string;
  modaevi?: string;
  anlasildigiTarih?: string;
  bilgilendirmeGonderildi?: boolean;
  ucretYazildi?: boolean;
  malzemeListesiGonderildi?: boolean;
  paylasimIzni?: boolean;
  yorumIstesinMi?: string;
  yorumIstendiMi?: boolean;
  gelinNotu?: string;
  dekontGorseli?: string;
}

interface EksikIzin {
  personel: {
    id: string;
    ad: string;
    soyad: string;
    iseBaslama?: string;
    yillikIzinHakki?: number;
    kullaniciTuru?: string;
    aktif: boolean;
  };
  calismaYili: number;
  olmasiGereken: number;
  mevcut: number;
  eksik: number;
}

interface DikkatPanelProps {
  islenmemisUcretler: Gelin[];
  eksikIzinler: EksikIzin[];
  onGelinClick: (gelin: Gelin) => void;
  onIzinEkle: (eksik: EksikIzin) => void;
  onTumIzinleriEkle: () => void;
  izinEkleniyor: string | null;
  onIslenmemisUcretlerClick: () => void;
}

export default function DikkatPanel({
  islenmemisUcretler,
  eksikIzinler,
  onGelinClick,
  onIzinEkle,
  onTumIzinleriEkle,
  izinEkleniyor,
  onIslenmemisUcretlerClick
}: DikkatPanelProps) {
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const toplamDikkat = islenmemisUcretler.length + eksikIzinler.length;

  if (toplamDikkat === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 md:px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <span>⚠️</span> Dikkat Edilecekler
          <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
            {toplamDikkat}
          </span>
        </h2>
      </div>
      <div className="p-3 md:p-4">
        <div className="space-y-3">
          {/* İşlenmemiş Ücretler */}
          {islenmemisUcretler.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-600 text-xl">💰</span>
                  <h4 className="font-semibold text-yellow-900">İşlenmemiş Ücretler</h4>
                </div>
                <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                  {islenmemisUcretler.length}
                </span>
              </div>
              <div className="space-y-2">
                {islenmemisUcretler.slice(0, 3).map(g => (
                  <div 
                    key={g.id}
                    onClick={() => onGelinClick(g)}
                    className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">{g.isim}</span>
                      <span className="text-xs text-gray-500">{formatTarih(g.tarih)}</span>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">X₺</span>
                  </div>
                ))}
                {islenmemisUcretler.length > 3 && (
                  <button 
                    onClick={onIslenmemisUcretlerClick}
                    className="text-yellow-600 text-xs font-medium hover:text-yellow-700 w-full text-center pt-2"
                  >
                    +{islenmemisUcretler.length - 3} daha gör →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Eksik İzin Hakları */}
          {eksikIzinler.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-xl">🏖️</span>
                  <h4 className="font-semibold text-green-900">Eksik İzin Hakları</h4>
                </div>
                <div className="flex items-center gap-2">
                  {eksikIzinler.length > 1 && (
                    <button
                      onClick={onTumIzinleriEkle}
                      className="bg-green-600 text-white text-xs px-2 py-1 rounded hover:bg-green-700 transition"
                    >
                      Tümünü Ekle
                    </button>
                  )}
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold">
                    {eksikIzinler.length}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                {eksikIzinler.slice(0, 5).map(eksik => (
                  <div 
                    key={eksik.personel.id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">
                          {eksik.personel.ad} {eksik.personel.soyad}
                        </span>
                        <span className="text-xs text-gray-500">({eksik.calismaYili}. yıl)</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {eksik.mevcut} → {eksik.olmasiGereken} gün
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-green-600">+{eksik.eksik}</span>
                      <button
                        onClick={() => onIzinEkle(eksik)}
                        disabled={izinEkleniyor === eksik.personel.id}
                        className="bg-green-500 text-white text-xs px-2 py-1 rounded hover:bg-green-600 transition disabled:opacity-50"
                      >
                        {izinEkleniyor === eksik.personel.id ? "..." : "Ekle"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}