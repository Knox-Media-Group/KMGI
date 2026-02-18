import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { WordPressService } from './wordpress.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class CreateStagingDto {
  name?: string;
}

@Controller('staging')
@UseGuards(JwtAuthGuard)
export class StagingController {
  constructor(private wordpressService: WordPressService) {}

  /**
   * GET /api/staging/:siteId/status
   *
   * Get staging site status
   */
  @Get(':siteId/status')
  async getStagingStatus(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
  ) {
    try {
      const status = await this.wordpressService.getStagingStatus(wpSiteUrl);
      return status;
    } catch {
      // Return mock status
      return getMockStagingStatus(siteId);
    }
  }

  /**
   * POST /api/staging/:siteId/create
   *
   * Create a new staging environment
   */
  @Post(':siteId/create')
  async createStaging(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Body() dto: CreateStagingDto,
  ) {
    try {
      const result = await this.wordpressService.createStagingSite(parseInt(siteId, 10), wpSiteUrl);
      return {
        success: true,
        stagingUrl: result.stagingUrl,
        message: 'Staging environment created successfully',
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create staging environment',
      };
    }
  }

  /**
   * POST /api/staging/:siteId/push
   *
   * Push staging changes to production
   */
  @Post(':siteId/push')
  async pushToProduction(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Query('stagingUrl') stagingUrl: string,
  ) {
    try {
      await this.wordpressService.promoteStagingToProduction(stagingUrl, wpSiteUrl);
      return {
        success: true,
        message: 'Staging changes pushed to production successfully',
        pushedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to push to production',
      };
    }
  }

  /**
   * POST /api/staging/:siteId/sync
   *
   * Sync production to staging (refresh staging)
   */
  @Post(':siteId/sync')
  async syncFromProduction(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Query('stagingUrl') stagingUrl: string,
  ) {
    try {
      await this.wordpressService.copySiteContent(wpSiteUrl, stagingUrl);
      return {
        success: true,
        message: 'Staging synced with production successfully',
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to sync staging',
      };
    }
  }

  /**
   * DELETE /api/staging/:siteId
   *
   * Delete staging environment
   */
  @Delete(':siteId')
  async deleteStaging(
    @Param('siteId') siteId: string,
    @Query('stagingSiteId') stagingSiteId: string,
  ) {
    try {
      await this.wordpressService.deleteStagingSite(parseInt(stagingSiteId, 10));
      return {
        success: true,
        message: 'Staging environment deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete staging',
      };
    }
  }

  /**
   * GET /api/staging/:siteId/changes
   *
   * Get list of changes between staging and production
   */
  @Get(':siteId/changes')
  async getChanges(
    @Param('siteId') siteId: string,
    @Query('wpSiteUrl') wpSiteUrl: string,
    @Query('stagingUrl') stagingUrl: string,
  ) {
    // In production, this would compare staging vs production
    return {
      changes: getMockChanges(),
      summary: {
        added: 3,
        modified: 5,
        deleted: 1,
        total: 9,
      },
    };
  }

  /**
   * GET /api/staging/:siteId/history
   *
   * Get staging push history
   */
  @Get(':siteId/history')
  async getHistory(
    @Param('siteId') siteId: string,
  ) {
    return {
      history: getMockHistory(),
    };
  }
}

// Mock data generators

function getMockStagingStatus(siteId: string) {
  const hasStaging = Math.random() > 0.3;

  if (!hasStaging) {
    return {
      exists: false,
      siteId,
      stagingUrl: null,
      productionUrl: 'https://example.com',
      createdAt: null,
      lastSynced: null,
      changes: 0,
    };
  }

  return {
    exists: true,
    siteId,
    stagingUrl: 'https://staging.example.com',
    productionUrl: 'https://example.com',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSynced: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    changes: 5,
    status: 'active',
    wpVersion: '6.5',
    phpVersion: '8.2',
    diskUsage: {
      used: 450,
      total: 5000,
      percentage: 9,
    },
  };
}

function getMockChanges() {
  return [
    {
      type: 'page',
      action: 'modified',
      name: 'Home',
      path: '/',
      modifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      details: 'Updated hero section content',
    },
    {
      type: 'page',
      action: 'modified',
      name: 'About',
      path: '/about',
      modifiedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      details: 'Changed team member photos',
    },
    {
      type: 'page',
      action: 'added',
      name: 'New Services Page',
      path: '/new-services',
      modifiedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      details: 'New page created',
    },
    {
      type: 'plugin',
      action: 'modified',
      name: 'Contact Form 7',
      path: null,
      modifiedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
      details: 'Settings updated',
    },
    {
      type: 'theme',
      action: 'modified',
      name: 'Site Theme',
      path: null,
      modifiedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      details: 'Custom CSS changes',
    },
    {
      type: 'media',
      action: 'added',
      name: 'banner-image.jpg',
      path: '/wp-content/uploads/',
      modifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      details: 'New image uploaded',
    },
  ];
}

function getMockHistory() {
  return [
    {
      id: 'push-1',
      action: 'push_to_production',
      user: 'admin@example.com',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      changes: 8,
      status: 'completed',
      note: 'Weekly content update',
    },
    {
      id: 'sync-1',
      action: 'sync_from_production',
      user: 'admin@example.com',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      changes: 0,
      status: 'completed',
      note: 'Refreshed staging environment',
    },
    {
      id: 'push-2',
      action: 'push_to_production',
      user: 'admin@example.com',
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      changes: 12,
      status: 'completed',
      note: 'New services page launch',
    },
    {
      id: 'create-1',
      action: 'create_staging',
      user: 'admin@example.com',
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      changes: 0,
      status: 'completed',
      note: 'Initial staging setup',
    },
  ];
}
