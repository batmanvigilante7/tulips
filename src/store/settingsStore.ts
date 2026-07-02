import { create } from 'zustand';

export type ColorTheme = 'Sakura (Pink)' | 'Cosmo (Blue/Teal)' | 'Solar (Gold)' | 'Aurora (Green)';
export type FlowerType = 'rose' | 'tulip' | 'daisy' | 'cherryblossom' | 'lavender' | 'hydrangea';

interface SettingsState {
  isOpen: boolean;
  mirrorCamera: boolean;
  showSkeleton: boolean;
  particleDensity: number; // 0.0 to 2.0
  colorTheme: ColorTheme;
  flowerSpecies: FlowerType;
  smoothingAlpha: number; // 0.05 to 0.8
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  updateSettings: (settings: Partial<Omit<SettingsState, 'setOpen' | 'toggleOpen' | 'updateSettings'>>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  mirrorCamera: true,
  showSkeleton: true,
  particleDensity: 1.0,
  colorTheme: 'Sakura (Pink)',
  flowerSpecies: 'rose',
  smoothingAlpha: 0.24,
  setOpen: (open) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  updateSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));
