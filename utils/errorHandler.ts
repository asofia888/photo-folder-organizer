/**
 * Centralized error reporting. Each error gets a translated user-facing
 * message, is logged, kept in a short history, and passed to listeners (the
 * toast container) unless the caller already shows it in its own UI.
 */

import { translate, TranslationKey } from '../i18n';

export enum ErrorType {
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  WORKER_ERROR = 'WORKER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',        // Informational, doesn't block workflow
  MEDIUM = 'medium',  // Affects functionality but recoverable
  HIGH = 'high',      // Blocks current operation
  CRITICAL = 'critical' // Breaks the entire app
}

export type ErrorContext = Record<string, unknown>;

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  timestamp: Date;
  context?: ErrorContext;
  originalError?: Error;
  stack?: string;
}

export interface ErrorOptions {
  type: ErrorType;
  severity: ErrorSeverity;
  context?: ErrorContext;
  // false: record and log only. Use it when the caller already shows the
  // error in its own UI, so the user doesn't also get a toast for it.
  notify?: boolean;
}

// Message texts live in i18n (en/ja) so errors follow the UI language.
const USER_MESSAGE_KEYS: Record<ErrorType, TranslationKey> = {
  [ErrorType.FILE_ACCESS_DENIED]: 'errorFileAccessDenied',
  [ErrorType.PROCESSING_FAILED]: 'errorProcessingFailed',
  [ErrorType.WORKER_ERROR]: 'errorWorkerError',
  [ErrorType.UNKNOWN_ERROR]: 'errorUnknownError'
};

const MAX_HISTORY = 50;

const messageOf = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHistory: AppError[] = [];
  private errorListeners: Array<(error: AppError) => void> = [];

  private constructor() {
    this.setupGlobalErrorHandling();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupGlobalErrorHandling(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      // event.error is null for errors from cross-origin scripts.
      this.handleError(event.error ?? event.message, {
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        context: { unhandledPromise: true }
      });
    });
  }

  createError(originalError: unknown, options: Omit<ErrorOptions, 'notify'>): AppError {
    const isError = originalError instanceof Error;
    return {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      type: options.type,
      severity: options.severity,
      message: messageOf(originalError),
      userMessage: translate(USER_MESSAGE_KEYS[options.type] ?? 'errorUnknownError'),
      timestamp: new Date(),
      context: options.context,
      originalError: isError ? originalError : undefined,
      stack: isError ? originalError.stack : undefined,
    };
  }

  handleError(originalError: unknown, options: ErrorOptions): AppError {
    const error = this.createError(originalError, options);

    this.errorHistory.push(error);
    if (this.errorHistory.length > MAX_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-MAX_HISTORY);
    }

    this.logError(error);

    if (options.notify !== false) {
      this.notifyListeners(error);
    }

    return error;
  }

  private logError(error: AppError): void {
    const logLevel = error.severity === ErrorSeverity.LOW
      ? 'info'
      : error.severity === ErrorSeverity.MEDIUM ? 'warn' : 'error';

    console[logLevel](`[${error.type}] ${error.message}`, {
      id: error.id,
      severity: error.severity,
      context: error.context,
      stack: error.stack
    });
  }

  onError(listener: (error: AppError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error in error listener:', listenerError);
      }
    });
  }

  getErrorHistory(): AppError[] {
    return [...this.errorHistory];
  }

  clearErrorHistory(): void {
    this.errorHistory = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const createError = (
  error: unknown,
  type: ErrorType,
  severity: ErrorSeverity,
  context?: ErrorContext
) => errorHandler.createError(error, { type, severity, context });

export const handleError = (
  error: unknown,
  type: ErrorType,
  severity: ErrorSeverity,
  context?: ErrorContext,
  options?: { notify?: boolean }
) => errorHandler.handleError(error, { type, severity, context, notify: options?.notify });
