import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService, AnalyticsDashboard, RealTimeData, TopPage, ConversionGoal } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class TrackEventDto {
  name: string;
  category: string;
  value?: number;
  properties?: Record<string, unknown>;
}

class CreateGoalDto {
  name: string;
  type: 'pageview' | 'event' | 'form_submit' | 'click';
  target: string;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * GET /api/analytics/:siteId/dashboard
   *
   * Get full analytics dashboard for a site
   *
   * Query params:
   * - period: '7d' | '30d' | '90d' | '12m' (default: '30d')
   *
   * Response: AnalyticsDashboard
   */
  @Get(':siteId/dashboard')
  async getDashboard(
    @Param('siteId') siteId: string,
    @Query('period') period?: '7d' | '30d' | '90d' | '12m',
  ): Promise<AnalyticsDashboard> {
    return this.analyticsService.getDashboard(siteId, period || '30d');
  }

  /**
   * GET /api/analytics/:siteId/realtime
   *
   * Get real-time visitor data
   *
   * Response:
   * {
   *   "activeVisitors": 15,
   *   "activePages": [...],
   *   "recentEvents": [...]
   * }
   */
  @Get(':siteId/realtime')
  async getRealTime(@Param('siteId') siteId: string): Promise<RealTimeData> {
    return this.analyticsService.getRealTimeData(siteId);
  }

  /**
   * GET /api/analytics/:siteId/page
   *
   * Get analytics for a specific page
   *
   * Query params:
   * - path: The page path (e.g., '/services')
   * - period: '7d' | '30d' | '90d' (default: '30d')
   *
   * Response: TopPage
   */
  @Get(':siteId/page')
  async getPageAnalytics(
    @Param('siteId') siteId: string,
    @Query('path') path: string,
    @Query('period') period?: string,
  ): Promise<TopPage> {
    return this.analyticsService.getPageAnalytics(siteId, path || '/', period);
  }

  /**
   * POST /api/analytics/:siteId/event
   *
   * Track a custom event
   *
   * Request:
   * {
   *   "name": "button_click",
   *   "category": "engagement",
   *   "value": 1,
   *   "properties": { ... }
   * }
   *
   * Response:
   * {
   *   "success": true
   * }
   */
  @Post(':siteId/event')
  async trackEvent(
    @Param('siteId') siteId: string,
    @Body() dto: TrackEventDto,
  ): Promise<{ success: boolean }> {
    return this.analyticsService.trackEvent(siteId, dto);
  }

  /**
   * POST /api/analytics/:siteId/goals
   *
   * Create a conversion goal
   *
   * Request:
   * {
   *   "name": "Contact Form Submission",
   *   "type": "form_submit",
   *   "target": "/contact"
   * }
   *
   * Response: ConversionGoal
   */
  @Post(':siteId/goals')
  async createGoal(
    @Param('siteId') siteId: string,
    @Body() dto: CreateGoalDto,
  ): Promise<ConversionGoal> {
    return this.analyticsService.createGoal(siteId, dto);
  }
}
