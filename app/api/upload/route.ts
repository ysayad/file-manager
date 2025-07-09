import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Configuration pour les timeouts - augmenté pour les très gros fichiers
export const maxDuration = 3600; // 60 minutes

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetPath = formData.get('targetPath') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validation des types de fichiers
    const allowedTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm',
      'video/x-msvideo', 'video/quicktime', 'video/x-matroska',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: `File type not supported. Allowed types: ${allowedTypes.join(', ')}` 
      }, { status: 400 });
    }

    // Déterminer le dossier de destination
    const destinationDir = targetPath 
      ? path.join(UPLOAD_DIR, targetPath)
      : UPLOAD_DIR;

    // Sécurité : s'assurer que le chemin de destination est dans le dossier uploads
    const normalizedDestination = path.normalize(destinationDir);
    if (!normalizedDestination.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ 
        error: 'Invalid target path' 
      }, { status: 400 });
    }

    // Créer le dossier de destination s'il n'existe pas
    await mkdir(normalizedDestination, { recursive: true });

    // Générer un nom de fichier unique
    const fileId = uuidv4();
    const fileExtension = path.extname(file.name);
    const fileName = `${fileId}${fileExtension}`;
    const filePath = path.join(normalizedDestination, fileName);

    // Upload en streaming pour éviter le chargement en mémoire
    const stream = file.stream();
    const writeStream = createWriteStream(filePath);

    let uploadedBytes = 0;
    const totalBytes = file.size;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        writeStream.destroy();
        reject(new Error('Upload timeout'));
      }, 60 * 60 * 1000); // 60 minutes timeout

      writeStream.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Write stream error:', error);
        reject(error);
      });

      writeStream.on('finish', () => {
        clearTimeout(timeout);
        
        // Calculer le chemin relatif par rapport au dossier uploads
        const relativePath = path.relative(UPLOAD_DIR, filePath);

        const uploadedFile = {
          id: fileId,
          filename: file.name,
          path: relativePath,
          size: file.size,
          type: file.type,
          uploadedAt: new Date()
        };

        resolve(NextResponse.json({
          success: true,
          file: uploadedFile
        }));
      });

      // Pipe the stream avec gestion d'erreur
      const reader = stream.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              writeStream.end();
              break;
            }
            
            uploadedBytes += value.length;
            
            // Écrire le chunk
            if (!writeStream.write(value)) {
              // Attendre que le buffer soit drainé
              await new Promise(resolve => writeStream.once('drain', resolve));
            }
          }
        } catch (error) {
          clearTimeout(timeout);
          writeStream.destroy();
          reject(error);
        }
      };

      pump();
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Upload timeout. Please try again or check your connection.' }, 
          { status: 408 }
        );
      }
      if (error.message.includes('ENOSPC')) {
        return NextResponse.json(
          { error: 'Not enough disk space' }, 
          { status: 507 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to upload file' }, 
      { status: 500 }
    );
  }
} 