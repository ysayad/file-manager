export interface RenderJob {
  id: string;
  filename: string;
  originalPath: string;
  outputPath?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  renderCommand?: string;
  // Ajout du chemin du dossier parent
  parentFolderPath?: string;
  metadata?: {
    duration?: number;
    fileSize?: number;
    format?: string;
  };
}

export interface UploadFile {
  id: string;
  filename: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

export interface RenderProgress {
  jobId: string;
  progress: number;
  stage: string;
  eta?: number;
}

// Nouveaux types pour la gestion des dossiers
export interface FolderItem {
  id: string;
  name: string;
  path: string;
  createdAt: Date;
  parentPath?: string;
  itemCount?: number; // Nombre d'éléments dans le dossier
}

// Interface commune pour les éléments du système de fichiers
export interface FileSystemItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  createdAt: Date;
  parentPath?: string;
  // Spécifique aux fichiers
  renderJob?: RenderJob;
  // Spécifique aux dossiers
  itemCount?: number;
}

// Types pour la sélection multiple
export interface SelectionState {
  selectedItems: Set<string>;
  allSelected: boolean;
  partialSelected: boolean;
}

export interface BulkAction {
  type: 'download' | 'delete' | 'move';
  items: string[];
  targetPath?: string; // Pour l'action move
}

// Type pour la navigation
export interface BreadcrumbItem {
  name: string;
  path: string;
}

// Type pour les réponses API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface FileSystemResponse {
  items: FileSystemItem[];
  currentPath: string;
  parentPath?: string;
  totalItems: number;
} 