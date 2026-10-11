
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { translations, getInitialLocale, setCurrentLocale, Locale } from '../i18n';

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.en, replacements?: { [key: string]: string | number }) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale());

  const setLocale = useCallback((newLocale: Locale) => {
    // Keep non-React consumers (errorHandler user messages) in sync.
    setCurrentLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback((key: keyof typeof translations.en, replacements?: { [key: string]: string | number }): string => {
    let translation = translations[locale][key] || translations.en[key];
    if (replacements) {
        Object.entries(replacements).forEach(([k, v]) => {
            translation = translation.replace(`{${k}}`, String(v));
        });
    }
    return translation;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
