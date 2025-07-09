import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import Queue from 'bull';
import Redis from 'ioredis';

import { RenderJob, RenderProgress } from './types';

const execAsync = promisify(exec);

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL);

export const renderQueue = new Queue('render jobs', REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
  },
});

// Cache local pour les jobs
const jobs = new Map<string, RenderJob>();

export class RenderService {
  private static instance: RenderService;
  private progressCallbacks = new Set<(progress: RenderProgress) => void>();

  static getInstance(): RenderService {
    if (!RenderService.instance) {
      RenderService.instance = new RenderService();
    }
    return RenderService.instance;
  }

  constructor() {
    this.initializeQueue();
  }

  private initializeQueue() {
    renderQueue.process(async (job) => {
      const { jobId, inputPath, outputPath, renderCommand, filename } = job.data;
      
      try {
        await this.updateJobViaAPI(jobId, 'processing', 0);
        
        // Execute la commande de rendu GPU
        const result = await this.executeRenderCommand(jobId, renderCommand, inputPath, outputPath, filename);
        
        await this.updateJobViaAPI(jobId, 'completed', 100, { outputPath });
        
        return result;
      } catch (error) {
        await this.updateJobViaAPI(jobId, 'failed', 0, { error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });

    renderQueue.on('progress', (job, progress) => {
      this.notifyProgress({
        jobId: job.data.jobId,
        progress,
        stage: 'Processing...'
      });
    });
  }

  async addRenderJob(
    filename: string, 
    inputPath: string, 
    renderCommand: string
  ): Promise<string> {
    const jobId = uuidv4();
    
    // Construire le chemin absolu vers le fichier d'entrée
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const absoluteInputPath = path.isAbsolute(inputPath) 
      ? inputPath 
      : path.join(uploadsDir, inputPath);
    
    // Construire le chemin de sortie dans le dossier rendered
    const renderedDir = path.join(uploadsDir, 'rendered');
    const outputPath = path.join(renderedDir, `rendered_${filename}`);

    const job: RenderJob = {
      id: jobId,
      filename,
      originalPath: inputPath, // Garder le chemin relatif pour l'affichage
      outputPath,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      renderCommand
    };

    jobs.set(jobId, job);
    
    // Sauvegarde dans Redis
    await this.saveJobToRedis(job);

    // Ajoute le job à la queue avec le chemin absolu
    await renderQueue.add({
      jobId,
      inputPath: absoluteInputPath, // Utiliser le chemin absolu pour ffmpeg
      outputPath,
      filename,
      renderCommand: renderCommand.replace('{input}', absoluteInputPath).replace('{output}', outputPath)
    });

    return jobId;
  }

  private async executeRenderCommand(
    jobId: string, 
    command: string, 
    inputPath: string, 
    outputPath: string,
    filename: string
  ): Promise<void> {
    // Crée le dossier de sortie s'il n'existe pas
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Vérifier que le fichier d'entrée existe
    try {
      await fs.access(inputPath);
    } catch (error) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Remplace les placeholders dans la commande
    const finalCommand = command
      .replace('{input}', `"${inputPath}"`) // Ajouter des guillemets pour gérer les espaces
      .replace('{output}', `"${outputPath}"`);

    console.log(`Executing render command: ${finalCommand}`);

    // Simule le progrès du rendu
    const progressInterval = setInterval(() => {
      const currentJob = jobs.get(jobId);
      if (currentJob && currentJob.status === 'processing') {
        const newProgress = Math.min(currentJob.progress + 10, 90);
        this.updateJobViaAPI(jobId, 'processing', newProgress);
      }
    }, 1000);

    try {
      const { stdout, stderr } = await execAsync(finalCommand);
      clearInterval(progressInterval);
      
      // Finalise le progrès à 100%
      await this.updateJobViaAPI(jobId, 'processing', 100);
      
      if (stderr) {
        console.warn(`Render warning for job ${jobId}:`, stderr);
      }

      // Génère automatiquement une preview après le rendu réussi
      await this.generatePreview(jobId, outputPath);
      
    } catch (error) {
      clearInterval(progressInterval);
      throw new Error(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Nouvelle méthode pour générer des previews (thumbnails)
  private async generatePreview(jobId: string, outputPath: string): Promise<void> {
    try {
      const previewPath = path.join(
        path.dirname(outputPath), 
        `${jobId}_preview.jpg`
      );

      // Commande ffmpeg pour générer une thumbnail à partir de la première frame
      const thumbnailCommand = `ffmpeg -i "${outputPath}" -ss 00:00:01 -vframes 1 -q:v 2 -y "${previewPath}"`;

      await execAsync(thumbnailCommand);
      
      console.log(`Preview generated for job ${jobId}: ${previewPath}`);
    } catch (error) {
      console.error(`Failed to generate preview for job ${jobId}:`, error);
      // Ne pas faire échouer le job si la génération de preview échoue
    }
  }

  // Nouvelle méthode pour mettre à jour via API
  private async updateJobViaAPI(
    jobId: string,
    status: RenderJob['status'],
    progress: number,
    additionalData?: any
  ) {
    // Met à jour le Map local si le job existe
    const job = jobs.get(jobId);
    if (job) {
      job.status = status;
      job.progress = progress;
      
      if (status === 'processing' && !job.startedAt) {
        job.startedAt = new Date();
      }
      
      if (status === 'completed' || status === 'failed') {
        job.completedAt = new Date();
      }

      if (additionalData?.error) {
        job.error = additionalData.error;
      }

      if (additionalData?.outputPath) {
        job.outputPath = additionalData.outputPath;
      }

      jobs.set(jobId, job);
      await this.saveJobToRedis(job);
    } else {
      // Essaye de charger depuis Redis et mettre à jour
      const redisJob = await this.getJobFromRedis(jobId);
      if (redisJob) {
        redisJob.status = status;
        redisJob.progress = progress;
        
        if (status === 'processing' && !redisJob.startedAt) {
          redisJob.startedAt = new Date();
        }
        
        if (status === 'completed' || status === 'failed') {
          redisJob.completedAt = new Date();
        }

        if (additionalData?.error) {
          redisJob.error = additionalData.error;
        }

        if (additionalData?.outputPath) {
          redisJob.outputPath = additionalData.outputPath;
        }
        
        await this.saveJobToRedis(redisJob);
        jobs.set(jobId, redisJob);
      }
    }

    this.notifyProgress({
      jobId,
      progress,
      stage: status
    });
  }

  // Méthodes Redis pour la persistance
  private async saveJobToRedis(job: RenderJob): Promise<void> {
    try {
      await redis.setex(`job:${job.id}`, 3600, JSON.stringify({
        ...job,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      }));
    } catch (error) {
      console.error(`Failed to save job ${job.id} to Redis:`, error);
    }
  }

  private async getJobFromRedis(jobId: string): Promise<RenderJob | null> {
    try {
      const jobData = await redis.get(`job:${jobId}`);
      if (!jobData) return null;
      
      const parsed = JSON.parse(jobData);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
      };
    } catch (error) {
      console.error(`Failed to get job ${jobId} from Redis:`, error);
      return null;
    }
  }

  private async getAllJobsFromRedis(): Promise<RenderJob[]> {
    try {
      const keys = await redis.keys('job:*');
      if (keys.length === 0) return [];
      
      const values = await redis.mget(keys);
      const jobs: RenderJob[] = [];
      
      for (const value of values) {
        if (value) {
          try {
            const parsed = JSON.parse(value);
            jobs.push({
              ...parsed,
              createdAt: new Date(parsed.createdAt),
              startedAt: parsed.startedAt ? new Date(parsed.startedAt) : undefined,
              completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
            });
          } catch (parseError) {
            console.error('Failed to parse job from Redis:', parseError);
          }
        }
      }
      
      return jobs.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error('Failed to get all jobs from Redis:', error);
      return [];
    }
  }

  async getJob(jobId: string): Promise<RenderJob | undefined> {
    // Essaie d'abord le cache local
    const localJob = jobs.get(jobId);
    if (localJob) return localJob;
    
    // Puis Redis si nécessaire
    const redisJob = await this.getJobFromRedis(jobId);
    if (redisJob) {
      jobs.set(jobId, redisJob);
      return redisJob;
    }
    
    return undefined;
  }

  async getAllJobs(): Promise<RenderJob[]> {
    // Charge depuis Redis pour les données les plus récentes
    const redisJobs = await this.getAllJobsFromRedis();
    
    // Synchronise avec les fichiers physiques
    const syncedJobs = await this.syncJobsWithFiles(redisJobs);
    
    // Met à jour le cache local
    syncedJobs.forEach(job => jobs.set(job.id, job));
    
    return syncedJobs;
  }

  // Nouvelle méthode pour synchroniser les jobs avec les fichiers physiques
  private async syncJobsWithFiles(jobs: RenderJob[]): Promise<RenderJob[]> {
    const validJobs: RenderJob[] = [];
    
    for (const job of jobs) {
      // Vérifier si le job est terminé et si ses fichiers existent
      if (job.status === 'completed' && job.outputPath) {
        try {
          // Vérifier l'existence du fichier rendu
          await fs.access(job.outputPath);
          
          // Vérifier l'existence du fichier preview
          const previewPath = path.join(
            path.dirname(job.outputPath), 
            `${job.id}_preview.jpg`
          );
          
          try {
            await fs.access(previewPath);
          } catch {
            // Si la preview n'existe pas, la régénérer
            await this.generatePreview(job.id, job.outputPath);
          }
          
          validJobs.push(job);
        } catch (error) {
          // Le fichier n'existe pas, supprimer le job de Redis
          console.log(`Cleaning up orphaned job ${job.id}: ${job.filename}`);
          await this.deleteJobFromRedis(job.id);
        }
      } else {
        // Pour les jobs non terminés, les garder
        validJobs.push(job);
      }
    }
    
    return validJobs;
  }

  // Méthode pour supprimer un job de Redis
  private async deleteJobFromRedis(jobId: string): Promise<void> {
    try {
      await redis.del(`job:${jobId}`);
      jobs.delete(jobId);
      console.log(`Job ${jobId} deleted from Redis`);
    } catch (error) {
      console.error(`Failed to delete job ${jobId} from Redis:`, error);
    }
  }

  // Méthode publique pour supprimer un job manuellement
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId);
      if (!job) return false;

      // Supprimer les fichiers physiques si ils existent
      if (job.outputPath) {
        try {
          await fs.unlink(job.outputPath);
          console.log(`Deleted output file: ${job.outputPath}`);
        } catch (error) {
          console.log(`Output file not found or already deleted: ${job.outputPath}`);
        }
      }

      // Supprimer le fichier preview
      const previewPath = path.join(
        process.cwd(), 
        'uploads', 
        'rendered', 
        `${jobId}_preview.jpg`
      );
      
      try {
        await fs.unlink(previewPath);
        console.log(`Deleted preview file: ${previewPath}`);
      } catch (error) {
        console.log(`Preview file not found or already deleted: ${previewPath}`);
      }

      // Supprimer de Redis et du cache local
      await this.deleteJobFromRedis(jobId);
      
      return true;
    } catch (error) {
      console.error(`Failed to delete job ${jobId}:`, error);
      return false;
    }
  }

  // Méthode pour nettoyer tous les jobs orphelins
  async cleanupOrphanedJobs(): Promise<number> {
    const allJobs = await this.getAllJobsFromRedis();
    let cleanedCount = 0;

    for (const job of allJobs) {
      if (job.status === 'completed' && job.outputPath) {
        try {
          await fs.access(job.outputPath);
        } catch (error) {
          // Le fichier n'existe pas, supprimer le job
          await this.deleteJobFromRedis(job.id);
          cleanedCount++;
        }
      }
    }

    console.log(`Cleaned up ${cleanedCount} orphaned jobs`);
    return cleanedCount;
  }

  onProgress(callback: (progress: RenderProgress) => void) {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  private notifyProgress(progress: RenderProgress) {
    this.progressCallbacks.forEach(callback => callback(progress));
  }
}

export const renderService = RenderService.getInstance(); 