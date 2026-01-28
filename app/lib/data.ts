// Personel bilgileri
export interface Personel {
  id: string;
  isim: string;
  kisaltma: string;
  emoji: string;
  renk: string;
  dogumGunu: string;
  telefon: string;
  instagram: string;
  rol: string;
  calismaBaslangic: string;
  calismaSaatleri: string;
}

export const personelListesi: Personel[] = [
  { 
    id: "saliha",
    isim: "Saliha", 
    kisaltma: "SA",
    emoji: "👩‍🦰", 
    renk: "from-red-100 to-red-200",
    dogumGunu: "1995-03-15",
    telefon: "0532 xxx xx xx",
    instagram: "@saliha_makeup",
    rol: "Makyaj & Türban",
    calismaBaslangic: "2023-01-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "selen",
    isim: "Selen", 
    kisaltma: "SE",
    emoji: "👩‍🦱", 
    renk: "from-blue-100 to-blue-200",
    dogumGunu: "1998-07-22",
    telefon: "0533 xxx xx xx",
    instagram: "@selen_beauty",
    rol: "Makyaj & Türban",
    calismaBaslangic: "2023-06-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "tansu",
    isim: "Tansu", 
    kisaltma: "T",
    emoji: "👩", 
    renk: "from-green-100 to-green-200",
    dogumGunu: "1996-11-08",
    telefon: "0534 xxx xx xx",
    instagram: "@tansu_style",
    rol: "Türban",
    calismaBaslangic: "2024-01-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "kubra",
    isim: "Kübra", 
    kisaltma: "K",
    emoji: "👩‍🦳", 
    renk: "from-purple-100 to-purple-200",
    dogumGunu: "1997-05-30",
    telefon: "0535 xxx xx xx",
    instagram: "@kubra_makeup",
    rol: "Makyaj & Türban",
    calismaBaslangic: "2023-03-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "rumeysa",
    isim: "Rümeysa", 
    kisaltma: "R",
    emoji: "🧕", 
    renk: "from-pink-100 to-pink-200",
    dogumGunu: "1999-09-12",
    telefon: "0536 xxx xx xx",
    instagram: "@rumeysa_beauty",
    rol: "Makyaj & Türban",
    calismaBaslangic: "2024-06-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "bahar",
    isim: "Bahar", 
    kisaltma: "B",
    emoji: "👧", 
    renk: "from-yellow-100 to-yellow-200",
    dogumGunu: "2000-04-18",
    telefon: "0537 xxx xx xx",
    instagram: "@bahar_style",
    rol: "Türban",
    calismaBaslangic: "2024-09-01",
    calismaSaatleri: "09:00 - 18:00"
  },
  { 
    id: "zehra",
    isim: "Zehra", 
    kisaltma: "Z",
    emoji: "👩‍🔬", 
    renk: "from-teal-100 to-teal-200",
    dogumGunu: "1998-12-25",
    telefon: "0538 xxx xx xx",
    instagram: "@zehra_makeup",
    rol: "Makyaj",
    calismaBaslangic: "2025-01-01",
    calismaSaatleri: "09:00 - 18:00"
  },
];

// Personel bul
export const getPersonelByIsim = (isim: string): Personel | undefined => {
  return personelListesi.find(p => p.isim === isim);
};

export const getPersonelById = (id: string): Personel | undefined => {
  return personelListesi.find(p => p.id === id);
};

// Yaklaşan doğum günleri (30 gün içinde)
export const getYaklasanDogumGunleri = () => {
  const bugun = new Date();
  const otuzGunSonra = new Date();
  otuzGunSonra.setDate(bugun.getDate() + 30);
  
  return personelListesi.filter(p => {
    const dogumGunu = new Date(p.dogumGunu);
    const buYilDogumGunu = new Date(bugun.getFullYear(), dogumGunu.getMonth(), dogumGunu.getDate());
    
    if (buYilDogumGunu < bugun) {
      buYilDogumGunu.setFullYear(bugun.getFullYear() + 1);
    }
    
    return buYilDogumGunu >= bugun && buYilDogumGunu <= otuzGunSonra;
  }).map(p => {
    const dogumGunu = new Date(p.dogumGunu);
    const buYilDogumGunu = new Date(bugun.getFullYear(), dogumGunu.getMonth(), dogumGunu.getDate());
    if (buYilDogumGunu < bugun) {
      buYilDogumGunu.setFullYear(bugun.getFullYear() + 1);
    }
    return {
      ...p,
      yaklasanTarih: buYilDogumGunu.toISOString().split('T')[0],
      kalanGun: Math.ceil((buYilDogumGunu.getTime() - bugun.getTime()) / (1000 * 60 * 60 * 24))
    };
  }).sort((a, b) => a.kalanGun - b.kalanGun);
};

// İzin tipleri
export type IzinTuru = 'yillik' | 'mazeret' | 'hastalik' | 'ucretsiz' | 'diger';

