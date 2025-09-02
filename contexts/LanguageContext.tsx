
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { translations, getInitialLocale, Locale } from '../i18n';

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof translations.en, replacements?: { [key: string]: string | number }) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>(getInitialLocale());

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
