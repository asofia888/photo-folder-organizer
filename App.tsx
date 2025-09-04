
import React, { useState } from 'react';
import FolderOrganizer from './components/FolderOrganizer';
import { PhotoIcon, BookOpenIcon, DocumentTextIcon } from './components/Icons';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import LanguageSwitcher from './components/LanguageSwitcher';
import PrivacyModal from './components/PrivacyModal';
import ManualModal from './components/ManualModal';
import { ErrorNotificationContainer } from './components/ErrorNotification';

const AppContent: React.FC = () => {
    const { t } = useLanguage();
    const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col">
            <header className="sticky top-0 z-40 w-full bg-slate-900/70 backdrop-blur-lg border-b border-slate-700/80">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <img 
                                src="/logo.jpeg" 
                                alt="Photo Folder Organizer Logo" 
                                className="h-8 w-8 rounded object-cover"
                            />
                            <h1 className="ml-3 text-2xl font-bold text-slate-100 tracking-tight">
                                {t('appTitle')}
                            </h1>
                        </div>
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>
            <main className="flex-grow">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                    <FolderOrganizer />
                </div>
            </main>
            <footer className="py-6 text-slate-400 text-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-center gap-y-4 gap-x-8">
                    <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="group flex items-center text-slate-400 hover:text-sky-400 transition-colors"
                    >
                        <BookOpenIcon className="h-5 w-5 mr-2 text-sky-500/70 group-hover:text-sky-500 transition-colors" />
                        <span>{t('userManual')}</span>
                    </button>
                    <button 
                        onClick={() => setIsPrivacyModalOpen(true)}
                        className="group flex items-center text-slate-400 hover:text-sky-400 transition-colors"
                    >
                        <DocumentTextIcon className="h-5 w-5 mr-2 text-violet-500/70 group-hover:text-violet-500 transition-colors" />
                        <span>{t('viewPrivacyAndDisclaimer')}</span>
                    </button>
                </div>
            </footer>
            <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
            <ManualModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />
            <ErrorNotificationContainer />
        </div>
    );
};


const App: React.FC = () => {
    return (
        <LanguageProvider>
            <AppContent />
        </LanguageProvider>
    );
};

export default App;