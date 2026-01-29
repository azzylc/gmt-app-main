"use client";

interface GelinModalProps {
  gelin: {
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
    yorumIstesinMi?: boolean;
    yorumIstendiMi?: boolean;
    gelinNotu?: string;
    dekontGorseli?: string;
  };
  onClose: () => void;
  mode?: "full" | "summary";
}

export default function GelinModal({ gelin, onClose, mode = "full" }: GelinModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">👰 {gelin.isim}</h3>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        <div className="space-y-3">
          {/* Temel Bilgiler */}
          <div className="bg-primary-50 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-gray-500">📅 Tarih</p>
                <p className="font-semibold">{new Date(gelin.tarih).toLocaleDateString('tr-TR')}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">🕐 Saat</p>
                <p className="font-semibold">{gelin.saat}</p>
              </div>
            </div>
          </div>

          {/* Personel */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary-100 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">💄 Makyaj</p>
              <p className="font-bold text-sm">{gelin.makyaj || "-"}</p>
            </div>
            <div className="bg-gold-100 rounded-lg p-3">
              <p className="text-xs text-gray-600 mb-1">🧕 Türban</p>
              <p className="font-bold text-sm">{gelin.turban || "-"}</p>
            </div>
          </div>

          {/* Mali Bilgiler */}
          <div className="gradient-accent text-white rounded-lg p-3">
            <h4 className="font-bold text-sm mb-2">💰 Mali Bilgiler</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs opacity-80 mb-0.5">Ücret</p>
                <p className="font-bold">
                  {gelin.ucret === -1 ? '-' : `${gelin.ucret.toLocaleString('tr-TR')} ₺`}
                </p>
              </div>
              <div>
                <p className="text-xs opacity-80 mb-0.5">Kapora</p>
                <p className="font-bold">{gelin.kapora.toLocaleString('tr-TR')} ₺</p>
              </div>
              <div>
                <p className="text-xs opacity-80 mb-0.5">Kalan</p>
                <p className="font-bold">
                  {gelin.ucret === -1 ? '-' : `${gelin.kalan.toLocaleString('tr-TR')} ₺`}
                </p>
              </div>
            </div>
          </div>

          {/* FULL MODE: Detaylı Bilgiler */}
          {mode === "full" && (
            <>
              {/* Kına Günü */}
              {gelin.kinaGunu && (
                <div className="bg-gold-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">🎉 Kına Günü</p>
                  <p className="font-semibold text-sm">{gelin.kinaGunu}</p>
                </div>
              )}

              {/* İletişim */}
              {(gelin.telefon || gelin.esiTelefon || gelin.instagram) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">📞 İletişim</h4>
                  <div className="space-y-1.5 text-sm">
                    {gelin.telefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Telefon:</span>
                        <a href={`tel:${gelin.telefon}`} className="font-semibold text-primary-600 hover:underline">{gelin.telefon}</a>
                      </div>
                    )}
                    {gelin.esiTelefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Eşi Tel:</span>
                        <a href={`tel:${gelin.esiTelefon}`} className="font-semibold text-primary-600 hover:underline">{gelin.esiTelefon}</a>
                      </div>
                    )}
                    {gelin.instagram && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Instagram:</span>
                        <a href={`https://instagram.com/${gelin.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 hover:underline">
                          {gelin.instagram}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fotoğrafçı & Modaevi */}
              {(gelin.fotografci || gelin.modaevi) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">🎨 Hizmet Sağlayıcılar</h4>
                  <div className="space-y-1.5 text-sm">
                    {gelin.fotografci && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-24">📷 Fotoğrafçı:</span>
                        <span className="font-semibold">{gelin.fotografci}</span>
                      </div>
                    )}
                    {gelin.modaevi && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-24">👗 Modaevi:</span>
                        <span className="font-semibold">{gelin.modaevi}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Anlaşıldığı Tarih */}
              {gelin.anlasildigiTarih && (
                <div className="bg-accent-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">📝 Anlaşıldığı Tarih</p>
                  <p className="font-semibold text-sm">
                    {new Date(gelin.anlasildigiTarih).toLocaleDateString('tr-TR', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}

              {/* Durum Kontrolleri */}
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-bold text-sm mb-2">✅ Durum Kontrolleri</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.bilgilendirmeGonderildi ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.bilgilendirmeGonderildi ? '✅' : '⬜'} Bilgilendirme Gönderildi
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.ucretYazildi ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.ucretYazildi ? '✅' : '⬜'} Ücret Yazıldı
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.malzemeListesiGonderildi ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.malzemeListesiGonderildi ? '✅' : '⬜'} Malzeme Listesi Gönderildi
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.paylasimIzni ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.paylasimIzni ? '✅' : '⬜'} Paylaşım İzni
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.yorumIstesinMi ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.yorumIstesinMi ? '✅' : '⬜'} Yorum İstesin Mi
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm ${gelin.yorumIstendiMi ? 'bg-gold-100 text-gold-700' : 'bg-gray-100 text-gray-500'}`}>
                    {gelin.yorumIstendiMi ? '✅' : '⬜'} Yorum İstendi Mi
                  </div>
                </div>
              </div>

              {/* Gelin Notu */}
              {gelin.gelinNotu && (
                <div className="bg-accent-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">📝 Gelin Notu</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{gelin.gelinNotu}</p>
                </div>
              )}

              {/* Dekont Görseli */}
              {gelin.dekontGorseli && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">🧾 Dekont Görseli</h4>
                  <a href={gelin.dekontGorseli} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline break-all">
                    {gelin.dekontGorseli}
                  </a>
                </div>
              )}
            </>
          )}

          {/* SUMMARY MODE: Sadece İletişim */}
          {mode === "summary" && (
            <>
              {/* Kına Günü (summary'de de göster) */}
              {gelin.kinaGunu && (
                <div className="bg-gold-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">🎉 Kına Günü</p>
                  <p className="font-semibold text-sm">{gelin.kinaGunu}</p>
                </div>
              )}

              {/* İletişim (sadece temel) */}
              {(gelin.telefon || gelin.esiTelefon) && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">📞 İletişim</h4>
                  <div className="space-y-1.5 text-sm">
                    {gelin.telefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Telefon:</span>
                        <a href={`tel:${gelin.telefon}`} className="font-semibold text-primary-600">{gelin.telefon}</a>
                      </div>
                    )}
                    {gelin.esiTelefon && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs w-20">Eşi Tel:</span>
                        <a href={`tel:${gelin.esiTelefon}`} className="font-semibold text-primary-600">{gelin.esiTelefon}</a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gelin Notu (summary'de de önemli) */}
              {gelin.gelinNotu && (
                <div className="bg-accent-50 rounded-lg p-3">
                  <h4 className="font-bold text-sm mb-2">📝 Not</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{gelin.gelinNotu}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-4">
          <button onClick={onClose} className="btn btn-ghost w-full">
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}