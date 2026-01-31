interface PersonelGunlukDurum {
  personelId: string;
  personelAd: string;
  girisSaati: string | null;
  cikisSaati: string | null;
  aktifMi: boolean;
}

interface Personel {
  id: string;
  ad?: string;
  isim?: string;
  emoji?: string;
}

interface IzinKaydi {
  id: string;
  personelAd: string;
  izinTuru: string;
}

interface PersonelDurumPanelProps {
  aktifPersoneller: PersonelGunlukDurum[];
  bugunGelenler: PersonelGunlukDurum[];
  izinliler: IzinKaydi[];
  tumPersoneller: Personel[];
}

export default function PersonelDurumPanel({
  aktifPersoneller,
  bugunGelenler,
  izinliler,
  tumPersoneller
}: PersonelDurumPanelProps) {
  return (
    <div className="space-y-4">
      {/* Şu An Çalışanlar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-3 md:px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <span>🟢</span> Şu An {aktifPersoneller.length} Kişi Çalışıyor
          </h2>
        </div>
        <div className="p-3 md:p-4">
          {aktifPersoneller.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <span className="text-3xl">😴</span>
              <p className="mt-2 text-sm">Şu anda aktif çalışan yok</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aktifPersoneller.map((p) => {
                const personel = tumPersoneller.find(per => per.id === p.personelId);
                return (
                  <div key={p.personelId} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{personel?.emoji || "👤"}</span>
                      <span className="text-sm font-medium text-gray-700">{p.personelAd}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-green-600 font-medium">Giriş: {p.girisSaati}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bugün Gelenler */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-3 md:px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <span>📋</span> Bugün {bugunGelenler.length} Kişi Geldi
          </h2>
        </div>
        <div className="p-3 md:p-4">
          {bugunGelenler.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <span className="text-3xl">🕐</span>
              <p className="mt-2 text-sm">Henüz kimse giriş yapmadı</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bugunGelenler.map((p) => {
                const personel = tumPersoneller.find(per => per.id === p.personelId);
                return (
                  <div key={p.personelId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{personel?.emoji || "👤"}</span>
                      <span className="text-sm font-medium text-gray-700">{p.personelAd}</span>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-green-600">Giriş: {p.girisSaati}</p>
                      {p.cikisSaati && <p className="text-red-500">Çıkış: {p.cikisSaati}</p>}
                      {!p.cikisSaati && <p className="text-gray-400">Çıkış: -</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* İzinli Olanlar */}
          {izinliler.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-2">İzinli ({izinliler.length})</p>
              <div className="space-y-2">
                {izinliler.map((izin) => (
                  <div key={izin.id} className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-200">
                    <span className="text-sm font-medium text-orange-800">{izin.personelAd}</span>
                    <span className="text-xs text-orange-600">{izin.izinTuru}</span>
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