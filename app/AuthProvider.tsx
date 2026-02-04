'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, ensureAuthPersistence } from '@/app/lib/firebase';

type AuthCtx = {
  user: User | null;
  loading: boolean; // "auth state unknown" iken true
};

const Ctx = createContext<AuthCtx>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      console.log('🔥 [APP] AuthProvider mounting...');

      // ✅ Persistence'i garanti et (Capacitor'da kritik)
      await ensureAuthPersistence();

      unsub = onAuthStateChanged(auth, (u) => {
        console.log('🔥 [APP] onAuthStateChanged ->', !!u);
        setUser(u);
        setLoading(false); // ✅ burada mutlaka false olacak
      });
    })();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}