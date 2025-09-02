
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { BookOpenIcon } from './Icons';
import Spinner from './Spinner';
import { marked } from 'marked';
import BaseModal from './BaseModal';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const [manualContent, setManualContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && !manualContent && !isLoading) {
            setIsLoading(true);
            setError('');
            fetch('/MANUAL.md')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Could not load manual.');
                    }
                    return response.text();
                })
                .then(text => {
                    const html = marked.parse(text);
                    setManualContent(html as string);
                })
                .catch(err => {
                    console.error(err);
                    setError('Failed to load user manual.');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen, manualContent, isLoading]);

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
            {error && <div className="text-red-400 text-center p-4">{error}</div>}
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
