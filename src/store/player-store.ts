import { create } from 'zustand';

import { kv, KvKeys } from '@/services/kv';

export type QualityLevel = 'auto' | '360p' | '480p' | '720p' | '1080p';

export const QUALITY_LEVELS: readonly QualityLevel[] = [
  'auto',
  '360p',
  '480p',
  '720p',
  '1080p',
] as const;

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];

interface PlayerState {
  // ---- persisted preferences ------------------------------------------
  rate: PlaybackRate;
  preferredQuality: QualityLevel;
  captionsEnabled: boolean;
  autoplayNext: boolean;
  /** Cap streaming quality when not on wifi. */
  dataSaver: boolean;

  // ---- ephemeral session state ----------------------------------------
  /** Quality the ABR ladder actually settled on, for the "Auto (720p)" label. */
  activeQualityLabel: string | null;
  isFullscreen: boolean;
  controlsVisible: boolean;

  setRate: (r: PlaybackRate) => void;
  setPreferredQuality: (q: QualityLevel) => void;
  setCaptionsEnabled: (v: boolean) => void;
  setAutoplayNext: (v: boolean) => void;
  setDataSaver: (v: boolean) => void;
  setActiveQualityLabel: (l: string | null) => void;
  setFullscreen: (v: boolean) => void;
  setControlsVisible: (v: boolean) => void;
  resetSession: () => void;
}

const isRate = (n: number): n is PlaybackRate =>
  (PLAYBACK_RATES as readonly number[]).includes(n);

function storedRate(): PlaybackRate {
  const n = kv.getNumber(KvKeys.playbackRate);
  return typeof n === 'number' && isRate(n) ? n : 1;
}

function storedQuality(): QualityLevel {
  const raw = kv.getString(KvKeys.preferredQuality) as QualityLevel | undefined;
  return raw && QUALITY_LEVELS.includes(raw) ? raw : 'auto';
}

export const usePlayerStore = create<PlayerState>((set) => ({
  rate: storedRate(),
  preferredQuality: storedQuality(),
  captionsEnabled: kv.getBoolean(KvKeys.captionsEnabled) ?? false,
  autoplayNext: kv.getBoolean(KvKeys.autoplayNext) ?? true,
  dataSaver: kv.getBoolean('pref.dataSaver') ?? false,

  activeQualityLabel: null,
  isFullscreen: false,
  controlsVisible: true,

  setRate: (rate) => {
    kv.set(KvKeys.playbackRate, rate);
    set({ rate });
  },
  setPreferredQuality: (preferredQuality) => {
    kv.set(KvKeys.preferredQuality, preferredQuality);
    set({ preferredQuality });
  },
  setCaptionsEnabled: (captionsEnabled) => {
    kv.set(KvKeys.captionsEnabled, captionsEnabled);
    set({ captionsEnabled });
  },
  setAutoplayNext: (autoplayNext) => {
    kv.set(KvKeys.autoplayNext, autoplayNext);
    set({ autoplayNext });
  },
  setDataSaver: (dataSaver) => {
    kv.set('pref.dataSaver', dataSaver);
    set({ dataSaver });
  },
  setActiveQualityLabel: (activeQualityLabel) => set({ activeQualityLabel }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setControlsVisible: (controlsVisible) => set({ controlsVisible }),

  resetSession: () =>
    set({ activeQualityLabel: null, isFullscreen: false, controlsVisible: true }),
}));
