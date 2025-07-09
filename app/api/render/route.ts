import { NextRequest, NextResponse } from 'next/server';
import { renderService } from '@/lib/render-queue';

export async function POST(request: NextRequest) {
  try {
    const { filePath, filename, renderCommand } = await request.json();

    if (!filePath || !filename || !renderCommand) {
      return NextResponse.json({
        error: 'Missing required fields: filePath, filename, renderCommand'
      }, { status: 400 });
    }

    // Ajouter le job à la queue
    const jobId = await renderService.addRenderJob(
      filename,
      filePath,
      renderCommand
    );

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Render job queued successfully'
    });

  } catch (error) {
    console.error('Render job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create render job' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const jobs = await renderService.getAllJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const success = await renderService.deleteJob(jobId);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Job deleted successfully' 
      });
    } else {
      return NextResponse.json(
        { error: 'Job not found or could not be deleted' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Delete job error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'cleanup') {
      const cleanedCount = await renderService.cleanupOrphanedJobs();
      return NextResponse.json({ 
        success: true, 
        message: `Cleaned up ${cleanedCount} orphaned jobs`,
        cleanedCount 
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup jobs' },
      { status: 500 }
    );
  }
} 