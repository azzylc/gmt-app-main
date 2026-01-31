interface SakinGun {
  tarih: string;
  gelinSayisi: number;
}

interface SakinGunlerPanelProps {
  sakinGunler: SakinGun[];
  filtre: number;
  onFiltreChange: (filtre: number) => void;
}

export default function SakinGunlerPanel({
  sakinGunler,
  filtre,
  onFiltreChange
}: SakinGunlerPanelProps) {
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const formatGun = (tarih: string) => {
    const gunIsimleri = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return gunIsimleri[new Date(tarih).getDay()];
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 md:px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
          <span>📭</span> Önümüzdeki Sakin Günler
          <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">
            {sakinGunler.length}
          </span>
        </h2>
        <select 
          value={filtre}
          onChange={(e) => onFiltreChange(Number(e.target.value))}
          className="text-xs bg-gray-100 border-0 rounded-lg px-2 py-1 text-gray-600 focus:ring-2 focus:ring-pink-300"
        >
          <option value={0}>Hiç gelin yok</option>
          <option value={1}>Sadece 1 gelin var</option>
          <option value={2}>Sadece 2 gelin var</option>
        </select>
      </div>
      <div className="p-3 md:p-4">
        {sakinGunler.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <span className="text-3xl">🔍</span>
            <p className="mt-2 text-sm">Bu kriterde gün bulunamadı</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[240px] overflow-y-auto">
            {sakinGunler.map((gun) => (
              <div key={gun.tarih} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                <span className="text-sm text-gray-700">{formatTarih(gun.tarih)}</span>
                <div className="flex items-center gap-2">
                  {gun.gelinSayisi > 0 && (
                    <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded">
                      {gun.gelinSayisi} gelin
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{formatGun(gun.tarih)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}