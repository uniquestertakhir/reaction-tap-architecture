// ===== FILE START: apps/web/lib/platform/audioSettings.ts =====
export type AudioSettings = {
  appSounds: boolean; // UI sounds (clicks, menus)
  inGameSounds: boolean; // SFX in games
  inGameMusic: boolean; // Music in games (future)
  inGameVoice: boolean; // Voice in games (future)
  haptics: boolean; // vibration / haptic feedback
};

export const AUDIO_SETTINGS_KEY = "rt_audio_settings_v1";
export const AUDIO_SETTINGS_CHANGED_EVENT = "rt_audio_settings_changed_v1";

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  appSounds: true,
  inGameSounds: true,
  inGameMusic: true,
  inGameVoice: true,
  haptics: true,
};

function safeParse(json: string | null): any {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function readAudioSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_AUDIO_SETTINGS;

  const raw = safeParse(window.localStorage.getItem(AUDIO_SETTINGS_KEY));
  if (!raw || typeof raw !== "object") return DEFAULT_AUDIO_SETTINGS;

  // жестко нормализуем, чтобы не было мусора и undefined
  const s: AudioSettings = {
    appSounds: raw.appSounds !== false,
    inGameSounds: raw.inGameSounds !== false,
    inGameMusic: raw.inGameMusic !== false,
    inGameVoice: raw.inGameVoice !== false,
    haptics: raw.haptics !== false,
  };

  return s;
}

export function writeAudioSettings(next: AudioSettings) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(AUDIO_SETTINGS_CHANGED_EVENT));
}

export function patchAudioSettings(patch: Partial<AudioSettings>) {
  const cur = readAudioSettings();
  const next: AudioSettings = { ...cur, ...patch };
  writeAudioSettings(next);
}

export function onAudioSettingsChanged(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const fn = () => cb();
  window.addEventListener(AUDIO_SETTINGS_CHANGED_EVENT, fn);
  return () => window.removeEventListener(AUDIO_SETTINGS_CHANGED_EVENT, fn);
}
// ===== FILE END: apps/web/lib/platform/audioSettings.ts =====