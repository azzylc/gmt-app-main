# GMT App - Gelin Takip Sistemi

Version: 3.0.0

## Features
- Gelin bilgileri takibi
- Google Calendar entegrasyonu
- Real-time webhook senkronizasyonu
- Firebase/Firestore backend
- İzin sistemi
- Attendance tracking (QR + GPS)

## Tech Stack
- Next.js 16.1.6
- Firebase Admin SDK
- Google Calendar API
- Vercel Deployment

## Webhook Endpoints
- `/api/setup-watch` - Webhook kurulumu
- `/api/calendar-webhook` - Webhook receiver
- `/api/renew-watch` - Webhook yenileme
- `/api/full-sync` - Full sync

## Deployment
```bash
git push origin main
```
Vercel otomatik deploy eder.

## Webhook Setup
```bash
curl -X POST https://gmt-app-main.vercel.app/api/setup-watch
```

