// app/lib/authStore.ts
import { Preferences } from '@capacitor/preferences';

const KEY = 'authToken';

let token: string | null = null;
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export function isHydrated(): boolean {
  return hydrated;
}

export function getTokenSync(): string | null {
  return token;
}

export async function hydrateAuthStore(): Promise<void> {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const res = await Preferences.get({ key: KEY });
      token = res.value ?? null;
    } finally {
      hydrated = true;
    }
  })();

  return hydratePromise;
}

export async function setToken(newToken: string): Promise<void> {
  token = newToken;
  hydrated = true;
  await Preferences.set({ key: KEY, value: newToken });
}

export async function clearToken(): Promise<void> {
  token = null;
  hydrated = true;
  await Preferences.remove({ key: KEY });
}

export async function getToken(): Promise<string | null> {
  if (!hydrated) await hydrateAuthStore();
  return token;
}