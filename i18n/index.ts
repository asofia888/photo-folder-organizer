export const translations = {
  en: {
    appTitle: 'Photo Folder Organizer',
    languageLabel: 'Language',
    catchphraseMain: 'Effortless photo organization made simple.',
    catchphraseSub: 'Just drag and drop. Automatically organize scattered folders by date and event. Making your memories easier to find.',
    // FolderOrganizer
    scanningFolder: 'Scanning folder: {folderName}...',
    errorNoSubFolders: 'No sub-folders found in the dropped folder. Please drop a folder that contains other folders of images.',
    errorNoImages: 'No images found in any of the sub-folders.',
    errorOccurred: 'An Error Occurred',
    errorDropFile: 'Please drop a single folder, not files.',
    dropZoneTitle: 'Drag & Drop Your Folder Here',
    dropZoneDescription: 'Drop the main folder containing all the photo folders you want to organize.',
    privacyTitle: 'Privacy First:',
    privacyDescription: 'Your photos are processed locally in your browser and are never uploaded.',
    browserCompatibilityTitle: 'Browser Compatibility:',
    browserCompatibilityNotice: 'This app works on all modern browsers including Firefox and Safari. For direct folder organization (without scripts), Chrome or Edge is recommended. Mobile devices have limited support.',
    resultsTitle: 'Folders Sorted & Ready for Renaming',
    resultsDescription: 'Review thumbnails, name each folder, and use the copy button or download the script below to rename them on your computer.',
    organizeAnother: 'Organize Another Folder',
    renameScriptInstructionsTitle: 'Finish Renaming in One Click',
    renameScriptInstructions: "1. Download the script. 2. Place it inside the main folder you dropped ('{folderName}'). 3. Run it (double-click on Windows, or run `sh rename_folders.sh` in the terminal on Mac/Linux) to rename all folders at once.",
    generateRenameScript: 'Download Rename Script',
    dateRuleTitle: 'Folder Date Priority',
    dateRuleOldest: 'Oldest Date',
    dateRuleNewest: 'Newest Date',
    saveAllChanges: 'Confirm All Names',
    // FolderCard
    unknownDate: 'Unknown_Date',
    dateEstimatedNote: 'These photos have no capture date, so the date is estimated from file modification times.',
    original: 'Original:',
    photoPreview: 'Photo Preview:',
    newFolderNameLabel: 'New Folder Name:',
    newFolderNamePlaceholder: 'e.g., Summer_Vacation',
    folderNameInvalid: 'Folder names cannot contain \\ / : * ? " < > | or end with a period.',
    folderNameDuplicate: 'Another folder would get the same name (same date and name). Please choose a different name.',
    editNameAriaLabel: 'Edit name',
    readyToRename: 'Ready to rename!',
    copied: 'Copied!',
    copyName: 'Copy Name',
    // Modal and Footer
    viewPrivacyAndDisclaimer: 'Privacy Policy & Disclaimer',
    privacyPolicyTitle: 'Privacy Policy',
    privacyPolicyContent: 'This application operates entirely on your local machine. No photos, file names, or other data are ever transmitted or uploaded to any server. All processing is done securely within your browser. Folder names you type are kept in this browser\'s local storage so they can be restored after a reload; they never leave your computer.',
    disclaimerTitle: 'Disclaimer',
    disclaimerContent: "This application is provided 'as is'. The developer is not responsible for any loss or alteration of data that may occur from its use. Please ensure you have backups of your important files before proceeding.",
    close: 'Close',
    previewUnavailable: 'Preview not available for this file.',
    previewNotSupported: 'This browser cannot preview this file format. The file itself is still organized normally.',
    thumbnailLoadFailed: 'Failed to load',
    loadingImage: 'Loading image',
    photoThumbnailAlt: 'Photo thumbnail',
    viewPhotoAriaLabel: 'View photo {name}',
    previousPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    manualLoadFailed: 'Failed to load the user manual.',
    userManual: 'User Manual',
    // File System Operations
    organizeToComputer: 'Copy into Organized Folders',
    organizeToComputerHint: 'Choose a location: folders with the new names are created there and your photos are copied into them. Your original photos are not changed.',
    organizingPhotos: 'Organizing Photos',
    organizationComplete: 'Organization Complete',
    organizeCancelled: 'Cancelled',
    preparing: 'Preparing...',
    copyingFiles: 'Copying photos...',
    error: 'Error',
    cancel: 'Cancel',
    organizeSummaryCopied: '{count} photo(s) copied.',
    organizeSummaryCopiedBeforeStop: '{count} photo(s) were copied before stopping.',
    organizeSummaryAlreadyPresent: '{count} photo(s) were already in the destination and were skipped.',
    organizeSummaryRenamed: '{count} photo(s) were saved with a number added to the name, because a different file with the same name already existed.',
    organizeOriginalsUntouched: 'Your original photos were not changed.',
    organizeErrorPermission: 'Permission to write to the selected folder was denied. Please allow access and try again.',
    organizeErrorInvalidName: '"{name}" cannot be used as a file or folder name.',
    organizeErrorWrite: 'Could not copy "{name}". Check that the destination is writable and has enough free space, then try again.',
    fileSystemNotSupported: 'Direct folder organization requires Chrome or Edge browser.',
    // Error Messages
    errorFileAccessDenied: 'Unable to access file. Please check permissions.',
    errorProcessingFailed: 'Failed to process images. Please try again.',
    errorWorkerError: 'Background processing stopped unexpectedly. Please try again, or try fewer photos at once.',
    errorUnknownError: 'An unexpected error occurred. Please try again.',
    // Error Actions
    errorDismiss: 'Dismiss',
    errorShowDetails: 'Show Details',
    errorHideDetails: 'Hide Details',
    // Folder picker & processing status
    dropZoneClickHint: 'Or click to choose a folder.',
    gatheringFiles: 'Gathering files to process...',
    processingFolderMessage: 'Processing folder {folderProgress} ({fileProgress} files) - {folderName}',
    // Organize to computer
    organizeHintChromeEdge: 'In Chrome or Edge, "Copy into Organized Folders" saves the organized folders directly.',
    // Skipped files
    skippedFilesNotice: '{count} file(s) were skipped and are not included in the results.',
    restoredNamesNotice: 'Restored {count} folder name(s) you entered last time for this folder.',
    restoredNamesKeep: 'Keep',
    restoredNamesDiscard: 'Start over',
    skippedFilesShowDetails: 'Show skipped files',
    skipReasonTooLarge: 'File too large',
    skipReasonUnreadable: 'Could not be read',
  },
  ja: {
    appTitle: '写真フォルダ整理アプリ',
    languageLabel: '言語',
    catchphraseMain: '面倒な写真整理を、シンプルに。',
    catchphraseSub: 'ドラッグ＆ドロップするだけ。散らかったフォルダを日付・イベントごとに自動整理。あなたの思い出が、もっと見つかりやすくなる。',
    // FolderOrganizer
    scanningFolder: 'フォルダをスキャン中: {folderName}...',
    errorNoSubFolders: 'ドロップされたフォルダにサブフォルダが見つかりませんでした。画像の入ったフォルダを含む親フォルダをドロップしてください。',
    errorNoImages: 'どのサブフォルダにも画像が見つかりませんでした。',
    errorOccurred: 'エラーが発生しました',
    errorDropFile: 'ファイルではなく、単一のフォルダをドロップしてください。',
    dropZoneTitle: 'ここにフォルダをドラッグ＆ドロップ',
    dropZoneDescription: '整理したいすべての写真フォルダが入っている親フォルダをドロップしてください。',
    privacyTitle: 'プライバシー第一:',
    privacyDescription: 'あなたの写真はブラウザ内でローカルに処理され、アップロードされることはありません。',
    browserCompatibilityTitle: 'ブラウザの互換性:',
    browserCompatibilityNotice: 'Firefox、Safariを含むすべてのモダンブラウザで動作します。直接フォルダ整理機能（スクリプト不要）はChrome・Edgeで利用可能です。モバイル端末は限定的なサポートです。',
    resultsTitle: 'フォルダがソートされ、名前の変更準備ができました',
    resultsDescription: 'サムネイルを確認し、各フォルダに名前を付け、コピーボタンを使うか、以下のスクリプトをダウンロードしてコンピュータ上で名前を変更できます。',
    organizeAnother: '別のフォルダを整理',
    renameScriptInstructionsTitle: 'ワンクリックで名前変更を完了',
    renameScriptInstructions: "1. スクリプトをダウンロードします。 2. ドロップしたメインフォルダ（'{folderName}'）内に配置します。 3. 実行すると（Windowsではダブルクリック、Mac/Linuxではターミナルで `sh rename_folders.sh` を実行）、すべてのフォルダが一括で名前変更されます。",
    generateRenameScript: 'リネームスクリプトを生成',
    dateRuleTitle: 'フォルダ内の日付優先',
    dateRuleOldest: '最も古い日付',
    dateRuleNewest: '最も新しい日付',
    saveAllChanges: 'すべての名前を確定',
    // FolderCard
    unknownDate: '日付不明',
    dateEstimatedNote: '写真に撮影日の情報がないため、ファイルの更新日時から日付を推定しています。',
    original: '元の名前:',
    photoPreview: '写真プレビュー:',
    newFolderNameLabel: '新しいフォルダ名:',
    newFolderNamePlaceholder: '例: 夏休み',
    folderNameInvalid: 'フォルダ名に \\ / : * ? " < > | は使えません。また、末尾を「.」にすることはできません。',
    folderNameDuplicate: '同じ日付・同じ名前になるフォルダが他にあります。別の名前にしてください。',
    editNameAriaLabel: '名前を編集',
    readyToRename: '名前変更の準備完了！',
    copied: 'コピーしました！',
    copyName: '名前をコピー',
    // Modal and Footer
    viewPrivacyAndDisclaimer: 'プライバシーポリシーと免責事項',
    privacyPolicyTitle: 'プライバシーポリシー',
    privacyPolicyContent: 'このアプリケーションは、お使いのコンピュータ上で完全に動作します。写真、ファイル名、その他のデータがサーバーに送信またはアップロードされることは一切ありません。すべての処理は、お使いのブラウザ内で安全に行われます。入力したフォルダ名は、再読み込み後に復元できるよう、このブラウザのローカルストレージに保存されます（外部に送信されることはありません）。',
    disclaimerTitle: '免責事項',
    disclaimerContent: 'このアプリケーションは「現状有姿」で提供されます。本アプリケーションの使用によって生じたいかなるデータの損失や変更についても、開発者は責任を負いません。続行する前に、重要なファイルのバックアップがあることを確認してください。',
    close: '閉じる',
    previewUnavailable: 'このファイルのプレビューは表示できません。',
    previewNotSupported: 'このブラウザではこの形式のプレビューを表示できません。ファイル自体は通常どおり整理されます。',
    thumbnailLoadFailed: '読み込めません',
    loadingImage: '画像を読み込み中',
    photoThumbnailAlt: '写真のサムネイル',
    viewPhotoAriaLabel: '写真 {name} を表示',
    previousPhoto: '前の写真',
    nextPhoto: '次の写真',
    manualLoadFailed: '使い方マニュアルを読み込めませんでした。',
    userManual: '使い方マニュアル',
    // File System Operations
    organizeToComputer: '整理したフォルダにコピー',
    organizeToComputerHint: '保存先を選ぶと、新しい名前のフォルダを作成して写真をコピーします。元の写真は変更されません。',
    organizingPhotos: '写真を整理中',
    organizationComplete: '整理完了',
    organizeCancelled: 'キャンセルしました',
    preparing: '準備中...',
    copyingFiles: '写真をコピー中...',
    error: 'エラー',
    cancel: 'キャンセル',
    organizeSummaryCopied: '{count} 枚の写真をコピーしました。',
    organizeSummaryCopiedBeforeStop: '中断までに {count} 枚の写真をコピーしました。',
    organizeSummaryAlreadyPresent: '{count} 枚は保存先にすでにあったため、スキップしました。',
    organizeSummaryRenamed: '{count} 枚は、同じ名前の別のファイルがあったため、名前に番号を付けて保存しました。',
    organizeOriginalsUntouched: '元の写真は変更されていません。',
    organizeErrorPermission: '選択したフォルダへの書き込みが許可されませんでした。アクセスを許可して、もう一度お試しください。',
    organizeErrorInvalidName: '「{name}」はファイル名・フォルダ名として使えません。',
    organizeErrorWrite: '「{name}」をコピーできませんでした。保存先に書き込めるか、空き容量が足りているかを確認して、もう一度お試しください。',
    fileSystemNotSupported: '直接フォルダ整理機能にはChrome・Edgeブラウザが必要です。',
    // Error Messages
    errorFileAccessDenied: 'ファイルにアクセスできません。権限を確認してください。',
    errorProcessingFailed: '画像の処理に失敗しました。再試行してください。',
    errorWorkerError: 'バックグラウンド処理が予期せず停止しました。もう一度お試しいただくか、一度に処理する写真を減らしてください。',
    errorUnknownError: '予期しないエラーが発生しました。再試行してください。',
    // Error Actions
    errorDismiss: '閉じる',
    errorShowDetails: '詳細を表示',
    errorHideDetails: '詳細を非表示',
    // Folder picker & processing status
    dropZoneClickHint: 'またはクリックしてフォルダを選択できます。',
    gatheringFiles: '処理するファイルを収集中...',
    processingFolderMessage: 'フォルダを処理中 {folderProgress}（{fileProgress} ファイル）- {folderName}',
    // Organize to computer
    organizeHintChromeEdge: 'Chrome・Edgeなら「整理したフォルダにコピー」で整理済みのフォルダを直接保存できます。',
    // Skipped files
    skippedFilesNotice: '{count} 個のファイルはスキップされたため、結果に含まれていません。',
    restoredNamesNotice: 'このフォルダで前回入力した名前を {count} 件復元しました。',
    restoredNamesKeep: 'このまま使う',
    restoredNamesDiscard: '最初からやり直す',
    skippedFilesShowDetails: 'スキップされたファイルを表示',
    skipReasonTooLarge: 'サイズ超過',
    skipReasonUnreadable: '読み込み失敗',
  }
};

export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export const getInitialLocale = (): Locale => {
  if (typeof window !== 'undefined' && window.navigator) {
    const browserLang = window.navigator.language;
    if (browserLang.toLowerCase().startsWith('ja')) {
      return 'ja';
    }
  }
  return 'en';
};

// LanguageProvider keeps this in sync via setCurrentLocale.
let currentLocale: Locale = getInitialLocale();

export const setCurrentLocale = (locale: Locale): void => {
  currentLocale = locale;
};

export const translate = (
  key: TranslationKey,
  replacements?: { [key: string]: string | number }
): string => {
  let translation: string = translations[currentLocale][key] || translations.en[key];
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      translation = translation.replace(`{${k}}`, String(v));
    });
  }
  return translation;
};