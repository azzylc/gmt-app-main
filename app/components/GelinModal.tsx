"use client";
import { usePersoneller, getPersonelByIsim } from "../hooks/usePersoneller";

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
  yorumIstesinMi?: string;  // Kişi ismi (örn: "Zehra Kula") veya boş
  yorumIstendiMi?: boolean;
  gelinNotu?: string;
  dekontGorseli?: string;
}

export default function GelinModal({ gelin, onClose }: { gelin: Gelin; onClose: () => void }) {
  const { personeller } = usePersoneller();
  const makyajPersonel = getPersonelByIsim(gelin.makyaj, personeller);
  const turbanPersonel = gelin.turban && gelin.turban !== gelin.makyaj ? getPersonelByIsim(gelin.turban, personeller) : null;
  const formatTarih = (tarih: string) => new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const formatDateTime = (tarih: string) => new Date(tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 md:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-xl max-w-2xl w-full max-h-[95vh] md:max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 md:p-6">
          <div className="md:hidden w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
              <span>👰</span> Gelin Detayı
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-pink-200 to-purple-200 rounded-2xl flex items-center justify-center text-gray-600 text-xl md:text-2xl font-bold">
              {gelin.isim.charAt(0)}
            </div>
            <div>
              <p className="text-lg md:text-xl font-semibold text-gray-800">{gelin.isim}</p>
              <p className="text-sm md:text-base text-gray-600">{formatTarih(gelin.tarih)} • {gelin.saat}</p>
              {gelin.kinaGunu && <p className="text-xs md:text-sm text-gray-500 mt-1">Kına Günü: {gelin.kinaGunu}</p>}
            </div>
          </div>

          <div className="space-y-3 md:space-y-4">
            {gelin.telefon && (
              <div className="bg-blue-50 p-3 md:p-4 rounded-xl">
                <h4 className="font-semibold text-blue-900 mb-2 md:mb-3 flex items-center gap-2 text-sm md:text-base">
                  <span>📞</span> İletişim Bilgileri
                </h4>
                <div className="space-y-2 text-sm">
                  {gelin.telefon && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Tel:</span>
                      <a href={`tel:${gelin.telefon}`} className="text-blue-700 hover:underline">{gelin.telefon}</a>
                    </div>
                  )}
                  {gelin.esiTelefon && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Eşi Tel:</span>
                      <a href={`tel:${gelin.esiTelefon}`} className="text-blue-700 hover:underline">{gelin.esiTelefon}</a>
                    </div>
                  )}
                  {gelin.instagram && (
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-medium">Instagram:</span>
                      <a href={`https://instagram.com/${gelin.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{gelin.instagram}</a>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-pink-50 rounded-xl">
                <p className="text-pink-600 text-xs md:text-sm font-medium mb-2">💄 Makyaj</p>
                {makyajPersonel ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{makyajPersonel.emoji}</span>
                      <span className="font-semibold text-gray-800">{makyajPersonel.isim}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{makyajPersonel.instagram}</p>
                    <p className="text-xs text-gray-500">{makyajPersonel.telefon}</p>
                  </>
                ) : (
                  <p className="text-gray-500">Atanmamış</p>
                )}
              </div>
              <div className="p-3 md:p-4 bg-purple-50 rounded-xl">
                <p className="text-purple-600 text-xs md:text-sm font-medium mb-2">🧕 Türban</p>
                {turbanPersonel ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-lg md:text-xl">{turbanPersonel.emoji}</span>
                      <span className="font-semibold text-gray-800 text-sm md:text-base">{turbanPersonel.isim}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{turbanPersonel.instagram}</p>
                    <p className="text-xs text-gray-500">{turbanPersonel.telefon}</p>
                  </>
                ) : makyajPersonel && gelin.turban === gelin.makyaj ? (
                  <p className="text-gray-600 text-xs md:text-sm">Makyaj ile aynı kişi</p>
                ) : (
                  <p className="text-gray-500 text-sm">Atanmamış</p>
                )}
              </div>
            </div>

            {(gelin.fotografci || gelin.modaevi) && (
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {gelin.fotografci && (
                  <div className="bg-orange-50 p-3 md:p-4 rounded-xl">
                    <p className="text-orange-600 text-xs md:text-sm font-medium mb-1">📷 Fotoğrafçı</p>
                    <p className="text-gray-800 font-medium text-sm">{gelin.fotografci}</p>
                  </div>
                )}
                {gelin.modaevi && (
                  <div className="bg-purple-50 p-3 md:p-4 rounded-xl">
                    <p className="text-purple-600 text-xs md:text-sm font-medium mb-1">👗 Modaevi</p>
                    <p className="text-gray-800 font-medium text-sm">{gelin.modaevi}</p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
              <h4 className="font-medium text-gray-700 mb-2 md:mb-3 text-sm md:text-base">💰 Ödeme Bilgileri</h4>
              <div className="grid grid-cols-3 gap-2 md:gap-4 mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Ücret</p>
                  <p className="font-bold text-gray-800 text-sm md:text-base">
                    {gelin.ucret === -1 ? <span className="text-gray-400">-</span> : `${gelin.ucret.toLocaleString('tr-TR')} ₺`}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kapora</p>
                  <p className="font-bold text-green-600 text-sm md:text-base">{gelin.kapora.toLocaleString('tr-TR')} ₺</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Kalan</p>
                  <p className="font-bold text-red-600 text-sm md:text-base">
                    {gelin.ucret === -1 ? '-' : `${gelin.kalan.toLocaleString('tr-TR')} ₺`}
                  </p>
                </div>
              </div>
              {gelin.anlasildigiTarih && (
                <p className="text-xs text-gray-500">Anlaştığı Tarih: {formatDateTime(gelin.anlasildigiTarih)}</p>
              )}
            </div>

            {/* Takip Listesi - Takvimden Çekilen Checklist */}
            <div className="bg-gradient-to-br from-green-50 to-teal-50 p-3 md:p-4 rounded-xl border border-green-100">
              <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2 text-sm md:text-base">
                <span>✅</span> Takip Listesi
              </h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className={`text-lg ${gelin.bilgilendirmeGonderildi ? 'opacity-100' : 'opacity-30'}`}>
                    {gelin.bilgilendirmeGonderildi ? '✔️' : '⬜'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${gelin.bilgilendirmeGonderildi ? 'text-gray-800' : 'text-gray-500'}`}>
                      Bilgilendirme metni gönderildi mi
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className={`text-lg ${gelin.ucretYazildi ? 'opacity-100' : 'opacity-30'}`}>
                    {gelin.ucretYazildi ? '✔️' : '⬜'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${gelin.ucretYazildi ? 'text-gray-800' : 'text-gray-500'}`}>
                      Anlaşılan ve kalan ücret yazıldı mı
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className={`text-lg ${gelin.malzemeListesiGonderildi ? 'opacity-100' : 'opacity-30'}`}>
                    {gelin.malzemeListesiGonderildi ? '✔️' : '⬜'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${gelin.malzemeListesiGonderildi ? 'text-gray-800' : 'text-gray-500'}`}>
                      Malzeme listesi gönderildi mi
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <span className={`text-lg ${gelin.paylasimIzni ? 'opacity-100' : 'opacity-30'}`}>
                    {gelin.paylasimIzni ? '✔️' : '⬜'}
                  </span>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${gelin.paylasimIzni ? 'text-gray-800' : 'text-gray-500'}`}>
                      Paylaşım izni var mı
                    </p>
                  </div>
                </div>

                <div className="border-t border-green-200 my-3 pt-3">
                  {/* Yorum İstensin Mi - ÖZEL ALAN */}
                  <div className="flex items-start gap-2">
                    <span className={`text-lg ${gelin.yorumIstesinMi ? 'opacity-100' : 'opacity-30'}`}>
                      {gelin.yorumIstesinMi ? '✅' : '⬜'}
                    </span>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${gelin.yorumIstesinMi ? 'text-green-800' : 'text-gray-400'}`}>
                        Yorum istensin mi
                      </p>
                      {gelin.yorumIstesinMi && (
                        <div className="mt-1 flex items-center gap-2">
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                            {gelin.yorumIstesinMi}
                          </span>
                        </div>
                      )}
                      {!gelin.yorumIstesinMi && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          ⚠️ Boş! Gelin bitişinden 1 saat sonra sistem otomatik hatırlatma gönderecek
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Yorum İstendi Mi */}
                  <div className="flex items-start gap-2 mt-2">
                    <span className={`text-lg ${gelin.yorumIstendiMi ? 'opacity-100' : 'opacity-30'}`}>
                      {gelin.yorumIstendiMi ? '✅' : '⬜'}
                    </span>
                    <div>
                      <p className={`text-sm font-medium ${gelin.yorumIstendiMi ? 'text-gray-800' : 'text-gray-500'}`}>
                        Yorum istendi mi
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-green-700 mt-3 italic">
                * Bu bilgiler takvimden otomatik çekilir
              </p>
            </div>

            <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
              <h4 className="font-medium text-gray-700 mb-2 text-sm md:text-base">📝 Gelin Notu</h4>
              {gelin.gelinNotu ? (
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{gelin.gelinNotu}</p>
              ) : (
                <p className="text-gray-400 text-sm italic">Henüz not eklenmemiş</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}