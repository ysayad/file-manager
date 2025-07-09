import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const targetPath = formData.get('targetPath') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validation des types de fichiers (adapte selon tes besoins)
    const allowedTypes = [
      'video/mp4', 'video/avi', 'video/mov', 'video/mkv',
      'image/jpeg', 'image/png', 'image/gif',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'File type not supported' 
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

    // Sauvegarder le fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Calculer le chemin relatif par rapport au dossier uploads
    const relativePath = path.relative(UPLOAD_DIR, filePath);

    const uploadedFile = {
      id: fileId,
      filename: file.name,
      path: relativePath, // Chemin relatif pour la cohérence avec les autres APIs
      size: file.size,
      type: file.type,
      uploadedAt: new Date()
    };

    return NextResponse.json({
      success: true,
      file: uploadedFile
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' }, 
      { status: 500 }
    );
  }
} 