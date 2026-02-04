'use client';
import { useEffect, useState } from 'react';
import { hydrateAuthOnce } from './lib/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    console.log('🔥 [APP] AuthProvider mounting, hydrating auth...');
    
    hydrateAuthOnce()
      .then((token) => {
        console.log('✅ [APP] Auth hydrated, token:', token ? 'EXISTS' : 'NULL');
        setReady(true);
      })
      .catch((error) => {
        console.error('❌ [APP] Auth hydration failed:', error);
        setReady(true); // Yine de devam et
      });
  }, []);

  // Hydrate bitene kadar splash göster
  if (!ready) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: 20,
      }}>
        <div>
          <div style={{ marginBottom: 20, fontSize: 40 }}>⚡️</div>
          <div>Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
