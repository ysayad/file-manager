import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Fonction utilitaire pour formater les tailles de fichiers
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Fonction utilitaire pour valider les types de fichiers
export function isValidFileType(fileType: string): boolean {
  const allowedTypes = [
    'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm',
    'video/x-msvideo', 'video/quicktime', 'video/x-matroska',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf'
  ];
  
  return allowedTypes.includes(fileType);
}

// Constantes pour les timeouts
export const UPLOAD_TIMEOUT = 60 * 60 * 1000; // 60 minutes
