import { create } from 'zustand';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Optional pre-translated action label + handler. */
  actionLabel?: string;
  onAction?: () => void;
  durationMs: number;
}

interface UIState {
  toasts: Toast[];
  /** Full-screen privacy shield (app backgrounded or capture detected). */
  privacyShield: boolean;
  shieldReason: 'background' | 'capture' | 'recording' | null;
  /** Global blocking overlay used during logout / forced session teardown. */
  blockingTask: string | null;

  pushToast: (t: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
  setPrivacyShield: (on: boolean, reason?: UIState['shieldReason']) => void;
  setBlockingTask: (label: string | null) => void;
}

let counter = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  privacyShield: false,
  shieldReason: null,
  blockingTask: null,

  pushToast: ({ durationMs = 4000, ...rest }) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, durationMs, ...rest }] }));
    return id;
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clearToasts: () => set({ toasts: [] }),

  setPrivacyShield: (on, reason = null) =>
    set({ privacyShield: on, shieldReason: on ? reason : null }),

  setBlockingTask: (blockingTask) => set({ blockingTask }),
}));

/** Imperative helper usable outside React (interceptors, services). */
export const toast = {
  info: (message: string) => useUIStore.getState().pushToast({ message, variant: 'info' }),
  success: (message: string) =>
    useUIStore.getState().pushToast({ message, variant: 'success' }),
  warning: (message: string) =>
    useUIStore.getState().pushToast({ message, variant: 'warning' }),
  error: (message: string) =>
    useUIStore.getState().pushToast({ message, variant: 'error' }),
};
