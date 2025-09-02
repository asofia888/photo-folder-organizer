import React from 'react';
import { ProcessingProgress } from '../utils/fileSystemUtils';
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface ProgressModalProps {
  isOpen: boolean;
  progress: ProcessingProgress;
  onClose: () => void;
  onCancel?: () => void;
}

const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  progress,
  onClose,
  onCancel
}) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  const progressPercentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const getStatusText = () => {
    switch (progress.status) {
      case 'preparing':
        return t('preparing');
      case 'creating':
        return t('creatingFolders');
      case 'moving':
        return t('movingFiles');
      case 'completed':
        return t('completed');
      case 'error':
        return t('error');
      default:
        return '';
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircleIcon className="h-8 w-8 text-green-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />;
      default:
        return <ArrowPathIcon className="h-8 w-8 text-sky-400 animate-spin" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-4">
          {getStatusIcon()}
        </div>

        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            {progress.status === 'completed' ? t('organizationComplete') : t('organizingPhotos')}
          </h3>
          
          <p className="text-sm text-slate-400 mb-4">
            {getStatusText()}
          </p>

          {progress.currentFile && progress.status !== 'completed' && (
            <p className="text-xs text-slate-500 truncate">
              {progress.currentFile}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        {progress.status !== 'completed' && progress.status !== 'error' && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>{progress.current} / {progress.total}</span>
              <span>{progressPercentage}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-sky-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {progress.status === 'error' && progress.error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{progress.error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          {progress.status === 'completed' || progress.status === 'error' ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              {t('close')}
            </button>
          ) : (
            <>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                >
                  {t('cancel')}
                </button>
              )}
              <button
                disabled
                className="px-4 py-2 bg-sky-600/50 text-white rounded-lg cursor-not-allowed"
              >
                {t('processing')}...
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;