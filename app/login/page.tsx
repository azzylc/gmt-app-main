"use client";
import { useState } from "react";
import { auth } from "../lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      setError("Giriş başarısız. E-posta veya şifre hatalı.");
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setError("Lütfen e-posta adresinizi girin.");
      return;
    }
    
    setResetLoading(true);
    setError("");
    setSuccess("");
    
    try {
      const response = await fetch('/api/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(data.message);
        setShowResetModal(false);
        setResetEmail("");
      } else {
        setError(data.error || "Bir hata oluştu.");
      }
    } catch (err: any) {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.");
    }
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#fef7f0] flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-amber-400 rounded-lg flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">💄</span>
          </div>
          <h1 className="text-xl font-semibold text-stone-800">GYS Studio</h1>
          <p className="text-stone-500 text-xs mt-1">Gizem Yolcu Studio Yönetim Paneli</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-100 p-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">E-posta</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition text-sm"
                placeholder="admin@gmt.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs text-center">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-600 p-2 rounded-lg text-xs text-center">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 text-stone-900 py-2 rounded-lg font-medium hover:bg-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
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

            {/* Şifremi Unuttum Link */}
            <button
              type="button"
              onClick={() => { setShowResetModal(true); setResetEmail(email); setError(""); setSuccess(""); }}
              className="w-full text-stone-500 hover:text-stone-700 text-xs font-medium transition"
            >
              Şifremi Unuttum
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-stone-400 text-[10px] mt-4">
          © 2026 Gizem Yolcu Studio
        </p>
      </div>

      {/* Şifremi Unuttum Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-stone-800">🔑 Şifre Sıfırlama</h3>
              <button 
                onClick={() => { setShowResetModal(false); setError(""); }}
                className="text-stone-400 hover:text-stone-600 text-xl"
              >
                ×
              </button>
            </div>

            <p className="text-stone-600 text-xs mb-3">
              E-posta adresinizi girin, şifre sıfırlama talebinizi yöneticinize iletelim.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300 transition text-sm"
                placeholder="E-posta adresiniz"
                required
              />

              {error && (
                <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs text-center">
                  {error}
                </div>
              )}

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
