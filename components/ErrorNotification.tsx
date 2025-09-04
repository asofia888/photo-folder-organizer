import React, { useState, useEffect, useCallback } from 'react';
import { AppError, ErrorSeverity, errorHandler, attemptRecovery } from '../utils/errorHandler';
import { useLanguage } from '../contexts/LanguageContext';
import { ExclamationTriangleIcon, XMarkIcon, ArrowPathIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';

interface ErrorNotificationProps {
  error: AppError;
  onDismiss: () => void;
  onRetry?: () => Promise<void>;
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ error, onDismiss, onRetry }) => {
  const { t } = useLanguage();
  const [isRecovering, setIsRecovering] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [recoveryFailed, setRecoveryFailed] = useState(false);

  const handleRetry = useCallback(async () => {
    if (isRecovering) return;

    setIsRecovering(true);
    setRecoveryFailed(false);

    try {
      // First attempt automatic recovery
      const recovered = await attemptRecovery(error);
      
      if (recovered && onRetry) {
        await onRetry();
        onDismiss(); // Success - dismiss notification
      } else if (onRetry) {
        await onRetry();
        onDismiss(); // Manual retry succeeded
      } else {
        setRecoveryFailed(true);
      }
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      setRecoveryFailed(true);
    } finally {
      setIsRecovering(false);
    }
  }, [error, onRetry, onDismiss, isRecovering]);

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case ErrorSeverity.LOW:
        return 'border-blue-500 bg-blue-50 text-blue-900';
      case ErrorSeverity.MEDIUM:
        return 'border-yellow-500 bg-yellow-50 text-yellow-900';
      case ErrorSeverity.HIGH:
        return 'border-orange-500 bg-orange-50 text-orange-900';
      case ErrorSeverity.CRITICAL:
        return 'border-red-500 bg-red-50 text-red-900';
    }
  };

  const getSeverityIcon = (severity: ErrorSeverity) => {
    const baseClasses = "h-5 w-5 mr-2";
    switch (severity) {
      case ErrorSeverity.LOW:
        return <ExclamationTriangleIcon className={`${baseClasses} text-blue-500`} />;
      case ErrorSeverity.MEDIUM:
        return <ExclamationTriangleIcon className={`${baseClasses} text-yellow-500`} />;
      case ErrorSeverity.HIGH:
        return <ExclamationTriangleIcon className={`${baseClasses} text-orange-500`} />;
      case ErrorSeverity.CRITICAL:
        return <ExclamationTriangleIcon className={`${baseClasses} text-red-500`} />;
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('default', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(timestamp);
  };

  const canRetry = error.canRetry && (!error.maxRetries || error.retryCount < error.maxRetries);
  const maxRetriesExceeded = error.maxRetries && error.retryCount >= error.maxRetries;

  return (
    <div className={`border-l-4 p-4 mb-4 rounded-r-md shadow-sm ${getSeverityColor(error.severity)}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getSeverityIcon(error.severity)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium">
                {error.userMessage}
              </h3>
              <p className="mt-1 text-xs opacity-75">
                {formatTimestamp(error.timestamp)}
                {error.retryCount > 0 && ` • Attempt ${error.retryCount + 1}`}
              </p>
              
              {maxRetriesExceeded && (
                <p className="mt-1 text-xs text-red-600 font-medium">
                  {t('errorMaxRetriesExceeded')}
                </p>
              )}
              
              {recoveryFailed && (
                <p className="mt-1 text-xs text-red-600">
                  {t('errorRecoveryFailed')}
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {canRetry && !maxRetriesExceeded && (
                <button
                  onClick={handleRetry}
                  disabled={isRecovering}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={t('errorRetry')}
                >
                  {isRecovering ? (
                    <>
                      <ArrowPathIcon className="h-3 w-3 mr-1 animate-spin" />
                      {t('errorRecovering')}
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="h-3 w-3 mr-1" />
                      {t('errorRetry')}
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors"
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
                className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border border-current hover:bg-current hover:bg-opacity-10 transition-colors"
                title={t('errorDismiss')}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
          
          {showDetails && (
            <div className="mt-3 pt-3 border-t border-current border-opacity-20">
              <dl className="text-xs space-y-1">
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
                      <pre className="text-xs bg-black bg-opacity-10 p-2 rounded overflow-x-auto">
                        {JSON.stringify(error.context, null, 2)}
                      </pre>
                    </dd>
                  </div>
                )}
                {error.originalError && (
                  <div>
                    <dt className="font-medium">Technical Details:</dt>
                    <dd className="mt-1">
                      <pre className="text-xs bg-black bg-opacity-10 p-2 rounded overflow-x-auto">
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

export const ErrorNotificationContainer: React.FC<ErrorNotificationContainerProps> = ({ 
  maxNotifications = 3 
}) => {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(() => {
    const unsubscribe = errorHandler.onError((error) => {
      setErrors(prev => {
        const newErrors = [error, ...prev.slice(0, maxNotifications - 1)];
        return newErrors;
      });

      // Auto-dismiss low severity errors after 5 seconds
      if (error.severity === ErrorSeverity.LOW) {
        setTimeout(() => {
          setErrors(prev => prev.filter(e => e.id !== error.id));
        }, 5000);
      }
    });

    return unsubscribe;
  }, [maxNotifications]);

  const handleDismiss = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-96 space-y-2">
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