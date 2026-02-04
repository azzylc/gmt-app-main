# 🚨 MGT App - Operasyon Runbook v1.1

**Son Güncelleme:** 1 Şubat 2026  
**Versiyon:** 1.1

---

## 1. Drift Alarmı Gelince (Sentry'de "Calendar drift detected")
```bash
# 1. Sentry'de event'i aç → extra alanında kaç kayıt fark var bak

# 2. Karar ağacı:
#    - Küçük fark (1-10) + İLK ALARM: 1 saat bekle, kendiliğinden düzelebilir
#    - Küçük fark (1-10) + AYNI GÜN İKİNCİ KEZ: Full-sync tetikle
#    - Büyük fark (10+): Hemen full-sync tetikle

# 3. Manuel full-sync:
curl -X GET "https://gys.mgtapp.com/api/full-sync" \
  -H "Authorization: Bearer <CRON_SECRET>"

# 4. Hala fark varsa kontrol et:
#    - Google Calendar API quota: https://console.cloud.google.com/apis/api/calendar-json.googleapis.com/quotas
#    - Firestore Console: gelinler collection'ı
```

---

## 2. Full-Sync Fail Olursa (Sentry'de hata veya Cron 500)
```bash
# 1. Sentry'de hata detayına bak (stack trace)

# 2. Yaygın hatalar ve çözümleri:
#
#    QUOTA_EXCEEDED:
#    → 24 saat bekle veya Google Cloud Console'dan quota artır
#
#    UNAUTHENTICATED / PERMISSION_DENIED:
#    → Service account key expire OLMAZ, şunları kontrol et:
#       - Vercel env vars doğru mu? (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)
#       - IAM rolleri değişti mi?
#       - Calendar API enabled mı?
#       - Service account'a calendar paylaşıldı mı?
#
#    TIMEOUT (60s aşıldı):
#    → Çok fazla event var, parçalı sync gerekebilir

# 3. Vercel Logs:
#    https://vercel.com/azzylcs-projects/gmt-app-main/logs

# 4. Manuel retry:
curl -X GET "https://gys.mgtapp.com/api/full-sync" \
  -H "Authorization: Bearer <CRON_SECRET>"

# 5. Job stats kontrol (Firestore):
#    Path: system > jobStats > jobs > fullSync
#    Bak: lastErrorAt, lastErrorCode
```

---

## 3. Webhook Channel Yenileme Kontrolü
```bash
# 1. Channel 7 günde expire olur
# 2. Cron her 5 günde bir yeniler (0 0 */5 * *)

# 3. Kontrol (Firestore):
#    Path: webhookChannels collection
#    Bak: expiration tarihine

# 4. Manuel yenileme:
curl -X GET "https://gys.mgtapp.com/api/renew-watch" \
  -H "Authorization: Bearer <CRON_SECRET>"

# 5. Doğrulama:
#    → Firestore'da webhookChannels'ta yeni channelId görünmeli
```

---

## 4. Backup'tan Restore Gerekirse
```
1. Google Cloud Console → Firestore → Disaster Recovery

2. İki seçenek:
   a) PITR - son 7 gün içinde herhangi bir ana dön
   b) Weekly Backup - Pazartesi snapshot'ları (98 gün retention)

3. ⚠️ ÖNEMLİ: Restore YENİ database'e yazılır, mevcut data'yı bozmaz

4. Cutover planı (restore sonrası production'a geçiş):
   - Seçenek A: Yeni DB'den export → default DB'ye import
   - Seçenek B: App env/config ile farklı DB'ye yönlendir
   
5. Test: Yeni DB'yi uygulamada test et, sorun yoksa cutover yap
```

---

## 5. Hızlı Sağlık Kontrolü
```bash
# === AUTH KONTROLÜ (401 beklenir) ===
curl https://gys.mgtapp.com/api/full-sync
curl https://gys.mgtapp.com/api/drift-detection
curl https://gys.mgtapp.com/api/renew-watch
# → Hepsi {"error":"Unauthorized"} dönmeli

# === WEBHOOK VALİDATİON (validation_failed beklenir) ===
curl -X POST "https://gys.mgtapp.com/api/calendar-webhook" \
  -H "x-goog-channel-id: fake" \
  -H "x-goog-resource-id: fake" \
  -H "x-goog-channel-token: fake"
# → {"status":"validation_failed"} dönmeli

# === FULL-SYNC TEST (success beklenir) ===
curl -X GET "https://gys.mgtapp.com/api/full-sync" \
  -H "Authorization: Bearer <CRON_SECRET>"
# → {"success":true,...} dönmeli

# === CONCURRENCY LOCK TEST ===
# İki terminal'de aynı anda çalıştır, biri "locked" dönmeli
```

---

## 📂 Firestore Path Referansı

| Path | Açıklama |
|------|----------|
| `gelinler/{eventId}` | Gelin kayıtları |
| `webhookChannels/{channelId}` | Aktif webhook kanalları |
| `system/sync` | syncToken, needsFullSync flag |
| `system/jobStats/jobs/fullSync` | Full-sync istatistikleri |
| `system/jobStats/jobs/driftDetection` | Drift detection istatistikleri |
| `system/locks/jobs/fullSync` | Concurrency lock |

---

## 📞 Acil Durum Kontakları

| Servis | Status Sayfası |
|--------|----------------|
| Vercel | https://www.vercel-status.com |
| Firebase | https://status.firebase.google.com |
| Google Cloud | https://status.cloud.google.com |

---

## 🔑 Environment Variables (Vercel)

| Variable | Açıklama |
|----------|----------|
| `CRON_SECRET` | Cron job authentication |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `GOOGLE_CALENDAR_ID` | Takip edilen calendar |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase admin JSON |

---

## 📊 Monitoring Dashboards

- **Sentry:** https://sentry.io (error tracking)
- **Vercel Analytics:** Vercel Dashboard → Analytics
- **Vercel Logs:** Vercel Dashboard → Logs
- **Firestore Console:** https://console.firebase.google.com/project/gmt-test-99b30/firestore
- **Cron Jobs:** Vercel Dashboard → Settings → Cron Jobs

