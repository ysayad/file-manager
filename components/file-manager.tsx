"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Search, Upload, Zap, LayoutGrid, Clock, CheckCircle, XCircle, Loader2, Download, Trash2, RefreshCw, FolderPlus, Folder, File, ChevronRight, Home, ArrowLeft } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import React from "react"
import { useState, useRef, useMemo } from "react"
import { useRenderJobs } from "@/hooks/use-render-jobs"
import { RenderJob, FileSystemItem, BreadcrumbItem } from "@/lib/types"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  active?: boolean
}

function NavItem({ href, icon, children, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg", active && "bg-gray-100")}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

// Composant Breadcrumb pour la navigation
function BreadcrumbNavigation({ breadcrumbs, onNavigate }: { breadcrumbs: BreadcrumbItem[], onNavigate: (path: string) => void }) {
  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      {breadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path}>
          <button
            onClick={() => onNavigate(crumb.path)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors",
              index === breadcrumbs.length - 1 ? "text-gray-900 font-medium" : "text-gray-600 hover:text-gray-900"
            )}
          >
            {index === 0 && <Home className="h-4 w-4" />}
            {crumb.name}
          </button>
          {index < breadcrumbs.length - 1 && (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

// Composant pour créer un nouveau dossier
function CreateFolderDialog({ onCreateFolder }: { onCreateFolder: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [folderName, setFolderName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (folderName.trim()) {
      onCreateFolder(folderName.trim())
      setFolderName('')
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un nouveau dossier</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="folderName">Nom du dossier</Label>
            <Input
              id="folderName"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Entrez le nom du dossier"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!folderName.trim()}>
              Créer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour les actions groupées
function BulkActionsBar({ 
  selection, 
  onSelectAll, 
  onClearSelection, 
  onDownloadSelected, 
  onDeleteSelected 
}: {
  selection: any
  onSelectAll: () => void
  onClearSelection: () => void
  onDownloadSelected: () => void
  onDeleteSelected: () => void
}) {
  const selectedCount = selection.selectedItems.size

  if (selectedCount === 0) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={selection.allSelected}
            ref={React.createRef()}
            onCheckedChange={onSelectAll}
            className="data-[state=indeterminate]:bg-blue-600"
          />
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} élément{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownloadSelected}
            className="gap-1"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer les éléments sélectionnés</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer {selectedCount} élément{selectedCount > 1 ? 's' : ''} ?
                  Cette action ne peut pas être annulée.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onDeleteSelected}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            Désélectionner tout
          </Button>
        </div>
      </div>
    </div>
  )
}

function truncateFilename(filename: string, maxLength: number = 20): string {
  if (filename.length <= maxLength) return filename;
  
  const extension = filename.split('.').pop();
  const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.'));
  const truncatedName = nameWithoutExtension.substring(0, maxLength - 3 - (extension?.length || 0));
  
  return `${truncatedName}...${extension}`;
}

function getStatusIcon(status: RenderJob['status']) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />
  }
}

function getStatusColor(status: RenderJob['status']) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'processing':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
  }
}

function FileCard({ job, onDelete }: { job: RenderJob; onDelete: (jobId: string) => void }) {
  const truncatedTitle = truncateFilename(job.filename);
  
  const downloadRenderedFile = async () => {
    if (!job.outputPath) return

    try {
      const response = await fetch(`/api/download/${job.id}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rendered_${job.filename}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  // Calculer la durée du processus
  const getDuration = () => {
    if (job.startedAt && job.completedAt) {
      const duration = Math.round(
        (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000
      );
      return `${duration}s`;
    }
    return null;
  }

  // Obtenir la preview de la vidéo rendue
  const getPreviewSrc = () => {
    if (job.status === 'completed' && job.outputPath) {
      // Essayer d'obtenir une preview via l'API
      return `/api/render/${job.id}/preview`;
    }
    return "/placeholder.svg";
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white">
      <div className="aspect-[4/3] overflow-hidden relative">
        <Image
          src={getPreviewSrc()}
          alt={job.filename}
          width={400}
          height={300}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
        
        {/* Status overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-2">
          {getStatusIcon(job.status)}
          <Badge variant="outline" className={cn("text-xs", getStatusColor(job.status))}>
            {job.status}
          </Badge>
        </div>

        {/* Progress bar for processing jobs */}
        {job.status === 'processing' && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
            <div className="flex justify-between text-xs text-white mb-1">
              <span>Traitement...</span>
              <span>{job.progress}%</span>
            </div>
            <Progress value={job.progress} className="h-1" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-medium text-gray-900 flex-1" title={job.filename}>
            {truncatedTitle}
          </h3>
          <div className="flex gap-1">
            {job.status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={downloadRenderedFile}
                className="gap-1"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer le rendu</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer le rendu "{job.filename}" ?
                    Cette action supprimera définitivement le fichier rendu et ne peut pas être annulée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(job.id)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-1 text-sm text-gray-500">
          <div className="flex items-center justify-between">
            <span>Lancé:</span>
            <span>{formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
          </div>
          
          {getDuration() && (
            <div className="flex items-center justify-between">
              <span>Durée:</span>
              <span>{getDuration()}</span>
            </div>
          )}

          {job.status === 'completed' && (
            <div className="flex items-center justify-between text-green-600">
              <span>Statut:</span>
              <span>✅ Terminé</span>
            </div>
          )}

          {job.status === 'failed' && job.error && (
            <div className="text-red-600 text-xs bg-red-50 p-2 rounded mt-2">
              Erreur: {job.error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Composant pour les éléments du système de fichiers (fichiers et dossiers)
function FileSystemCard({ 
  item, 
  isSelected, 
  onToggleSelection, 
  onNavigate, 
  onDelete, 
  onDownloadFolder,
  renderJob 
}: { 
  item: FileSystemItem
  isSelected: boolean
  onToggleSelection: (itemId: string) => void
  onNavigate: (path: string) => void
  onDelete: (itemPath: string) => void
  onDownloadFolder: (folderPath: string) => void
  renderJob?: RenderJob
}) {
  const truncatedTitle = truncateFilename(item.name);
  
  const handleDoubleClick = () => {
    if (item.type === 'folder') {
      onNavigate(item.path)
    }
  }

  const handleDownload = async () => {
    if (item.type === 'folder') {
      onDownloadFolder(item.path)
    } else if (renderJob?.status === 'completed') {
      // Télécharger le fichier rendu
      try {
        const response = await fetch(`/api/download/${renderJob.id}`)
        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `rendered_${item.name}`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      } catch (error) {
        console.error('Download failed:', error)
      }
    }
  }

  const getPreviewSrc = () => {
    if (item.type === 'folder') {
      return "/placeholder.svg"
    }
    
    if (renderJob?.status === 'completed' && renderJob.outputPath) {
      return `/api/render/${renderJob.id}/preview`
    }
    return "/placeholder.svg"
  }

  return (
    <div 
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white cursor-pointer",
        isSelected && "ring-2 ring-blue-500"
      )}
      onDoubleClick={handleDoubleClick}
    >
      {/* Checkbox de sélection */}
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(item.id)}
          className="bg-white border-gray-300 data-[state=checked]:bg-blue-600"
        />
      </div>

      <div className="aspect-[4/3] overflow-hidden relative">
        <div className="h-full w-full flex items-center justify-center bg-gray-50">
          {item.type === 'folder' ? (
            <div className="text-center">
              <Folder className="h-16 w-16 text-blue-500 mx-auto mb-2" />
              <span className="text-sm text-gray-600">{item.itemCount || 0} élément(s)</span>
            </div>
          ) : (
            <Image
              src={getPreviewSrc()}
              alt={item.name}
              width={400}
              height={300}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          )}
        </div>
        
        {/* Status overlay pour les fichiers avec rendu */}
        {renderJob && (
          <div className="absolute top-2 right-2 flex items-center gap-2">
            {getStatusIcon(renderJob.status)}
            <Badge variant="outline" className={cn("text-xs", getStatusColor(renderJob.status))}>
              {renderJob.status}
            </Badge>
          </div>
        )}

        {/* Progress bar pour les rendus en cours */}
        {renderJob?.status === 'processing' && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-2">
            <div className="flex justify-between text-xs text-white mb-1">
              <span>Traitement...</span>
              <span>{renderJob.progress}%</span>
            </div>
            <Progress value={renderJob.progress} className="h-1" />
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            {item.type === 'folder' ? (
              <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
            ) : (
              <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
            )}
            <h3 className="font-medium text-gray-900 flex-1" title={item.name}>
              {truncatedTitle}
            </h3>
          </div>
          <div className="flex gap-1">
            {(item.type === 'folder' || (renderJob?.status === 'completed')) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownload}
                className="gap-1"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer {item.type === 'folder' ? 'le dossier' : 'le fichier'}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir supprimer {item.type === 'folder' ? 'le dossier' : 'le fichier'} "{item.name}" ?
                    Cette action ne peut pas être annulée.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(item.path)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-1 text-sm text-gray-500">
          <div className="flex items-center justify-between">
            <span>Créé:</span>
            <span>{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
          </div>
          
          {renderJob && (
            <>
              {renderJob.startedAt && renderJob.completedAt && (
                <div className="flex items-center justify-between">
                  <span>Durée:</span>
                  <span>{Math.round((new Date(renderJob.completedAt).getTime() - new Date(renderJob.startedAt).getTime()) / 1000)}s</span>
                </div>
              )}

              {renderJob.status === 'completed' && (
                <div className="flex items-center justify-between text-green-600">
                  <span>Statut:</span>
                  <span>✅ Terminé</span>
                </div>
              )}

              {renderJob.status === 'failed' && renderJob.error && (
                <div className="text-red-600 text-xs bg-red-50 p-2 rounded mt-2">
                  Erreur: {renderJob.error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function FileManager() {
  const { 
    jobs, 
    uploading, 
    uploadProgress, 
    uploadAndRender, 
    refreshJobs, 
    deleteJob, 
    cleanupOrphanedJobs,
    fileSystemItems,
    currentPath,
    breadcrumbs,
    selection,
    isLoading,
    navigateToFolder,
    createFolder,
    deleteFolder,
    downloadFolder,
    toggleItemSelection,
    selectAll,
    clearSelection,
    performBulkAction
  } = useRenderJobs()
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [renderCommand, setRenderCommand] = useState("ffmpeg -i {input} -vf scale=1280:720 -c:v h264_videotoolbox -b:v 2M {output}")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("files")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filter items based on active tab and search query
  const filteredItems = useMemo(() => {
    let filtered = [...fileSystemItems];

    // Filter by tab
    switch (activeTab) {
      case "folders":
        filtered = filtered.filter(item => item.type === 'folder');
        break;
      case "renders":
        filtered = filtered.filter(item => {
          if (item.type === 'file') {
            const job = jobs.find(j => j.originalPath.includes(item.name));
            return job?.status === 'completed';
          }
          return false;
        });
        break;
      case "processing":
        filtered = filtered.filter(item => {
          if (item.type === 'file') {
            const job = jobs.find(j => j.originalPath.includes(item.name));
            return job?.status === 'processing' || job?.status === 'pending';
          }
          return false;
        });
        break;
      case "files":
      default:
        // Show all items, sorted by type (folders first) then by name
        filtered = filtered.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        break;
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  }, [fileSystemItems, activeTab, searchQuery, jobs]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const jobId = await uploadAndRender(file, renderCommand)
      if (jobId) {
        toast.success(`Rendu démarré pour ${file.name}`)
        setUploadDialogOpen(false)
      } else {
        toast.error("Impossible de démarrer le rendu")
      }
    } catch (error) {
      toast.error("Échec de l'upload")
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileUpload = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteJob = async (jobId: string) => {
    try {
      const success = await deleteJob(jobId)
      if (success) {
        toast.success("Rendu supprimé avec succès")
      } else {
        toast.error("Échec de la suppression du rendu")
      }
    } catch (error) {
      toast.error("Échec de la suppression du rendu")
    }
  }

  const handleCleanupOrphanedJobs = async () => {
    try {
      const cleanedCount = await cleanupOrphanedJobs()
      if (cleanedCount > 0) {
        toast.success(`${cleanedCount} rendu(s) orphelin(s) supprimé(s)`)
      } else {
        toast.info("Aucun rendu orphelin trouvé")
      }
    } catch (error) {
      toast.error("Échec du nettoyage")
    }
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r bg-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">Alienware Render</h1>
        </div>
        <nav className="space-y-1 px-2">
          <NavItem href="#" icon={<LayoutGrid className="h-4 w-4" />} active>
            Tous les fichiers
          </NavItem>
          <NavItem href="#" icon={<Zap className="h-4 w-4" />}>
            Rendus GPU
          </NavItem>
        </nav>
      </div>

      {/* Main content - Now taking full width */}
      <div className="flex-1">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div className="w-96">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                type="search" 
                placeholder="Rechercher des fichiers..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={refreshJobs}>
              Actualiser
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Nettoyer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Nettoyer les rendus orphelins</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action supprimera tous les rendus dont les fichiers n'existent plus sur le disque.
                    Cela permet de synchroniser l'interface avec l'état réel des fichiers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCleanupOrphanedJobs}>
                    Nettoyer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="h-8 w-6 overflow-hidden rounded-lg">
              <Image
                src="/alienware-logo.svg"
                alt="Alienware Logo"
                width={24}
                height={32}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Breadcrumb Navigation */}
          <BreadcrumbNavigation 
            breadcrumbs={breadcrumbs}
            onNavigate={navigateToFolder}
          />

          {/* Actions Bar */}
          <div className="mb-6 flex items-center gap-4">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload & Render
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload de fichier pour rendu GPU</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="renderCommand">Commande de rendu</Label>
                    <Input
                      id="renderCommand"
                      value={renderCommand}
                      onChange={(e) => setRenderCommand(e.target.value)}
                      placeholder="Entrez votre commande de rendu avec {input} et {output}"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Utilisez {"{input}"} pour le fichier source et {"{output}"} pour la destination
                    </p>
                  </div>
                  
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Upload en cours...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}
                  
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="video/*,image/*,.pdf"
                    />
                    <Button 
                      onClick={triggerFileUpload} 
                      disabled={uploading}
                      className="w-full"
                    >
                      {uploading ? "Upload en cours..." : "Sélectionner un fichier"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            
            <CreateFolderDialog 
              onCreateFolder={async (name) => {
                const success = await createFolder(name)
                if (success) {
                  toast.success("Dossier créé avec succès")
                } else {
                  toast.error("Échec de la création du dossier")
                }
              }}
            />
          </div>

          {/* Bulk Actions Bar */}
          <BulkActionsBar 
            selection={selection}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onDownloadSelected={async () => {
              const success = await performBulkAction('download')
              if (success) {
                toast.success("Téléchargement démarré")
              } else {
                toast.error("Échec du téléchargement")
              }
            }}
            onDeleteSelected={async () => {
              const success = await performBulkAction('delete')
              if (success) {
                toast.success("Éléments supprimés avec succès")
              } else {
                toast.error("Échec de la suppression")
              }
            }}
          />

          {/* Tabs */}
          <div className="mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="files">Tous les fichiers</TabsTrigger>
                <TabsTrigger value="folders">Dossiers</TabsTrigger>
                <TabsTrigger value="renders">Fichiers rendus</TabsTrigger>
                <TabsTrigger value="processing">En cours</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Chargement...</p>
            </div>
          )}

          {/* File System Items Grid */}
          {!isLoading && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredItems.map(item => {
                const renderJob = item.type === 'file' 
                  ? jobs.find(j => j.originalPath.includes(item.name))
                  : undefined;
                
                return (
                  <FileSystemCard 
                    key={item.id}
                    item={item}
                    isSelected={selection.selectedItems.has(item.id)}
                    onToggleSelection={toggleItemSelection}
                    onNavigate={navigateToFolder}
                    onDelete={async (itemPath) => {
                      if (item.type === 'folder') {
                        const success = await deleteFolder(itemPath)
                        if (success) {
                          toast.success("Dossier supprimé avec succès")
                        } else {
                          toast.error("Échec de la suppression du dossier")
                        }
                      } else {
                        // Pour les fichiers, on supprime le job de rendu s'il existe
                        if (renderJob) {
                          const success = await deleteJob(renderJob.id)
                          if (success) {
                            toast.success("Fichier supprimé avec succès")
                          } else {
                            toast.error("Échec de la suppression du fichier")
                          }
                        }
                      }
                    }}
                    onDownloadFolder={async (folderPath) => {
                      const success = await downloadFolder(folderPath)
                      if (success) {
                        toast.success("Téléchargement du dossier démarré")
                      } else {
                        toast.error("Échec du téléchargement du dossier")
                      }
                    }}
                    renderJob={renderJob}
                  />
                )
              })}
              
              {filteredItems.length === 0 && fileSystemItems.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun fichier pour le moment</p>
                  <p className="text-sm">Utilisez le bouton "Upload & Render" pour commencer</p>
                </div>
              )}
              
              {filteredItems.length === 0 && fileSystemItems.length > 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun résultat trouvé</p>
                  <p className="text-sm">Essayez de modifier vos critères de recherche</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 