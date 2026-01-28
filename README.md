# GMT App - Gizem Yolcu Studio Yönetim Sistemi

Gelin makyaj ve türban takibi, personel yönetimi ve finansal takip sistemi.

## 🚀 Kurulum

### 1. Projeyi Kur
```bash
# Dependencies yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev
```

### 2. Firebase Ayarları

`.env.local` dosyası oluştur ve Firebase bilgilerini ekle:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=gmt-test-99b30.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=gmt-test-99b30
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=gmt-test-99b30.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Not:** Şu anda Firebase config `app/lib/firebase.ts` dosyasında hardcoded. Güvenlik için environment variables kullanılmalı.

### 3. Giriş Bilgileri

- **Email:** admin@gmt.com
- **Şifre:** Firebase'de oluşturduğunuz şifre

## 📦 Özellikler

### ⚠️ Dikkat Edilecekler Paneli
- 👤 Atanmamış gelinler
- 💰 İşlenmemiş ücretler
- 🔴 Kapora alınmamış
- 📆 Bugün ödeme bekleyen

### 📊 Modüller
- **Gelinler:** Tüm gelinlerin listesi, detayları, filtreleme
- **Takvim:** Aylık program görünümü
- **Personel:** Çalışan bilgileri, doğum günleri
- **Görevler:** To-do sistemi
- **İzinler:** İzin takibi
- **Duyurular:** Önemli bildirimler
- **Raporlar:** Finansal analizler
- **Ayarlar:** Sistem yapılandırması

## 🛠️ Teknolojiler

- **Next.js 16** - React framework
- **Firebase Auth** - Kimlik doğrulama
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety
- **Google Apps Script API** - Veri kaynağı

## 📝 API Bilgileri

Google Calendar'dan veri çekiliyor:
```
https://script.google.com/macros/s/AKfycbyr_9fBVzkVXf-Fx4s-DUjFTPhHlxm54oBGrrG3UGfNengHOp8rQbXKdX8pOk4reH8/exec
```

## 🎨 Personel

- Saliha (SA) - Makyaj & Türban
- Selen (SE) - Makyaj & Türban
- Tansu (T) - Türban
- Kübra (K) - Makyaj & Türban
- Rümeysa (R) - Makyaj & Türban
- Bahar (B) - Türban
- Zehra (Z) - Makyaj

## 📄 Lisans

© 2026 Gizem Yolcu Studio
