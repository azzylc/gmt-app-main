// app/components/AuthGuard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onIdTokenChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "@/app/lib/firebase";
import { setToken, clearToken } from "@/app/lib/authStore";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = useMemo(() => pathname === "/login", [pathname]);

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // iOS/Capacitor tarafında persistence'ı netleştirmek loop riskini azaltır
    // (IndexedDB garip davranırsa localStorage fallback yerine direkt local)
    setPersistence(auth, browserLocalPersistence).catch(() => {
      // persistence set edilemese bile observer çalışır; sadece loglamak istersen logla
    });

    const unsub = onIdTokenChanged(auth, async (u) => {
      console.log("🔥 [AUTH] onIdTokenChanged:", u ? u.uid : "null");

      setUser(u);

      try {
        if (u) {
          const idToken = await u.getIdToken(); // Firebase ID token
          await setToken(idToken);
          console.log("✅ [AUTH] token persisted (len):", idToken.length);
        } else {
          await clearToken();
          console.log("🧹 [AUTH] token cleared");
        }
      } finally {
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!ready) return;

    // ✅ Redirect kararını SADECE ready olduktan sonra ver
    if (!user && !isLoginRoute) {
      console.warn("⚠️ [AUTH] no user -> /login");
      window.location.replace("/login");
      return;
    }

    if (user && isLoginRoute) {
      console.log("✅ [AUTH] user exists -> /");
      window.location.replace("/");
      return;
    }
  }, [ready, user, isLoginRoute]);

  // Ready değilken redirect yok → loop yok
  // İstersen burada splash spinner basabilirsin
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return <>{children}</>;
}