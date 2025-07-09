import { useState, useEffect, useCallback } from 'react';
import { RenderJob, UploadFile, FileSystemItem, FileSystemResponse, SelectionState, BulkAction, BreadcrumbItem, FolderItem } from '@/lib/types';

export function useRenderJobs() {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Nouveaux états pour la gestion des dossiers et sélection
  const [fileSystemItems, setFileSystemItems] = useState<FileSystemItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [selection, setSelection] = useState<SelectionState>({
    selectedItems: new Set(),
    allSelected: false,
    partialSelected: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Construire les breadcrumbs à partir du chemin actuel
  const buildBreadcrumbs = useCallback((path: string): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [
      { name: 'Accueil', path: '' }
    ];
    
    if (path) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';
      
      parts.forEach((part, index) => {
        currentPath += (index > 0 ? '/' : '') + part;
        breadcrumbs.push({
          name: part,
          path: currentPath
        });
      });
    }
    
    return breadcrumbs;
  }, []);

  // Charger les éléments du système de fichiers pour un dossier
  const loadFileSystemItems = useCallback(async (path: string = '') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/folders?path=${encodeURIComponent(path)}`);
      if (response.ok) {
        const data = await response.json();
        const fsData: FileSystemResponse = data.data;
        
        setFileSystemItems(fsData.items);
        setCurrentPath(fsData.currentPath);
        setBreadcrumbs(buildBreadcrumbs(fsData.currentPath));
        
        // Réinitialiser la sélection lors du changement de dossier
        setSelection({
          selectedItems: new Set(),
          allSelected: false,
          partialSelected: false
        });
      }
    } catch (error) {
      console.error('Failed to load file system items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [buildBreadcrumbs]);

  // Charger les jobs existants
  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/render');
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  }, []);

  // Naviguer vers un dossier
  const navigateToFolder = useCallback(async (path: string) => {
    await loadFileSystemItems(path);
  }, [loadFileSystemItems]);

  // Créer un nouveau dossier
  const createFolder = useCallback(async (folderName: string, parentPath?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          folderName,
          parentPath: parentPath || currentPath
        }),
      });

      if (response.ok) {
        await loadFileSystemItems(currentPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create folder:', error);
      return false;
    }
  }, [currentPath, loadFileSystemItems]);

  // Gestion de la sélection multiple
  const toggleItemSelection = useCallback((itemId: string) => {
    setSelection(prev => {
      const newSelected = new Set(prev.selectedItems);
      
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      
      const totalItems = fileSystemItems.length;
      const selectedCount = newSelected.size;
      
      return {
        selectedItems: newSelected,
        allSelected: selectedCount === totalItems && totalItems > 0,
        partialSelected: selectedCount > 0 && selectedCount < totalItems
      };
    });
  }, [fileSystemItems.length]);

  const selectAll = useCallback(() => {
    setSelection(prev => {
      const allSelected = !prev.allSelected;
      const newSelected = allSelected 
        ? new Set(fileSystemItems.map(item => item.id))
        : new Set<string>();
      
      return {
        selectedItems: newSelected,
        allSelected,
        partialSelected: false
      };
    });
  }, [fileSystemItems]);

  const clearSelection = useCallback(() => {
    setSelection({
      selectedItems: new Set(),
      allSelected: false,
      partialSelected: false
    });
  }, []);

  // Actions groupées
  const performBulkAction = useCallback(async (action: BulkAction['type']): Promise<boolean> => {
    if (selection.selectedItems.size === 0) return false;
    
    const selectedPaths = Array.from(selection.selectedItems).map(id => {
      const item = fileSystemItems.find(item => item.id === id);
      return item?.path || '';
    }).filter(Boolean);
    
    if (selectedPaths.length === 0) return false;
    
    try {
      const response = await fetch('/api/bulk-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          items: selectedPaths
        }),
      });

      if (action === 'download') {
        // Pour le téléchargement, traiter la réponse comme un fichier
        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `download_${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          return true;
        }
      } else if (action === 'delete') {
        // Pour la suppression, recharger la liste
        if (response.ok) {
          await loadFileSystemItems(currentPath);
          clearSelection();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Failed to perform bulk action:', error);
      return false;
    }
  }, [selection.selectedItems, fileSystemItems, currentPath, loadFileSystemItems, clearSelection]);

  // Télécharger un dossier comme zip
  const downloadFolder = useCallback(async (folderPath: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/bulk-actions?path=${encodeURIComponent(folderPath)}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderPath.split('/').pop()}_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to download folder:', error);
      return false;
    }
  }, []);

  // Supprimer un dossier
  const deleteFolder = useCallback(async (folderPath: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/folders', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderPath }),
      });

      if (response.ok) {
        await loadFileSystemItems(currentPath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete folder:', error);
      return false;
    }
  }, [currentPath, loadFileSystemItems]);

  // Upload d'un fichier
  const uploadFile = useCallback(async (file: File, targetPath?: string): Promise<UploadFile | null> => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (targetPath) {
        formData.append('targetPath', targetPath);
      } else if (currentPath) {
        formData.append('targetPath', currentPath);
      }

      // Simulation du progrès d'upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      
      // Recharger la liste après l'upload
      await loadFileSystemItems(currentPath);
      
      return data.file;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [currentPath, loadFileSystemItems]);

  // Lancer un job de rendu
  const startRenderJob = useCallback(async (
    filePath: string, 
    filename: string, 
    renderCommand: string
  ): Promise<string | null> => {
    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          filename,
          renderCommand,
          parentFolderPath: currentPath
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start render job');
      }

      const data = await response.json();
      
      // Recharger les jobs
      await fetchJobs();
      
      return data.jobId;
    } catch (error) {
      console.error('Failed to start render job:', error);
      return null;
    }
  }, [currentPath, fetchJobs]);

  // Upload et lancement du rendu en une fois
  const uploadAndRender = useCallback(async (
    file: File, 
    renderCommand: string
  ): Promise<string | null> => {
    const uploadedFile = await uploadFile(file);
    if (!uploadedFile) return null;

    return await startRenderJob(
      uploadedFile.path, 
      uploadedFile.filename, 
      renderCommand
    );
  }, [uploadFile, startRenderJob]);

  // Supprimer un job
  const deleteJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/render', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jobId }),
      });

      if (response.ok) {
        await fetchJobs();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete job:', error);
      return false;
    }
  }, [fetchJobs]);

  // Nettoyer les jobs orphelins
  const cleanupOrphanedJobs = useCallback(async (): Promise<number> => {
    try {
      const response = await fetch('/api/render', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup' }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchJobs();
        return data.cleanedCount || 0;
      }
      return 0;
    } catch (error) {
      console.error('Failed to cleanup orphaned jobs:', error);
      return 0;
    }
  }, [fetchJobs]);

  // Charger les données au montage du composant
  useEffect(() => {
    fetchJobs();
    loadFileSystemItems('');
    
    // Polling pour mettre à jour les jobs
    const interval = setInterval(fetchJobs, 2000);
    
    return () => clearInterval(interval);
  }, [fetchJobs, loadFileSystemItems]);

  return {
    // États existants
    jobs,
    uploading,
    uploadProgress,
    
    // Nouveaux états
    fileSystemItems,
    currentPath,
    breadcrumbs,
    selection,
    isLoading,
    
    // Fonctions existantes
    uploadFile,
    startRenderJob,
    uploadAndRender,
    refreshJobs: fetchJobs,
    deleteJob,
    cleanupOrphanedJobs,
    
    // Nouvelles fonctions
    navigateToFolder,
    createFolder,
    deleteFolder,
    downloadFolder,
    toggleItemSelection,
    selectAll,
    clearSelection,
    performBulkAction,
    loadFileSystemItems
  };
} 