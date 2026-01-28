import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { SitesService } from './sites.service';
import { CreateSiteDto, GenerateDto, SaveDraftDto, RollbackDto } from './sites.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthRequest } from '../auth/auth.types';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private sitesService: SitesService) {}

  /**
   * POST /api/sites
   *
   * Create a new site and start provisioning
   *
   * Request:
   * {
   *   "settings": {
   *     "businessName": "Acme Corp",
   *     "industry": "Technology",
   *     "stylePreset": "modern",
   *     "accentColor": "#2563EB",
   *     "primaryCta": "book",
   *     "contactEmail": "hello@acme.com",
   *     "contactPhone": "+1 555-0123"
   *   }
   * }
   *
   * Response:
   * {
   *   "site": { "id": "...", "name": "Acme Corp", "status": "provisioning", ... },
   *   "jobId": "..."
   * }
   */
  @Post()
  async createSite(@Req() req: AuthRequest, @Body() dto: CreateSiteDto) {
    return this.sitesService.createSite(req.user.userId, req.user.tenantId, dto);
  }

  /**
   * GET /api/sites
   *
   * Get all sites for the current user
   *
   * Response:
   * [
   *   { "id": "...", "name": "...", "status": "published", ... },
   *   ...
   * ]
   */
  @Get()
  async getUserSites(@Req() req: AuthRequest) {
    return this.sitesService.getUserSites(req.user.userId, req.user.tenantId);
  }

  /**
   * GET /api/sites/:id
   *
   * Get site details with versions and active job
   *
   * Response:
   * {
   *   "site": { "id": "...", "name": "...", "status": "draft", "wpSiteUrl": "...", ... },
   *   "currentVersion": { "id": "...", "versionNumber": 3, "pageJson": {...}, ... },
   *   "versions": [ ... ],
   *   "activeJob": { "id": "...", "type": "generate", "status": "running", ... } | null
   * }
   */
  @Get(':id')
  async getSite(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sitesService.getSite(id, req.user.userId);
  }

  /**
   * POST /api/sites/:id/generate
   *
   * Regenerate site content with AI
   *
   * Request (optional):
   * {
   *   "sectionId": "..." // optional: regenerate only this section
   * }
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/generate')
  async generateContent(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: GenerateDto) {
    return this.sitesService.generateContent(id, req.user.userId, dto.sectionId);
  }

  /**
   * PUT /api/sites/:id/draft
   *
   * Save editor changes as a new version
   *
   * Request:
   * {
   *   "pages": [
   *     {
   *       "title": "Home",
   *       "slug": "home",
   *       "sections": [
   *         {
   *           "id": "...",
   *           "type": "hero",
   *           "variant": 1,
   *           "blocks": [
   *             { "id": "...", "type": "text", "props": { "content": "...", "variant": "h1" } },
   *             ...
   *           ]
   *         },
   *         ...
   *       ]
   *     },
   *     ...
   *   ]
   * }
   *
   * Response:
   * {
   *   "version": { "id": "...", "versionNumber": 4, "pageJson": {...}, "createdAt": "..." }
   * }
   */
  @Put(':id/draft')
  async saveDraft(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: SaveDraftDto) {
    return this.sitesService.saveDraft(id, req.user.userId, dto);
  }

  /**
   * POST /api/sites/:id/publish
   *
   * Publish current version to WordPress
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/publish')
  async publish(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.sitesService.publish(id, req.user.userId);
  }

  /**
   * POST /api/sites/:id/rollback
   *
   * Rollback to a previous version
   *
   * Request:
   * {
   *   "versionId": "..."
   * }
   *
   * Response:
   * {
   *   "jobId": "..."
   * }
   */
  @Post(':id/rollback')
  async rollback(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: RollbackDto) {
    return this.sitesService.rollback(id, req.user.userId, dto);
  }
}
