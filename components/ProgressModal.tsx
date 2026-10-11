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
  const isFinished = progress.status === 'completed' || progress.status === 'cancelled' || progress.status === 'error';
  const { summary } = progress;

  const getTitle = () => {
    switch (progress.status) {
      case 'completed':
        return t('organizationComplete');
      case 'cancelled':
        return t('organizeCancelled');
      case 'error':
        return t('error');
      default:
        return t('organizingPhotos');
    }
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'completed':
        return <CheckCircleIcon className="h-8 w-8 text-green-400" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />;
      case 'cancelled':
        return <ExclamationTriangleIcon className="h-8 w-8 text-amber-400" />;
      default:
        return <ArrowPathIcon className="h-8 w-8 text-sky-400 animate-spin" />;
    }
  };

  // What happened, in sentences. Always says that originals were untouched:
  // the operation only ever copies.
  const getSummaryLines = (): string[] => {
    if (!summary) return [];
    const lines: string[] = [];
    const copied = summary.copied + summary.renamed;
    if (progress.status === 'completed') {
      lines.push(t('organizeSummaryCopied', { count: copied }));
    } else if (copied > 0) {
      lines.push(t('organizeSummaryCopiedBeforeStop', { count: copied }));
    }
    if (summary.alreadyPresent > 0) {
      lines.push(t('organizeSummaryAlreadyPresent', { count: summary.alreadyPresent }));
    }
    if (summary.renamed > 0) {
      lines.push(t('organizeSummaryRenamed', { count: summary.renamed }));
    }
    lines.push(t('organizeOriginalsUntouched'));
    return lines;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-modal-title"
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-6 max-w-md w-full mx-4"
      >
        <div className="flex items-center justify-center mb-4">
          {getStatusIcon()}
        </div>

        <div className="text-center mb-6">
          <h3 id="progress-modal-title" className="text-lg font-semibold text-slate-100 mb-2">
            {getTitle()}
          </h3>

          {!isFinished && (
            <p className="text-sm text-slate-400 mb-4">
              {progress.status === 'preparing' ? t('preparing') : t('copyingFiles')}
            </p>
          )}

          {progress.currentFile && !isFinished && (
            <p className="text-xs text-slate-500 truncate">
              {progress.currentFile}
            </p>
          )}
        </div>

        {!isFinished && (
          <div className="mb-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercentage}>
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

        {progress.status === 'error' && progress.error && (
          <div className="mb-4 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{progress.error}</p>
          </div>
        )}

        {isFinished && getSummaryLines().length > 0 && (
          <ul className="mb-6 space-y-1 text-sm text-slate-300">
            {getSummaryLines().map(line => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end space-x-3">
          {isFinished ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
            >
              {t('close')}
            </button>
          ) : (
            onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
              >
                {t('cancel')}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;
