/**
 * Browser support detection utilities
 */

export interface BrowserSupport {
  supportsFileSystemAccess: boolean;
  supportsWebkitDirectory: boolean;
  browserName: string;
  recommendedMethod: 'drag-drop' | 'file-input' | 'unsupported';
}

/**
 * Detects browser capabilities for file/folder access
 */
export const detectBrowserSupport = (): BrowserSupport => {
  const userAgent = navigator.userAgent;
  
  // Detect browser
  let browserName = 'Unknown';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    browserName = 'Chrome';
  } else if (userAgent.includes('Edg')) {
    browserName = 'Edge';
  } else if (userAgent.includes('Firefox')) {
    browserName = 'Firefox';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browserName = 'Safari';
  }

  // Check FileSystem Access API support (Chrome/Edge)
  const supportsFileSystemAccess = 'showDirectoryPicker' in window;
  
  // Check webkitdirectory support (most browsers)
  const supportsWebkitDirectory = (() => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      return 'webkitdirectory' in input;
    } catch {
      return false;
    }
  })();

  // Determine recommended method
  let recommendedMethod: 'drag-drop' | 'file-input' | 'unsupported' = 'unsupported';
  
  if (supportsFileSystemAccess) {
    recommendedMethod = 'drag-drop';
  } else if (supportsWebkitDirectory) {
    recommendedMethod = 'file-input';
  }

  return {
    supportsFileSystemAccess,
    supportsWebkitDirectory,
    browserName,
    recommendedMethod
  };
};

/**
 * Gets user-friendly browser compatibility message
 */
export const getBrowserCompatibilityMessage = (support: BrowserSupport, locale: string = 'en'): {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
} => {
  const isJapanese = locale === 'ja';

  if (support.recommendedMethod === 'drag-drop') {
    return {
      title: isJapanese ? '完全サポート' : 'Full Support',
      message: isJapanese 
        ? 'お使いのブラウザは全ての機能をサポートしています。フォルダをドラッグ&ドロップしてください。'
        : 'Your browser supports all features. You can drag and drop folders directly.',
      severity: 'info'
    };
  }

  if (support.recommendedMethod === 'file-input') {
    return {
      title: isJapanese ? '限定サポート' : 'Limited Support',
      message: isJapanese
        ? 'ドラッグ&ドロップは利用できませんが、ファイル選択ボタンから複数の画像を選択できます。'
        : 'Drag & drop is not available, but you can select multiple images using the file selection button.',
      severity: 'warning'
    };
  }

  return {
    title: isJapanese ? 'サポートされていません' : 'Not Supported',
    message: isJapanese
      ? `${support.browserName}はサポートされていません。Chrome、Edge、Firefox、または最新のSafariをお使いください。`
      : `${support.browserName} is not supported. Please use Chrome, Edge, Firefox, or recent Safari.`,
    severity: 'error'
  };
};

/**
 * Check if current browser supports drag and drop for directories
 */
export const supportsDragAndDrop = (): boolean => {
  return detectBrowserSupport().supportsFileSystemAccess;
};

/**
 * Check if DataTransferItem.webkitGetAsEntry is available
 */
export const supportsWebkitGetAsEntry = (): boolean => {
  try {
    return 'webkitGetAsEntry' in DataTransferItem.prototype;
  } catch {
    return false;
  }
};