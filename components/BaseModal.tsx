
import React, { useEffect, useRef, ReactNode } from 'react';
import { XMarkIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl';
}

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-2xl' }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            modalRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center p-4 transition-opacity duration-300 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                ref={modalRef}
                className={`bg-slate-800 rounded-xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col animate-scale-in border border-slate-700`}
                onClick={e => e.stopPropagation()}
                tabIndex={-1}
            >
                <div className="flex justify-between items-center p-5 border-b border-slate-700 flex-shrink-0">
                    <div className="text-xl font-bold text-slate-100">{title}</div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full text-slate-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-sky-500"
                        aria-label={t('close')}
                    >
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="p-6 md:p-8 overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="p-4 bg-slate-800/50 border-t border-slate-700 flex justify-end flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BaseModal;
