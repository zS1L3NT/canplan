import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState as RNAppState, StyleSheet, Text, View } from 'react-native';
import { LoginScreen } from '../auth/LoginScreen';
import { fetchUser, loadSavedSession, signOut } from '../canvas/session';
import { CanvasProvider, useCanvas } from '../canvas/store';
import type { CanvasUser } from '../canvas/types';
import { SPEC, type VariantSpec } from '../ui/designVariant';
import { useTheme } from '../ui/theme';


export type SessionSource = 'Restored from secure store' | 'Fresh login' | 'Demo data';

type AuthState =
  | { kind: 'checking' }
  | { kind: 'signedOut'; reason?: string }
  | { kind: 'signedIn'; user: CanvasUser; source: SessionSource; savedAt: string | null };

export type AppContextValue = {
  user: CanvasUser;
  source: SessionSource;
  savedAt: string | null;
  signOut: () => Promise<void>;
};

const AppCtx = createContext<AppContextValue | null>(null);

export function useAppState(): AppContextValue {
  const v = useContext(AppCtx);
  if (!v) throw new Error('useAppState must be used inside <AppStateProvider>');
  return v;
}

export function useDesignVariant(): { spec: VariantSpec } {
  return { spec: SPEC };
}

const FOREGROUND_REFRESH_MS = 10 * 60 * 1000;

function SignedInBootstrap({ children }: { children: React.ReactNode }) {
  const { refresh, lastRefresh } = useCanvas();
  const refreshRef = useRef(refresh);
  const lastRefreshRef = useRef(lastRefresh);

  useEffect(() => {
    refreshRef.current = refresh;
    lastRefreshRef.current = lastRefresh;
  }, [refresh, lastRefresh]);

  // Cold launch: refresh once after a brief tick so CanvasProvider finishes loading disk cache.
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshRef.current();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Return to foreground: refresh only if the last refresh was over 10 minutes ago.
  useEffect(() => {
    let prevState = RNAppState.currentState;
    const sub = RNAppState.addEventListener('change', (nextState) => {
      const wasBackground = prevState === 'background' || prevState === 'inactive';
      prevState = nextState;
      if (wasBackground && nextState === 'active') {
        const lastMs = lastRefreshRef.current ? new Date(lastRefreshRef.current).getTime() : 0;
        const stale = !lastMs || Number.isNaN(lastMs) || Date.now() - lastMs > FOREGROUND_REFRESH_MS;
        if (stale) {
          refreshRef.current();
        }
      }
    });
    return () => sub.remove();
  }, []);

  return <>{children}</>;
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { colors, typography } = useTheme();
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' });

  // On launch: load the cookie from secure storage and check it against the API.
  useEffect(() => {
    (async () => {
      const saved = await loadSavedSession();
      if (!saved) {
        setAuth({ kind: 'signedOut' });
        return;
      }
      try {
        const user = await fetchUser();
        console.log('[session] restored from secure store for user', user.id);
        setAuth({
          kind: 'signedIn',
          user,
          source: 'Restored from secure store',
          savedAt: saved.savedAt,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setAuth({ kind: 'signedOut', reason: `Saved session no longer works: ${msg}` });
      }
    })();
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setAuth({ kind: 'signedOut' });
  }, []);

  if (auth.kind === 'checking') {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[typography.subhead, { color: colors.textSecondary }]}>
          Checking saved session…
        </Text>
      </View>
    );
  }

  if (auth.kind === 'signedOut') {
    return (
      <LoginScreen
        reason={auth.reason}
        onSignedIn={(user) =>
          setAuth({
            kind: 'signedIn',
            user,
            source: 'Fresh login',
            savedAt: new Date().toISOString(),
          })
        }
        onDemo={() =>
          setAuth({
            kind: 'signedIn',
            user: { id: 0, name: 'Demo student' },
            source: 'Demo data',
            savedAt: null,
          })
        }
      />
    );
  }

  return (
    <AppCtx.Provider
      value={{
        user: auth.user,
        source: auth.source,
        savedAt: auth.savedAt,
        signOut: handleSignOut,
      }}
    >
      <CanvasProvider demo={auth.source === 'Demo data'}>
        <SignedInBootstrap>{children}</SignedInBootstrap>
      </CanvasProvider>
    </AppCtx.Provider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
});
