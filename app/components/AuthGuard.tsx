'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/AuthProvider';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (loading) return;

    console.log('🔥 [GUARD]', { pathname, authed: !!user });

    // ✅ Not logged in -> login (ama zaten login'deysen dokunma)
    if (!user && !isLogin) {
      window.location.replace('/login');
      return;
    }

    // ✅ Logged in -> home (login'deysen)
    if (user && isLogin) {
      window.location.replace('/');
      return;
    }
  }, [user, loading, pathname, isLogin]);

  // ✅ SADECE "unknown" iken loader
  if (loading) return null;

  // ✅ login'de user yoksa login sayfasını göster
  if (!user && isLogin) return children;

  // ✅ login'de user varsa redirect efekti çalışacak, çocuk göstermeye gerek yok
  if (user && isLogin) return null;

  // ✅ diğer sayfalarda user yoksa redirect efekti çalışacak
  if (!user && !isLogin) return null;

  return children;
}