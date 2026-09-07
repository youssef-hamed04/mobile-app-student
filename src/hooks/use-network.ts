import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkStatus {
  connected: boolean;
  /** Null while unknown — treat as "probably fine" and don't block the UI. */
  reachable: boolean | null;
  type: string;
  /** Cellular or a metered wifi — used by data saver. */
  metered: boolean;
  /** Heuristic: 2g/3g or "poor" cellular generation. */
  slow: boolean;
}

function derive(state: NetInfoState): NetworkStatus {
  const cellularGeneration =
    state.type === 'cellular' ? (state.details?.cellularGeneration ?? null) : null;

  return {
    connected: state.isConnected ?? false,
    reachable: state.isInternetReachable,
    type: state.type,
    metered: state.type === 'cellular',
    slow: cellularGeneration === '2g' || cellularGeneration === '3g',
  };
}

export function useNetwork(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: true,
    reachable: null,
    type: 'unknown',
    metered: false,
    slow: false,
  });

  useEffect(() => {
    let mounted = true;
    void NetInfo.fetch().then((s) => mounted && setStatus(derive(s)));
    const unsub = NetInfo.addEventListener((s) => setStatus(derive(s)));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return status;
}

/** True only when we are confident the device is offline. */
export function useIsOffline(): boolean {
  const { connected, reachable } = useNetwork();
  return !connected || reachable === false;
}
