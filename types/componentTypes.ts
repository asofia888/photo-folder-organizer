// Component-specific type definitions for enhanced type safety

import React from 'react';
import {
  Folder,
  Photo,
  FolderId,
  PhotoId,
  ProcessingStatus,
  DateLogic,
  ProcessingProgress,
  NonEmptyString,
  ValidFileName,
  ValidFolderName,
  ComponentWithClassName,
  EventHandler,
  AsyncEventHandler,
  AppError,
  MemoryStats
} from '../types';

// Base component props for consistent typing
export interface BaseComponentProps extends ComponentWithClassName {
  readonly id?: string;
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

// Generic button props with strict event typing
export interface ButtonProps<T = HTMLButtonElement> extends BaseComponentProps {
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline';
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly loading?: boolean;
  readonly icon?: React.ComponentType<{ className?: string }>;
  readonly iconPosition?: 'left' | 'right';
  readonly fullWidth?: boolean;
  readonly onClick?: EventHandler<React.MouseEvent<T>>;
  readonly onFocus?: EventHandler<React.FocusEvent<T>>;
  readonly onBlur?: EventHandler<React.FocusEvent<T>>;
  readonly children?: React.ReactNode;
}

// Input field props with validation
export interface InputProps extends BaseComponentProps {
  readonly type?: 'text' | 'email' | 'password' | 'number' | 'search';
  readonly value?: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly readOnly?: boolean;
  readonly autoComplete?: string;
  readonly autoFocus?: boolean;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly pattern?: string;
  readonly error?: string | null;
  readonly success?: boolean;
  readonly onChange?: EventHandler<React.ChangeEvent<HTMLInputElement>>;
  readonly onKeyDown?: EventHandler<React.KeyboardEvent<HTMLInputElement>>;
  readonly onSubmit?: AsyncEventHandler<React.FormEvent>;
}

// Modal props with strict typing
export interface ModalProps extends BaseComponentProps {
  readonly isOpen: boolean;
  readonly title?: string;
  readonly size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  readonly closeOnOverlayClick?: boolean;
  readonly closeOnEscape?: boolean;
  readonly showCloseButton?: boolean;
  readonly onClose: () => void;
  readonly children?: React.ReactNode;
}

// FolderCard specific props
export interface FolderCardProps extends BaseComponentProps {
  readonly folder: Folder;
  readonly onNameChange: (folderId: string, newName: string) => void;
  readonly onEdit: (folderId: string) => void;
  readonly maxThumbnails?: number;
  readonly showMetadata?: boolean;
  readonly isCompact?: boolean;
  readonly allowRename?: boolean;
}

// Thumbnail component props
export interface ThumbnailProps extends BaseComponentProps {
  readonly photo: Photo;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly lazy?: boolean;
  readonly quality?: 'low' | 'medium' | 'high';
  readonly onClick?: () => void;
  readonly onLoad?: () => void;
  readonly onError?: (error: Error) => void;
  readonly showOverlay?: boolean;
  readonly overlayContent?: React.ReactNode;
}

// ImageModal props
export interface ImageModalProps extends ModalProps {
  readonly photo: Photo | null;
  readonly photos?: readonly Photo[];
  readonly currentIndex?: number;
  readonly showNavigation?: boolean;
  readonly showMetadata?: boolean;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly onPhotoChange?: (photo: Photo, index: number) => void;
}

// Progress Modal props  
export interface ProgressModalProps extends ModalProps {
  readonly progress: ProcessingProgress;
  readonly allowCancel?: boolean;
  readonly onCancel?: () => void;
  readonly showDetails?: boolean;
}

// FolderOrganizer props
export interface FolderOrganizerProps extends BaseComponentProps {
  readonly initialDateLogic?: DateLogic;
  readonly maxFileSize?: number;
  readonly supportedFormats?: readonly string[];
  readonly onProcessingStart?: () => void;
  readonly onProcessingComplete?: (folders: readonly Folder[]) => void;
  readonly onError?: (error: AppError) => void;
}

// FolderProcessor props
export interface FolderProcessorProps extends BaseComponentProps {
  readonly status: ProcessingStatus;
  readonly folders: readonly Folder[];
  readonly error: string | null;
  readonly progress: ProcessingProgress | null;
  readonly onReset: () => void;
  readonly onRetry?: () => void;
}

// ErrorNotification props
export interface ErrorNotificationProps extends BaseComponentProps {
  readonly error: AppError;
  readonly onDismiss: (errorId: string) => void;
  readonly onRetry?: () => Promise<void>;
  readonly showDetails?: boolean;
  readonly autoClose?: boolean;
  readonly position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

// ErrorNotificationContainer props
export interface ErrorNotificationContainerProps extends BaseComponentProps {
  readonly maxNotifications?: number;
  readonly position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  readonly showStackTrace?: boolean;
}

// Spinner props
export interface SpinnerProps extends BaseComponentProps {
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly variant?: 'primary' | 'secondary' | 'white';
  readonly text?: string;
  readonly showText?: boolean;
}

// VirtualScrollGrid props with generic typing
export interface VirtualScrollGridProps<T> extends BaseComponentProps {
  readonly items: readonly T[];
  readonly itemHeight: number;
  readonly containerHeight: number;
  readonly overscan?: number;
  readonly renderItem: (item: T, index: number) => React.ReactElement;
  readonly onScroll?: (scrollTop: number) => void;
  readonly loading?: boolean;
  readonly emptyState?: React.ReactNode;
}

// PerformanceMonitor props
export interface PerformanceMonitorProps extends BaseComponentProps {
  readonly isVisible: boolean;
  readonly updateInterval?: number;
  readonly showMemoryStats?: boolean;
  readonly showFPS?: boolean;
  readonly onToggle: () => void;
  readonly onMemoryWarning?: (stats: MemoryStats) => void;
}

// LanguageSwitcher props
export interface LanguageSwitcherProps extends BaseComponentProps {
  readonly compact?: boolean;
  readonly showFlags?: boolean;
  readonly position?: 'left' | 'center' | 'right';
}

// Generic list component props
export interface ListProps<T> extends BaseComponentProps {
  readonly items: readonly T[];
  readonly renderItem: (item: T, index: number) => React.ReactElement;
  readonly keyExtractor: (item: T, index: number) => string | number;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly emptyState?: React.ReactNode;
  readonly loadingState?: React.ReactNode;
  readonly errorState?: React.ReactNode;
  readonly onRetry?: () => void;
}

// Generic form field props
export interface FormFieldProps extends BaseComponentProps {
  readonly label?: string;
  readonly description?: string;
  readonly error?: string | null;
  readonly success?: boolean;
  readonly required?: boolean;
  readonly children: React.ReactNode;
}

// File drop zone props
export interface DropZoneProps extends BaseComponentProps {
  readonly accept?: readonly string[];
  readonly multiple?: boolean;
  readonly maxFiles?: number;
  readonly maxSize?: number;
  readonly onDrop: (files: FileList | File[]) => void;
  readonly onDropRejected?: (rejectedFiles: File[]) => void;
  readonly onError?: (error: Error) => void;
  readonly disabled?: boolean;
  readonly children?: React.ReactNode;
}

// Context provider props
export interface ProviderProps<T> {
  readonly value: T;
  readonly children: React.ReactNode;
}

// Hook return types for better type inference
export interface UseFolderProcessorReturn {
  readonly status: ProcessingStatus;
  readonly folders: readonly Folder[];
  readonly setFolders: (folders: readonly Folder[] | ((prev: readonly Folder[]) => readonly Folder[])) => void;
  readonly error: string | null;
  readonly processingMessage: string;
  readonly rootFolderName: string;
  readonly progress: ProcessingProgress | null;
  readonly processDirectory: (entry: FileSystemDirectoryEntry, dateLogic: DateLogic) => Promise<void>;
  readonly reset: () => void;
  readonly cleanup: () => void;
  readonly setFailure: (error: string) => void;
}

export interface UseLazyThumbnailsReturn {
  readonly getThumbnailUrl: (file: File) => string;
  readonly preloadThumbnails: (files: readonly File[], maxCount?: number) => void;
  readonly revokeThumbnail: (file: File) => void;
  readonly revokeAllThumbnails: () => void;
  readonly getCacheStats: () => MemoryStats;
}

// Event handler type helpers
export type ClickHandler<T = HTMLElement> = EventHandler<React.MouseEvent<T>>;
export type ChangeHandler<T = HTMLInputElement> = EventHandler<React.ChangeEvent<T>>;
export type SubmitHandler<T = HTMLFormElement> = AsyncEventHandler<React.FormEvent<T>>;
export type KeyboardHandler<T = HTMLElement> = EventHandler<React.KeyboardEvent<T>>;
export type FocusHandler<T = HTMLElement> = EventHandler<React.FocusEvent<T>>;

// Drag and drop event handlers
export type DragHandler<T = HTMLElement> = EventHandler<React.DragEvent<T>>;
export type DropHandler<T = HTMLElement> = EventHandler<React.DragEvent<T>>;

// Generic callback types
export type Callback = () => void;
export type AsyncCallback = () => Promise<void>;
export type CallbackWithValue<T> = (value: T) => void;
export type AsyncCallbackWithValue<T> = (value: T) => Promise<void>;

// Validation and transformation types
export type Validator<T> = (value: T) => boolean;
export type AsyncValidator<T> = (value: T) => Promise<boolean>;
export type Transformer<T, U> = (value: T) => U;
export type AsyncTransformer<T, U> = (value: T) => Promise<U>;

// Component ref types
export type ComponentRef<T> = React.RefObject<T> | React.MutableRefObject<T>;
export type CallbackRef<T> = (instance: T | null) => void;

// Style and theme types
export type CSSVariables = Record<`--${string}`, string | number>;
export type StyleObject = React.CSSProperties & CSSVariables;

// Conditional props based on other props
export type ConditionalProps<T, K extends keyof T> = T[K] extends true 
  ? Required<Pick<T, K>> 
  : Partial<Pick<T, K>>;

// Utility types for component composition
export type PropsWithoutRef<P> = P & React.RefAttributes<never>;
export type PropsWithRef<T, P = {}> = P & React.RefAttributes<T>;

// Higher-order component types
export type HOCProps<P> = P & {
  readonly forwardedRef?: React.Ref<any>;
};

export type WithHOC<P, H = {}> = React.ComponentType<P & H>;