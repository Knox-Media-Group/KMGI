import { Controller, Get, Param } from '@nestjs/common';
import { TenantsService } from './tenants.service';

@Controller('tenants')
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  /**
   * GET /api/tenants/:slug
   *
   * Public endpoint to get tenant branding for login/signup pages
   *
   * Response:
   * {
   *   "id": "...",
   *   "name": "Demo Builder",
   *   "slug": "demo",
   *   "logoUrl": null,
   *   "primaryColor": "#2563EB"
   * }
   */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.tenantsService.getBySlug(slug);
  }
}
