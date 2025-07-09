import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FolderItem, FileSystemItem, FileSystemResponse, ApiResponse } from '@/lib/types';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const RENDERED_DIR = path.join(UPLOADS_DIR, 'rendered');

// Fonction utilitaire pour s'assurer que les dossiers existent
async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
  }
}

// Fonction pour lister les éléments d'un dossier
async function listDirectoryItems(dirPath: string): Promise<FileSystemItem[]> {
  try {
    const items: FileSystemItem[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Ignorer les fichiers/dossiers qui commencent par un point (fichiers cachés)
      if (entry.name.startsWith('.')) {
        continue;
      }
      
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(UPLOADS_DIR, fullPath);
      const stats = await fs.stat(fullPath);
      
      if (entry.isDirectory()) {
        // Compter les éléments dans le dossier (en excluant aussi les fichiers cachés)
        const subEntries = await fs.readdir(fullPath);
        const visibleItemCount = subEntries.filter(name => !name.startsWith('.')).length;
        
        items.push({
          id: uuidv4(),
          name: entry.name,
          type: 'folder',
          path: relativePath,
          createdAt: stats.birthtime,
          parentPath: path.relative(UPLOADS_DIR, dirPath) || undefined,
          itemCount: visibleItemCount
        });
      } else {
        // C'est un fichier
        items.push({
          id: uuidv4(),
          name: entry.name,
          type: 'file',
          path: relativePath,
          createdAt: stats.birthtime,
          parentPath: path.relative(UPLOADS_DIR, dirPath) || undefined
        });
      }
    }
    
    return items.sort((a, b) => {
      // Dossiers en premier, puis fichiers
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch (error) {
    console.error('Error listing directory:', error);
    return [];
  }
}

// GET - Lister les éléments d'un dossier
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path') || '';
    
    // Sécurité : s'assurer que le chemin est dans le dossier uploads
    const requestedPath = path.join(UPLOADS_DIR, folderPath);
    const normalizedPath = path.normalize(requestedPath);
    
    if (!normalizedPath.startsWith(UPLOADS_DIR)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    // S'assurer que le dossier existe
    await ensureDirectoryExists(normalizedPath);
    
    const items = await listDirectoryItems(normalizedPath);
    
    const response: FileSystemResponse = {
      items,
      currentPath: folderPath,
      parentPath: folderPath ? path.dirname(folderPath) : undefined,
      totalItems: items.length
    };
    
    return NextResponse.json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error in GET /api/folders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Créer un nouveau dossier
export async function POST(request: NextRequest) {
  try {
    const { folderName, parentPath } = await request.json();
    
    if (!folderName || !folderName.trim()) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      );
    }
    
    // Nettoyer le nom du dossier
    const cleanFolderName = folderName.trim().replace(/[^a-zA-Z0-9-_\s]/g, '');
    
    if (!cleanFolderName) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder name' },
        { status: 400 }
      );
    }
    
    const targetPath = path.join(UPLOADS_DIR, parentPath || '', cleanFolderName);
    const normalizedPath = path.normalize(targetPath);
    
    // Sécurité : s'assurer que le chemin est dans le dossier uploads
    if (!normalizedPath.startsWith(UPLOADS_DIR)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    // Vérifier si le dossier existe déjà
    try {
      await fs.access(normalizedPath);
      return NextResponse.json(
        { success: false, error: 'Folder already exists' },
        { status: 409 }
      );
    } catch {
      // Le dossier n'existe pas, on peut le créer
    }
    
    // Créer le dossier
    await fs.mkdir(normalizedPath, { recursive: true });
    
    const stats = await fs.stat(normalizedPath);
    const relativePath = path.relative(UPLOADS_DIR, normalizedPath);
    
    const folderItem: FolderItem = {
      id: uuidv4(),
      name: cleanFolderName,
      path: relativePath,
      createdAt: stats.birthtime,
      parentPath: parentPath || undefined,
      itemCount: 0
    };
    
    return NextResponse.json({
      success: true,
      data: folderItem,
      message: 'Folder created successfully'
    });
    
  } catch (error) {
    console.error('Error in POST /api/folders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un dossier
export async function DELETE(request: NextRequest) {
  try {
    const { folderPath } = await request.json();
    
    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: 'Folder path is required' },
        { status: 400 }
      );
    }
    
    const targetPath = path.join(UPLOADS_DIR, folderPath);
    const normalizedPath = path.normalize(targetPath);
    
    // Sécurité : s'assurer que le chemin est dans le dossier uploads
    if (!normalizedPath.startsWith(UPLOADS_DIR)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    // Vérifier si le dossier existe
    try {
      const stats = await fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { success: false, error: 'Path is not a directory' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }
    
    // Supprimer le dossier et tout son contenu
    await fs.rm(normalizedPath, { recursive: true, force: true });
    
    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully'
    });
    
  } catch (error) {
    console.error('Error in DELETE /api/folders:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 