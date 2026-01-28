import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  /**
   * GET /api/jobs/:id
   *
   * Get job status and logs
   *
   * Response:
   * {
   *   "id": "...",
   *   "siteId": "...",
   *   "type": "provision",
   *   "status": "running",
   *   "error": null,
   *   "createdAt": "...",
   *   "completedAt": null,
   *   "logs": [
   *     { "id": "...", "message": "Starting provision job", "createdAt": "..." },
   *     { "id": "...", "message": "Provisioning WordPress site...", "createdAt": "..." }
   *   ]
   * }
   */
  @Get(':id')
  async getJob(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }
}
