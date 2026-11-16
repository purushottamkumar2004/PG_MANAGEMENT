import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, authApi, configureClient } from '../api/client';
import { clearSession, loadSession, saveSession } from './storage';
import { isKnownRole } from './routes';

const SessionContext = createContext(null);

// status: 'loading' while reading secure storage, then 'ready'.
// user is null when logged out.
export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', token: null, user: null });
  const tokenRef = useRef(null);

  const setLoggedOut = useCallback(() => {
    tokenRef.current = null;
    setState({ status: 'ready', token: null, user: null });
  }, []);

  const signOutLocal = useCallback(async () => {
    setLoggedOut();
    await clearSession();
  }, [setLoggedOut]);

  useEffect(() => {
    configureClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        signOutLocal();
      },
    });
  }, [signOutLocal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (!stored || !isKnownRole(stored.user.role)) {
        if (stored) await clearSession();
        setLoggedOut();
        return;
      }
      tokenRef.current = stored.token;
      setState({ status: 'ready', token: stored.token, user: stored.user });

      // Refresh the user in the background. 401 and ACCOUNT_INACTIVE are handled
      // by the client (onUnauthorized, D-21). Network errors keep the stored
      // session so the app still opens offline.
      try {
        const res = await authApi.me();
        if (cancelled || !res || !res.user || tokenRef.current !== stored.token) return;
        if (!isKnownRole(res.user.role)) {
          await signOutLocal();
          return;
        }
        await saveSession({ token: stored.token, user: res.user });
        setState((s) => (s.token === stored.token ? { ...s, user: res.user } : s));
      } catch {
        // Handled above or offline: nothing to do.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLoggedOut, signOutLocal]);

  const signIn = useCallback(async (phone, password) => {
    const res = await authApi.login(phone, password);
    if (!res || !res.token || !res.user || !isKnownRole(res.user.role)) {
      throw new ApiError('INTERNAL', 'Unexpected login response');
    }
    await saveSession({ token: res.token, user: res.user });
    tokenRef.current = res.token;
    setState({ status: 'ready', token: res.token, user: res.user });
    return res.user;
  }, []);

  const signOut = useCallback(async () => {
    // Stateless logout (contract): tell the server, but never wait on it to log out locally.
    if (tokenRef.current) authApi.logout().catch(() => {});
    await signOutLocal();
  }, [signOutLocal]);

  const value = useMemo(
    () => ({ status: state.status, user: state.user, signIn, signOut }),
    [state.status, state.user, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
