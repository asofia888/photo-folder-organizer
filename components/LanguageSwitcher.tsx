import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Locale } from '../i18n';

const LANGUAGES: { locale: Locale; label: string }[] = [
    { locale: 'en', label: 'English' },
    { locale: 'ja', label: '日本語' },
];

const LanguageSwitcher: React.FC = () => {
    const { locale, setLocale, t } = useLanguage();

    return (
        <div role="group" aria-label={t('languageLabel')} className="flex items-center space-x-1 p-1 bg-slate-800 rounded-lg">
            {LANGUAGES.map(language => {
                const isActive = locale === language.locale;
                return (
                    <button
                        key={language.locale}
                        lang={language.locale}
                        onClick={() => setLocale(language.locale)}
                        aria-pressed={isActive}
                        className={`w-20 py-1 text-sm font-semibold rounded-md transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                            isActive
                                ? 'bg-sky-500 text-white shadow'
                                : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                    >
                        {language.label}
                    </button>
                );
            })}
        </div>
    );
};

export default LanguageSwitcher;
