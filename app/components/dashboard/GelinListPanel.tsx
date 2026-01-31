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
}

interface GelinListPanelProps {
  title: string;
  gelinler: Gelin[];
  loading?: boolean;
  onGelinClick: (gelin: Gelin) => void;
  onRefresh?: () => void;
  showToggle?: boolean;
  toggleValue?: 'bugun' | 'yarin';
  onToggleChange?: (value: 'bugun' | 'yarin') => void;
}

function GelinRow({ gelin, onClick }: { gelin: Gelin; onClick: () => void }) {
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  
  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="bg-pink-100 text-pink-600 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs">
          {gelin.saat}
        </div>
        <div>
          <p className="font-medium text-gray-800 text-sm">{gelin.isim}</p>
          <div className="flex gap-1 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded ${gelin.makyaj ? 'bg-pink-100 text-pink-600' : 'bg-gray-200 text-gray-500'}`}>
              {gelin.makyaj 
                ? (gelin.turban && gelin.turban !== gelin.makyaj 
                    ? `${gelin.makyaj} & ${gelin.turban}` 
                    : gelin.makyaj)
                : 'Atanmamış'}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        {gelin.ucret === -1 ? (
          <p className="text-gray-400 text-xs">İşlenmemiş</p>
        ) : (
          <p className="text-red-500 font-semibold text-sm">{gelin.kalan.toLocaleString('tr-TR')} ₺</p>
        )}
      </div>
    </div>
  );
}

export default function GelinListPanel({
  title,
  gelinler,
  loading = false,
  onGelinClick,
  onRefresh,
  showToggle = false,
  toggleValue = 'bugun',
  onToggleChange
}: GelinListPanelProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-3 md:px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <span>💄</span> {title}
            <span className="bg-pink-100 text-pink-600 text-xs px-2 py-0.5 rounded-full">
              {gelinler.length}
            </span>
          </h2>
          {showToggle && onToggleChange && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => onToggleChange('bugun')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  toggleValue === 'bugun' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Bugün
              </button>
              <button
                onClick={() => onToggleChange('yarin')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                  toggleValue === 'yarin' 
                    ? 'bg-pink-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Yarın
              </button>
            </div>
          )}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="text-gray-400 hover:text-gray-600 text-xs">🔄</button>
        )}
      </div>
      <div className="p-3 md:p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
        ) : gelinler.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl">🎉</span>
            <p className="mt-2">İş yok!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {gelinler.map((gelin) => (
              <GelinRow key={gelin.id} gelin={gelin} onClick={() => onGelinClick(gelin)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}