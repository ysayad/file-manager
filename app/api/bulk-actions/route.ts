import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { BulkAction, ApiResponse } from '@/lib/types';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Fonction utilitaire pour vérifier si un chemin est valide
function isValidPath(targetPath: string): boolean {
  const normalizedPath = path.normalize(targetPath);
  return normalizedPath.startsWith(UPLOADS_DIR);
}

// Fonction pour créer un fichier zip
async function createZipFromPaths(items: string[], zipName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression maximale
    });

    const chunks: Buffer[] = [];
    
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Ajouter chaque élément au zip
    items.forEach(async (itemPath) => {
      const fullPath = path.join(UPLOADS_DIR, itemPath);
      
      if (!isValidPath(fullPath)) {
        return;
      }

      try {
        const stats = await fs.stat(fullPath);
        
        if (stats.isDirectory()) {
          // Ajouter le dossier entier
          archive.directory(fullPath, path.basename(itemPath));
        } else {
          // Ajouter le fichier
          archive.file(fullPath, { name: path.basename(itemPath) });
        }
      } catch (error) {
        console.error('Error adding item to zip:', error);
      }
    });

    archive.finalize();
  });
}

// Fonction pour supprimer plusieurs éléments
async function deleteMultipleItems(items: string[]): Promise<{ success: number; failed: number; errors: string[] }> {
  const results = { success: 0, failed: 0, errors: [] as string[] };
  
  for (const itemPath of items) {
    try {
      const fullPath = path.join(UPLOADS_DIR, itemPath);
      
      if (!isValidPath(fullPath)) {
        results.failed++;
        results.errors.push(`Invalid path: ${itemPath}`);
        continue;
      }

      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        // Supprimer le dossier récursivement
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        // Supprimer le fichier
        await fs.unlink(fullPath);
      }
      
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push(`Failed to delete ${itemPath}: ${error.message}`);
    }
  }
  
  return results;
}

// POST - Exécuter une action groupée
export async function POST(request: NextRequest) {
  try {
    const { action, items, targetPath }: BulkAction = await request.json();
    
    if (!action || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid request parameters' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'download': {
        // Créer un zip avec tous les éléments sélectionnés
        const zipName = `download_${Date.now()}.zip`;
        
        try {
          const zipBuffer = await createZipFromPaths(items, zipName);
          
          return new NextResponse(zipBuffer, {
            headers: {
              'Content-Type': 'application/zip',
              'Content-Disposition': `attachment; filename="${zipName}"`,
              'Content-Length': zipBuffer.length.toString()
            }
          });
        } catch (error) {
          console.error('Error creating zip:', error);
          return NextResponse.json(
            { success: false, error: 'Failed to create zip file' },
            { status: 500 }
          );
        }
      }

      case 'delete': {
        // Supprimer plusieurs éléments
        const results = await deleteMultipleItems(items);
        
        return NextResponse.json({
          success: true,
          data: results,
          message: `${results.success} item(s) deleted successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}`
        });
      }

      case 'move': {
        // Déplacer plusieurs éléments (à implémenter si nécessaire)
        if (!targetPath) {
          return NextResponse.json(
            { success: false, error: 'Target path is required for move operation' },
            { status: 400 }
          );
        }

        const results = { success: 0, failed: 0, errors: [] as string[] };
        
        for (const itemPath of items) {
          try {
            const sourcePath = path.join(UPLOADS_DIR, itemPath);
            const destPath = path.join(UPLOADS_DIR, targetPath, path.basename(itemPath));
            
            if (!isValidPath(sourcePath) || !isValidPath(destPath)) {
              results.failed++;
              results.errors.push(`Invalid path: ${itemPath}`);
              continue;
            }

            // S'assurer que le dossier de destination existe
            await fs.mkdir(path.dirname(destPath), { recursive: true });
            
            // Déplacer le fichier/dossier
            await fs.rename(sourcePath, destPath);
            results.success++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Failed to move ${itemPath}: ${error.message}`);
          }
        }
        
        return NextResponse.json({
          success: true,
          data: results,
          message: `${results.success} item(s) moved successfully${results.failed > 0 ? `, ${results.failed} failed` : ''}`
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action type' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Error in POST /api/bulk-actions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Télécharger un dossier entier comme zip
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('path');
    
    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: 'Folder path is required' },
        { status: 400 }
      );
    }
    
    const fullPath = path.join(UPLOADS_DIR, folderPath);
    
    if (!isValidPath(fullPath)) {
      return NextResponse.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }
    
    try {
      const stats = await fs.stat(fullPath);
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
    
    const zipName = `${path.basename(folderPath)}_${Date.now()}.zip`;
    const zipBuffer = await createZipFromPaths([folderPath], zipName);
    
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
        'Content-Length': zipBuffer.length.toString()
      }
    });
    
  } catch (error) {
    console.error('Error in GET /api/bulk-actions:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 