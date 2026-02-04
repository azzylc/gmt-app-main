"use client";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { signInWithEmailPasswordREST } from "../lib/firebase-rest-auth";
import { nativeSignIn } from "../lib/nativeAuth";

export default function LoginPage() {
  const router = useRouter(); // Gemini + Çeto: router kullan
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const isNative = Capacitor.isNativePlatform();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    
    try {
      console.log(`🔥 [LOGIN] Attempting login...`);
      
      if (isNative) {
        console.log('📱 [LOGIN] Using native auth');
        await nativeSignIn(email, password);
      } else {
        console.log('🌐 [LOGIN] Using REST API auth');
        await signInWithEmailPasswordREST(email, password);
      }
      
      console.log('✅ [LOGIN] Login successful');
      
      // Gemini + Çeto: router.replace kullan (NO window.location!)
      // Firebase observer user state'i güncelleyecek
      // AuthGuard otomatik redirect yapacak
      router.replace("/");
      
    } catch (err: any) {
      console.error('❌ [LOGIN] Login failed:', err);
      
      let errorMessage = "Giriş başarısız.";
      if (err.message?.includes('INVALID_LOGIN_CREDENTIALS') || err.message?.includes('INVALID_PASSWORD')) {
        errorMessage = "E-posta veya şifre hatalı.";
      } else if (err.message?.includes('USER_DISABLED')) {
        errorMessage = "Bu hesap devre dışı bırakılmış.";
      } else if (err.message?.includes('TOO_MANY_ATTEMPTS')) {
        errorMessage = "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.";
      } else if (err.message?.includes('auth/')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestType: "PASSWORD_RESET",
            email: resetEmail,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Şifre sıfırlama e-postası gönderilemedi");
      }

      setSuccess("Şifre sıfırlama bağlantısı e-posta adresinize gönderildi");
      setShowResetModal(false);
      setResetEmail("");
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 px-2">
      <div className="w-full max-w-[320px] space-y-4">
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-400 mb-2">
            <span className="text-xl">💄</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Gizem Yolcu Studio</h1>
          <p className="text-xs text-stone-400 mt-1">Gelin Güzelliği Yönetim Sistemi</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-stone-300 mb-1">E-posta</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                placeholder="ornek@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-stone-300 mb-1">Şifre</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-xs">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 text-green-400 text-xs">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-500 text-stone-900 font-semibold py-2.5 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-stone-900"></div>
                  Giriş yapılıyor...
                </>
              ) : (
                "Giriş Yap"
              )}
            </button>
          </form>

          <button
            onClick={() => setShowResetModal(true)}
            className="w-full mt-3 text-xs text-stone-400 hover:text-amber-400 transition"
          >
            Şifremi Unuttum
          </button>
        </div>

        <p className="text-center text-xs text-stone-500">
          © 2025 Gizem Yolcu Studio
        </p>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 z-50">
          <div className="bg-stone-900 rounded-lg p-4 w-full max-w-[320px] border border-white/10">
            <h3 className="text-base font-semibold text-white mb-3">Şifre Sıfırlama</h3>
            <form onSubmit={handlePasswordReset} className="space-y-3">
              <div>
                <label htmlFor="resetEmail" className="block text-xs font-medium text-stone-300 mb-1">
                  E-posta adresinizi girin
                </label>
                <input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                  placeholder="ornek@email.com"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowResetModal(false); setError(""); }}
                  className="flex-1 px-3 py-2 border border-stone-200 text-stone-700 rounded-lg hover:bg-stone-50 transition text-xs font-medium"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 px-3 py-2 bg-amber-400 text-stone-900 rounded-lg hover:bg-amber-500 transition text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {resetLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-stone-900"></div>
                      Gönderiliyor...
                    </>
                  ) : (
                    "Talep Gönder"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
