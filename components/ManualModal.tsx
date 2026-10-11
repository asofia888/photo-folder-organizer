import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpenIcon } from './Icons';
import Spinner from './Spinner';
import { marked } from 'marked';
import BaseModal from './BaseModal';
import type { Locale } from '../i18n';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MANUAL_PATHS: Record<Locale, string> = {
    ja: '/MANUAL.md',
    en: '/MANUAL.en.md',
};

const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    const { t, locale } = useLanguage();
    // Rendered manual per language, loaded the first time it is opened.
    const [manuals, setManuals] = useState<Partial<Record<Locale, string>>>({});
    const [failedLocale, setFailedLocale] = useState<Locale | null>(null);
    const manualContent = manuals[locale];

    useEffect(() => {
        if (!isOpen || manualContent !== undefined) return;

        let cancelled = false;
        setFailedLocale(null);
        fetch(MANUAL_PATHS[locale])
            .then(response => {
                // The SPA rewrite (vercel.json) serves index.html with a 200
                // for missing files, so an HTML response means the manual is
                // absent from the build — fail instead of rendering it.
                const contentType = response.headers.get('content-type') ?? '';
                if (!response.ok || contentType.includes('text/html')) {
                    throw new Error(`Could not load ${MANUAL_PATHS[locale]}`);
                }
                return response.text();
            })
            .then(text => marked.parse(text))
            .then(html => {
                if (!cancelled) setManuals(prev => ({ ...prev, [locale]: html }));
            })
            .catch(err => {
                console.error(err);
                if (!cancelled) setFailedLocale(locale);
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, locale, manualContent]);

    const isLoading = isOpen && manualContent === undefined && failedLocale !== locale;

    const title = (
        <span className="flex items-center">
            <BookOpenIcon className="h-6 w-6 mr-3 text-sky-400" />
            {t('userManual')}
        </span>
    );

    const footer = (
        <button
            onClick={onClose}
            className="bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-sky-700 transition-colors duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500"
        >
            {t('close')}
        </button>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={footer}
            maxWidth="max-w-4xl"
        >
            {isLoading && <div className="flex justify-center items-center h-48"><Spinner /></div>}
            {failedLocale === locale && <div className="text-red-400 text-center p-4">{t('manualLoadFailed')}</div>}
            {manualContent && (
                <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: manualContent }}
                />
            )}
        </BaseModal>
    );
};

export default ManualModal;
