import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Locale } from './types';

interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'zh-CN',
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'language-storage',
    }
  )
);
