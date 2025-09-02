
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import BaseModal from './BaseModal';

interface PrivacyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();

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
            title={t('viewPrivacyAndDisclaimer')}
            footer={footer}
        >
            <div className="space-y-6">
                <section>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">{t('privacyPolicyTitle')}</h3>
                    <p className="text-slate-300 leading-relaxed">{t('privacyPolicyContent')}</p>
                </section>
                <section>
                    <h3 className="text-lg font-semibold text-slate-200 mb-2">{t('disclaimerTitle')}</h3>
                    <p className="text-slate-300 leading-relaxed">{t('disclaimerContent')}</p>
                </section>
            </div>
        </BaseModal>
    );
};

export default PrivacyModal;
