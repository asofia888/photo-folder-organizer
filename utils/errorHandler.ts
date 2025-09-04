/**
 * Centralized error handling system for photo folder organizer
 */

import { analytics } from './analytics';

export enum ErrorType {
  // File System Errors
  FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND', 
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_FORMAT = 'INVALID_FILE_FORMAT',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Processing Errors
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  EXIF_READ_ERROR = 'EXIF_READ_ERROR',
  WORKER_ERROR = 'WORKER_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Network/API Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  
  // UI/Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  USER_INPUT_ERROR = 'USER_INPUT_ERROR',
  
  // System Errors
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  FEATURE_NOT_SUPPORTED = 'FEATURE_NOT_SUPPORTED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',        // Informational, doesn't block workflow
  MEDIUM = 'medium',  // Affects functionality but recoverable
  HIGH = 'high',      // Blocks current operation
  CRITICAL = 'critical' // Breaks the entire app
}

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  timestamp: Date;
  context?: Record<string, any>;
  originalError?: Error;
  stack?: string;
  canRetry?: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export interface ErrorRecoveryStrategy {
  canRecover: boolean;
  recoveryAction?: () => Promise<void>;
  recoveryMessage?: string;
  fallbackAction?: () => Promise<void>;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHistory: AppError[] = [];
  private errorListeners: Array<(error: AppError) => void> = [];
  private recoveryStrategies = new Map<ErrorType, ErrorRecoveryStrategy>();

  private constructor() {
    this.setupGlobalErrorHandling();
    this.setupDefaultRecoveryStrategies();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private setupGlobalErrorHandling(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, {
        type: ErrorType.UNKNOWN_ERROR,
        severity: ErrorSeverity.HIGH,
        context: { unhandledPromise: true }
      });
    });
  }

  private setupDefaultRecoveryStrategies(): void {
    // Memory error recovery
    this.recoveryStrategies.set(ErrorType.MEMORY_ERROR, {
      canRecover: true,
      recoveryAction: async () => {
        const memoryManager = (await import('./memoryManager')).default.getInstance();
        memoryManager.cleanup();
        await new Promise(resolve => setTimeout(resolve, 1000));
      },
      recoveryMessage: 'Cleaning up memory and retrying...'
    });

    // File access recovery
    this.recoveryStrategies.set(ErrorType.FILE_ACCESS_DENIED, {
      canRecover: true,
      recoveryMessage: 'Please check file permissions and try again'
    });

    // Worker error recovery
    this.recoveryStrategies.set(ErrorType.WORKER_ERROR, {
      canRecover: true,
      recoveryAction: async () => {
        // Restart worker
        await new Promise(resolve => setTimeout(resolve, 500));
      },
      recoveryMessage: 'Restarting background processor...'
    });
  }

  createError(
    originalError: Error | string,
    options: {
      type: ErrorType;
      severity: ErrorSeverity;
      context?: Record<string, any>;
      canRetry?: boolean;
      maxRetries?: number;
    }
  ): AppError {
    const error: AppError = {
      id: this.generateErrorId(),
      type: options.type,
      severity: options.severity,
      message: originalError instanceof Error ? originalError.message : String(originalError),
      userMessage: this.getUserFriendlyMessage(options.type, originalError),
      timestamp: new Date(),
      context: options.context,
      originalError: originalError instanceof Error ? originalError : undefined,
      stack: originalError instanceof Error ? originalError.stack : new Error().stack,
      canRetry: options.canRetry ?? this.canRetryError(options.type),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.getDefaultMaxRetries(options.type)
    };

    return error;
  }

  handleError(
    originalError: Error | string,
    options: {
      type: ErrorType;
      severity: ErrorSeverity;
      context?: Record<string, any>;
      canRetry?: boolean;
      maxRetries?: number;
    }
  ): AppError {
    const error = this.createError(originalError, options);
    
    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > 100) {
      this.errorHistory = this.errorHistory.slice(-50); // Keep last 50 errors
    }

    // Log error
    this.logError(error);

    // Report to analytics
    this.reportError(error);

    // Notify listeners
    this.notifyListeners(error);

    return error;
  }

  async attemptRecovery(error: AppError): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(error.type);
    
    if (!strategy?.canRecover || !error.canRetry) {
      return false;
    }

    if (error.retryCount >= (error.maxRetries || 0)) {
      console.warn(`Max retries exceeded for error ${error.id}`);
      return false;
    }

    try {
      error.retryCount = (error.retryCount || 0) + 1;
      
      if (strategy.recoveryAction) {
        await strategy.recoveryAction();
      }
      
      return true;
    } catch (recoveryError) {
      console.error('Recovery failed:', recoveryError);
      return false;
    }
  }

  private getUserFriendlyMessage(type: ErrorType, originalError: Error | string): string {
    const errorMap: Record<ErrorType, string> = {
      [ErrorType.FILE_ACCESS_DENIED]: 'Unable to access file. Please check permissions.',
      [ErrorType.FILE_NOT_FOUND]: 'File not found. It may have been moved or deleted.',
      [ErrorType.FILE_TOO_LARGE]: 'File is too large to process. Consider using smaller images.',
      [ErrorType.INVALID_FILE_FORMAT]: 'Unsupported file format. Please use JPEG, PNG, or HEIC images.',
      [ErrorType.DIRECTORY_NOT_FOUND]: 'Folder not found. Please select a valid folder.',
      [ErrorType.PERMISSION_DENIED]: 'Permission denied. Please grant necessary permissions.',
      [ErrorType.PROCESSING_FAILED]: 'Failed to process images. Please try again.',
      [ErrorType.EXIF_READ_ERROR]: 'Unable to read image metadata. Image may be corrupted.',
      [ErrorType.WORKER_ERROR]: 'Background processing failed. Restarting...',
      [ErrorType.MEMORY_ERROR]: 'Insufficient memory. Try processing fewer files at once.',
      [ErrorType.TIMEOUT_ERROR]: 'Operation timed out. Try with fewer files or smaller images.',
      [ErrorType.NETWORK_ERROR]: 'Network connection failed. Please check your connection.',
      [ErrorType.API_ERROR]: 'Service temporarily unavailable. Please try again later.',
      [ErrorType.VALIDATION_ERROR]: 'Invalid input. Please check your data and try again.',
      [ErrorType.USER_INPUT_ERROR]: 'Invalid input provided.',
      [ErrorType.BROWSER_NOT_SUPPORTED]: 'Your browser is not supported. Please use Chrome, Firefox, or Safari.',
      [ErrorType.FEATURE_NOT_SUPPORTED]: 'This feature is not available in your browser.',
      [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    };

    return errorMap[type] || 'An unknown error occurred.';
  }

  private canRetryError(type: ErrorType): boolean {
    const retryableErrors = [
      ErrorType.PROCESSING_FAILED,
      ErrorType.WORKER_ERROR,
      ErrorType.MEMORY_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.NETWORK_ERROR,
      ErrorType.API_ERROR,
      ErrorType.EXIF_READ_ERROR
    ];
    
    return retryableErrors.includes(type);
  }

  private getDefaultMaxRetries(type: ErrorType): number {
    const retryMap: Record<ErrorType, number> = {
      [ErrorType.MEMORY_ERROR]: 2,
      [ErrorType.WORKER_ERROR]: 3,
      [ErrorType.PROCESSING_FAILED]: 2,
      [ErrorType.NETWORK_ERROR]: 3,
      [ErrorType.API_ERROR]: 3,
      [ErrorType.TIMEOUT_ERROR]: 2,
      [ErrorType.EXIF_READ_ERROR]: 1
    };
    
    return retryMap[type] || 1;
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type}] ${error.message}`;
    
    console[logLevel](logMessage, {
      id: error.id,
      severity: error.severity,
      context: error.context,
      stack: error.stack
    });
  }

  private getLogLevel(severity: ErrorSeverity): 'info' | 'warn' | 'error' {
    switch (severity) {
      case ErrorSeverity.LOW: return 'info';
      case ErrorSeverity.MEDIUM: return 'warn';
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL: return 'error';
    }
  }

  private reportError(error: AppError): void {
    try {
      // Report to analytics with detailed information
      analytics.trackError(error.type, error.message, {
        severity: error.severity,
        canRetry: error.canRetry,
        retryCount: error.retryCount,
        timestamp: error.timestamp.toISOString(),
        errorId: error.id,
        userAgent: navigator.userAgent,
        url: window.location.href,
        ...error.context
      });

      // Send critical errors to external service (if configured)
      if (error.severity === ErrorSeverity.CRITICAL) {
        this.reportCriticalError(error);
      }
    } catch (reportingError) {
      console.error('Failed to report error to analytics:', reportingError);
    }
  }

  private async reportCriticalError(error: AppError): Promise<void> {
    // This could be configured to send to external error reporting service
    // For now, we'll just log it prominently
    console.error('CRITICAL ERROR DETECTED:', {
      id: error.id,
      type: error.type,
      message: error.message,
      timestamp: error.timestamp,
      stack: error.stack,
      context: error.context,
      userAgent: navigator.userAgent,
      url: window.location.href
    });
    
    // Could also show prominent user notification
    this.emitCriticalErrorEvent(error);
  }

  private emitCriticalErrorEvent(error: AppError): void {
    const event = new CustomEvent('critical-error', {
      detail: error
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
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

  generateErrorReport(): {
    summary: {
      total: number;
      byType: Record<ErrorType, number>;
      bySeverity: Record<ErrorSeverity, number>;
      recentErrors: AppError[];
    };
    systemInfo: {
      userAgent: string;
      url: string;
      timestamp: string;
      memoryUsage?: number;
    };
    recommendations: string[];
  } {
    const stats = this.getErrorStats();
    
    // Generate recommendations based on error patterns
    const recommendations: string[] = [];
    
    if (stats.byType[ErrorType.MEMORY_ERROR] > 2) {
      recommendations.push('Consider processing fewer files at once or using smaller images');
    }
    
    if (stats.byType[ErrorType.FILE_ACCESS_DENIED] > 1) {
      recommendations.push('Check file permissions and browser security settings');
    }
    
    if (stats.byType[ErrorType.BROWSER_NOT_SUPPORTED] > 0) {
      recommendations.push('Switch to a supported browser (Chrome, Firefox, Safari)');
    }
    
    if (stats.bySeverity[ErrorSeverity.CRITICAL] > 0) {
      recommendations.push('Please report this issue to support');
    }
    
    const memoryInfo = (performance as any)?.memory;
    
    return {
      summary: stats,
      systemInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        memoryUsage: memoryInfo?.usedJSHeapSize
      },
      recommendations
    };
  }

  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recentErrors: AppError[];
  } {
    const byType = {} as Record<ErrorType, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    
    this.errorHistory.forEach(error => {
      byType[error.type] = (byType[error.type] || 0) + 1;
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    });

    return {
      total: this.errorHistory.length,
      byType,
      bySeverity,
      recentErrors: this.errorHistory.slice(-10)
    };
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const createError = (
  error: Error | string,
  type: ErrorType,
  severity: ErrorSeverity,
  context?: Record<string, any>
) => errorHandler.createError(error, { type, severity, context });

export const handleError = (
  error: Error | string,
  type: ErrorType,
  severity: ErrorSeverity,
  context?: Record<string, any>
) => errorHandler.handleError(error, { type, severity, context });

export const attemptRecovery = (error: AppError) => errorHandler.attemptRecovery(error);