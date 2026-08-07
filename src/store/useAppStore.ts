import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings } from '../types';

interface AppState {
  // Settings
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

  // UI State
  activeTab: 'dashboard' | 'input' | 'prediction' | 'history' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'input' | 'prediction' | 'history' | 'settings') => void;
  
  // Theme Action
  toggleTheme: () => void;
}

const defaultSettings: AppSettings = {
  kwhTariff: 1444.7,
  lowThreshold: 20,
  telegramEnabled: false,
  telegramToken: '',
  telegramChatId: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  theme: 'dark'
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      
      setSettings: (settings) => set({ settings }),
      
      updateSetting: (key, value) => 
        set((state) => ({ 
          settings: { ...state.settings, [key]: value } 
        })),

      activeTab: 'dashboard',
      
      setActiveTab: (tab) => set({ activeTab: tab }),

      toggleTheme: () => 
        set((state) => {
          const newTheme = state.settings.theme === 'dark' ? 'light' : 'dark';
          // Terapkan class ke document root untuk tailwind dark mode
          if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          return { settings: { ...state.settings, theme: newTheme } };
        })
    }),
    {
      name: 'tokenpro-store', // Nama key di localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }), // Hanya simpan settings ke localStorage
    }
  )
);
