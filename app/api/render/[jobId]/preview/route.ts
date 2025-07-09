import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { renderService } from '@/lib/render-queue'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = await params
    
    // Vérifier si le job existe et s'il est terminé
    const job = await renderService.getJob(jobId)
    if (!job || job.status !== 'completed') {
      // Retourner le placeholder si le job n'est pas terminé
      const placeholderPath = path.join(process.cwd(), 'public', 'placeholder.svg')
      
      try {
        const placeholderBuffer = await fs.readFile(placeholderPath)
        return new NextResponse(placeholderBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=60', // Cache plus court pour les jobs non terminés
          },
        })
      } catch (placeholderError) {
        return NextResponse.json({ error: 'Preview not available' }, { status: 404 })
      }
    }
    
    // Chemin vers le fichier de preview (généré automatiquement par le service de rendu)
    const previewPath = path.join(process.cwd(), 'uploads', 'rendered', `${jobId}_preview.jpg`)
    
    // Vérifier si le fichier de preview existe
    try {
      await fs.access(previewPath)
      
      // Lire le fichier de preview
      const fileBuffer = await fs.readFile(previewPath)
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600', // Cache pendant 1 heure
        },
      })
    } catch (error) {
      // Si le fichier de preview n'existe pas, retourner une image placeholder
      const placeholderPath = path.join(process.cwd(), 'public', 'placeholder.svg')
      
      try {
        const placeholderBuffer = await fs.readFile(placeholderPath)
        return new NextResponse(placeholderBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      } catch (placeholderError) {
        // Si même le placeholder n'existe pas, retourner une réponse 404
        return NextResponse.json({ error: 'Preview not found' }, { status: 404 })
      }
    }
  } catch (error) {
    console.error('Error serving preview:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 