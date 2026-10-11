import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppError, ErrorSeverity, errorHandler } from '../utils/errorHandler';
import { useLanguage } from '../contexts/LanguageContext';
import { ExclamationTriangleIcon, XMarkIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface ErrorNotificationProps {
  error: AppError;
  onDismiss: () => void;
}

// Dark surface with a severity-colored accent, matching the rest of the UI.
const SEVERITY_STYLES: Record<ErrorSeverity, { container: string; icon: string }> = {
  [ErrorSeverity.LOW]: { container: 'border-sky-500', icon: 'text-sky-400' },
  [ErrorSeverity.MEDIUM]: { container: 'border-amber-500', icon: 'text-amber-400' },
  [ErrorSeverity.HIGH]: { container: 'border-orange-500', icon: 'text-orange-400' },
  [ErrorSeverity.CRITICAL]: { container: 'border-red-500', icon: 'text-red-400' },
};

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ error, onDismiss }) => {
  const { t } = useLanguage();
  const [showDetails, setShowDetails] = useState(false);
  const styles = SEVERITY_STYLES[error.severity];

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('default', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  return (
    <div
      role="alert"
      className={`border-l-4 p-4 rounded-r-md shadow-lg bg-slate-800 text-slate-100 ring-1 ring-slate-700 ${styles.container}`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className={`h-5 w-5 mr-2 ${styles.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium">
                {error.userMessage}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {formatTimestamp(error.timestamp)}
              </p>
            </div>

            <div className="flex items-center space-x-2 ml-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                title={showDetails ? t('errorHideDetails') : t('errorShowDetails')}
              >
                {showDetails ? (
                  <>
                    <ChevronUpIcon className="h-3 w-3 mr-1" />
                    {t('errorHideDetails')}
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="h-3 w-3 mr-1" />
                    {t('errorShowDetails')}
                  </>
                )}
              </button>

              <button
                onClick={onDismiss}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition-colors"
                title={t('errorDismiss')}
                aria-label={t('errorDismiss')}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          </div>

          {showDetails && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <dl className="text-xs space-y-1 text-slate-300">
                <div className="flex">
                  <dt className="font-medium w-16">Type:</dt>
                  <dd className="font-mono">{error.type}</dd>
                </div>
                <div className="flex">
                  <dt className="font-medium w-16">ID:</dt>
                  <dd className="font-mono text-xs">{error.id}</dd>
                </div>
                <div className="flex">
                  <dt className="font-medium w-16">Severity:</dt>
                  <dd>{error.severity}</dd>
                </div>
                {error.context && Object.keys(error.context).length > 0 && (
                  <div>
                    <dt className="font-medium">Context:</dt>
                    <dd className="mt-1">
                      <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto">
                        {JSON.stringify(error.context, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
                {error.originalError && (
                  <div>
                    <dt className="font-medium">Technical Details:</dt>
                    <dd className="mt-1">
                      <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto">
                        {error.originalError.message}
                      </pre>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Container for managing multiple notifications
interface ErrorNotificationContainerProps {
  maxNotifications?: number;
}

const AUTO_DISMISS_MS = 5000;

export const ErrorNotificationContainer: React.FC<ErrorNotificationContainerProps> = ({
  maxNotifications = 3
}) => {
  const [errors, setErrors] = useState<AppError[]>([]);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    const unsubscribe = errorHandler.onError((error) => {
      setErrors(prev => [error, ...prev.slice(0, maxNotifications - 1)]);

      // Low severity notifications are informational; let them go away.
      if (error.severity === ErrorSeverity.LOW) {
        const timer = setTimeout(() => {
          pending.delete(timer);
          setErrors(prev => prev.filter(e => e.id !== error.id));
        }, AUTO_DISMISS_MS);
        pending.add(timer);
      }
    });

    return () => {
      unsubscribe();
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, [maxNotifications]);

  const handleDismiss = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 space-y-2">
      {errors.map(error => (
        <ErrorNotification
          key={error.id}
          error={error}
          onDismiss={() => handleDismiss(error.id)}
        />
      ))}
    </div>
  );
};

export default ErrorNotification;
