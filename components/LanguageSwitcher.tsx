import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
    const { locale, setLocale } = useLanguage();

    return (
        <div className="flex items-center space-x-1 p-1 bg-slate-800 rounded-lg">
            <button
                onClick={() => setLocale('en')}
                disabled={locale === 'en'}
                className={`w-20 py-1 text-sm font-semibold rounded-md transition-all duration-300 ${
                    locale === 'en'
                        ? 'bg-sky-500 text-white shadow'
                        : 'text-slate-300 hover:bg-slate-700/50'
                }`}
            >
                English
            </button>
            <button
                onClick={() => setLocale('ja')}
                disabled={locale === 'ja'}
                className={`w-20 py-1 text-sm font-semibold rounded-md transition-all duration-300 ${
                    locale === 'ja'
                        ? 'bg-sky-500 text-white shadow'
                        : 'text-slate-300 hover:bg-slate-700/50'
                }`}
            >
                日本語
            </button>
        </div>
    );
};

export default LanguageSwitcher;