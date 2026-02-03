#!/bin/bash
set -e

echo "🚀 iOS Build Başlıyor..."

# API disable
echo "📦 API route'ları devre dışı..."
[ -d "app/api" ] && mv app/api app/__api_disabled__

# Build
echo "🏗️  Next.js build..."
npm run build

# API enable
echo "📦 API route'ları geri yükleniyor..."
[ -d "app/__api_disabled__" ] && mv app/__api_disabled__ app/api

# Capacitor sync
echo "📱 Capacitor sync..."
npx cap sync ios

echo "✅ Build tamamlandı!"
echo "🎯 Xcode'u aç: npx cap open ios"
