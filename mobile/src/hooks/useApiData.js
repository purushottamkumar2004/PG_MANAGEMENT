import { useCallback, useEffect, useRef, useState } from 'react';

// Loads one API response for a screen.
// - First load shows a spinner (loading, no data).
// - Pull-to-refresh sets `refreshing`.
// - A failed load or refresh keeps the last data on screen and sets `error`,
//   so a network drop never blanks the screen. (401 / ACCOUNT_INACTIVE are
//   handled by the API client: the session is cleared and Login opens.)
// `key` identifies what is loaded (e.g. the id); when it changes, data resets.
export function useApiData(load, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false });
  const loadRef = useRef(load);
  loadRef.current = load;
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mode) => {
    const myId = ++requestId.current;
    setState((s) => ({
      ...s,
      loading: mode !== 'refresh',
      refreshing: mode === 'refresh',
    }));
    try {
      const data = await loadRef.current();
      if (!mounted.current || myId !== requestId.current) return;
      setState({ data, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (!mounted.current || myId !== requestId.current) return;
      setState((s) => ({ data: s.data, error, loading: false, refreshing: false }));
    }
  }, []);

  useEffect(() => {
    setState({ data: null, error: null, loading: true, refreshing: false });
    run('load');
  }, [key, run]);

  const refresh = useCallback(() => run('refresh'), [run]);
  const retry = useCallback(() => run('load'), [run]);

  return { ...state, refresh, retry };
}