export interface Izin {
  id: string;
  personelId: string;
  baslangic: string;
  bitis: string;
  tur: IzinTuru;
  aciklama: string;
  onayDurumu: 'beklemede' | 'onaylandi' | 'reddedildi';
  olusturmaTarihi: string;
}

// Örnek izin verileri
export const izinler: Izin[] = [
  { 
    id: "1",
    personelId: "saliha", 
    baslangic: "2026-02-01", 
    bitis: "2026-02-03", 
    tur: "yillik", 
    aciklama: "Yıllık izin",
    onayDurumu: "onaylandi",
    olusturmaTarihi: "2026-01-20"
  },
  { 
    id: "2",
    personelId: "tansu", 
    baslangic: "2026-01-30", 
    bitis: "2026-01-30", 
    tur: "mazeret", 
    aciklama: "Doktor randevusu",
    onayDurumu: "onaylandi",
    olusturmaTarihi: "2026-01-25"
  },
  { 
    id: "3",
    personelId: "zehra", 
    baslangic: "2026-02-10", 
    bitis: "2026-02-14", 
    tur: "yillik", 
    aciklama: "Tatil",
    onayDurumu: "beklemede",
    olusturmaTarihi: "2026-01-28"
  },
];

// Belirli tarihte izinli personelleri getir
export const getIzinliler = (tarih: string) => {
  return izinler
    .filter(izin => izin.baslangic <= tarih && izin.bitis >= tarih && izin.onayDurumu === 'onaylandi')
    .map(izin => ({
      ...izin,
      personel: getPersonelById(izin.personelId)
    }));
};

// Tarih aralığındaki izinleri getir
export const getIzinlerAralik = (baslangic: string, bitis: string) => {
  return izinler
    .filter(izin => izin.baslangic <= bitis && izin.bitis >= baslangic)
    .map(izin => ({
      ...izin,
      personel: getPersonelById(izin.personelId)
    }));
};

// Duyuru
export interface Duyuru {
  id: string;
  baslik: string;
  icerik: string;
  tarih: string;
  yazar: string;
  onemli: boolean;
  okundu: boolean;
}

// Örnek duyurular
export const duyurular: Duyuru[] = [
  { 
    id: "1",
    baslik: "Şubat Ayı Toplantısı",
    icerik: "1 Şubat Cumartesi saat 10:00'da ofiste toplantımız var. Herkesin katılması önemli. Gündem: Şubat ayı planlaması ve yeni ürünler.",
    tarih: "2026-01-28T10:00:00",
    yazar: "Gizem",
    onemli: true,
    okundu: false
  },
  { 
    id: "2",
    baslik: "Yeni Ürünler Geldi",
    icerik: "MAC ve Bobbi Brown'dan yeni ürünler geldi. Depoda kontrol edebilirsiniz. Özellikle yeni fondöten serisini mutlaka deneyin.",
    tarih: "2026-01-25T14:30:00",
    yazar: "Gizem",
    onemli: false,
    okundu: true
  },
  { 
    id: "3",
    baslik: "Fiyat Güncellemesi",
    icerik: "1 Şubat'tan itibaren geçerli olacak yeni fiyat listesi ekte paylaşılmıştır. Lütfen inceleyin.",
    tarih: "2026-01-22T09:00:00",
    yazar: "Gizem",
    onemli: true,
    okundu: true
  },
  { 
    id: "4",
    baslik: "Temizlik Malzemeleri",
    icerik: "Fırça temizleyici ve dezenfektan stoklarımız azaldı. Bu hafta içinde temin edilecek.",
    tarih: "2026-01-18T11:00:00",
    yazar: "Saliha",
    onemli: false,
    okundu: true
  },
];

// Resmi tatiller
export interface ResmiTatil {
  tarih: string;
  isim: string;
  sure: number; // gün sayısı
}

export const resmiTatiller: ResmiTatil[] = [
  { tarih: "2026-01-01", isim: "Yılbaşı", sure: 1 },
  { tarih: "2026-03-20", isim: "Ramazan Bayramı", sure: 3 },
  { tarih: "2026-04-23", isim: "Ulusal Egemenlik ve Çocuk Bayramı", sure: 1 },
  { tarih: "2026-05-01", isim: "Emek ve Dayanışma Günü", sure: 1 },
  { tarih: "2026-05-19", isim: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", sure: 1 },
  { tarih: "2026-05-27", isim: "Kurban Bayramı", sure: 4 },
  { tarih: "2026-07-15", isim: "Demokrasi ve Milli Birlik Günü", sure: 1 },
  { tarih: "2026-08-30", isim: "Zafer Bayramı", sure: 1 },
  { tarih: "2026-10-29", isim: "Cumhuriyet Bayramı", sure: 1 },
];

// Yaklaşan resmi tatilleri getir
export const getYaklasanTatiller = () => {
  const bugun = new Date().toISOString().split('T')[0];
  return resmiTatiller
    .filter(t => t.tarih >= bugun)
    .slice(0, 5);
};
