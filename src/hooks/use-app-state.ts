import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

export function useAppState(): AppStateStatus {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setState);
    return () => sub.remove();
  }, []);

  return state;
}

/** Fires when the app comes back to the foreground. */
export function useOnForeground(fn: () => void) {
  const cb = useRef(fn);
  cb.current = fn;

  useEffect(() => {
    let previous = AppState.currentState;
    const sub = AppState.addEventListener('change', (next) => {
      if (previous.match(/inactive|background/) && next === 'active') cb.current();
      previous = next;
    });
    return () => sub.remove();
  }, []);
}
