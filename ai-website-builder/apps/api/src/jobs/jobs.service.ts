import { Injectable, NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobType, JobStatus } from '../common/enums';

@Injectable()
export class JobsService {
  private queue: Queue;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const redisHost = this.configService.get('REDIS_HOST') || 'localhost';
    const redisPort = this.configService.get('REDIS_PORT') || 6379;

    this.queue = new Queue('site-jobs', {
      connection: {
        host: redisHost,
        port: Number(redisPort),
      },
    });
  }

  async createJob(siteId: string, type: JobType, metadata?: Record<string, unknown>) {
    // Create job in database
    const job = await this.prisma.job.create({
      data: {
        siteId,
        type,
        status: JobStatus.pending,
        metadata: (metadata || {}) as any,
      },
    });

    // Add to queue
    await this.queue.add(type, {
      jobId: job.id,
      siteId,
      type,
      metadata,
    });

    return job;
  }

  async getJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  async getActiveJobForSite(siteId: string) {
    return this.prisma.job.findFirst({
      where: {
        siteId,
        status: { in: [JobStatus.pending, JobStatus.running] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus, error?: string) {
    return this.prisma.job.update({
      where: { id: jobId },
      data: {
        status,
        error,
        completedAt: status === JobStatus.completed || status === JobStatus.failed ? new Date() : null,
      },
    });
  }

  async addJobLog(jobId: string, message: string) {
    return this.prisma.jobLog.create({
      data: {
        jobId,
        message,
      },
    });
  }
}
