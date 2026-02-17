import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { PerformanceService, CDNConfig, PerformanceReport } from './performance.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class AnalyzeUrlDto {
  url: string;
}

class OptimizeDto {
  config: Partial<CDNConfig>;
}

class PurgeCacheDto {
  paths?: string[];
}

@Controller('performance')
@UseGuards(JwtAuthGuard)
export class PerformanceController {
  constructor(private performanceService: PerformanceService) {}

  /**
   * GET /api/performance/analyze
   *
   * Analyze a URL's performance using PageSpeed Insights
   *
   * Query params:
   * - url: The URL to analyze
   *
   * Response:
   * {
   *   "desktop": {
   *     "performance": 92,
   *     "accessibility": 95,
   *     "bestPractices": 100,
   *     "seo": 98,
   *     "fcp": 1200,
   *     "lcp": 2100,
   *     "tbt": 150,
   *     "cls": 0.05,
   *     "speedIndex": 2500,
   *     "ttfb": 450,
   *     "recommendations": [...]
   *   },
   *   "mobile": { ... }
   * }
   */
  @Get('analyze')
  async analyzeUrl(@Query('url') url: string) {
    if (!url) {
      return { error: 'URL parameter is required' };
    }
    return this.performanceService.analyzeUrl(url);
  }

  /**
   * GET /api/performance/report/:siteId
   *
   * Get a full performance report for a site
   *
   * Response:
   * {
   *   "siteId": "...",
   *   "url": "https://...",
   *   "timestamp": "2024-...",
   *   "desktop": { ... },
   *   "mobile": { ... },
   *   "cdnConfig": { ... },
   *   "overallScore": 88
   * }
   */
  @Get('report/:siteId')
  async getReport(
    @Param('siteId') siteId: string,
    @Query('url') url: string,
  ): Promise<PerformanceReport> {
    return this.performanceService.generatePerformanceReport(siteId, url);
  }

  /**
   * GET /api/performance/grade/:score
   *
   * Get performance grade for a score
   *
   * Response:
   * {
   *   "grade": "A",
   *   "color": "#22c55e",
   *   "label": "Excellent"
   * }
   */
  @Get('grade/:score')
  getGrade(@Param('score') score: string) {
    return this.performanceService.getPerformanceGrade(parseInt(score, 10));
  }

  /**
   * POST /api/performance/:siteId/optimize
   *
   * Apply performance optimizations to a site
   *
   * Request:
   * {
   *   "config": {
   *     "minifyHtml": true,
   *     "minifyCss": true,
   *     "minifyJs": true,
   *     "imageOptimization": true,
   *     "lazyLoading": true
   *   }
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "..."
   * }
   */
  @Post(':siteId/optimize')
  async optimize(@Param('siteId') siteId: string, @Body() dto: OptimizeDto) {
    return this.performanceService.optimizeSite(siteId, dto.config);
  }

  /**
   * POST /api/performance/:siteId/purge
   *
   * Purge CDN cache for a site
   *
   * Request:
   * {
   *   "paths": ["/", "/about", "/contact"]  // optional, purge all if not provided
   * }
   *
   * Response:
   * {
   *   "success": true,
   *   "message": "..."
   * }
   */
  @Post(':siteId/purge')
  async purgeCache(@Param('siteId') siteId: string, @Body() dto: PurgeCacheDto) {
    return this.performanceService.purgeCache(siteId, dto.paths);
  }

  /**
   * GET /api/performance/cdn-config
   *
   * Get default CDN configuration
   *
   * Response:
   * {
   *   "enabled": true,
   *   "provider": "cloudflare",
   *   "cacheEnabled": true,
   *   ...
   * }
   */
  @Get('cdn-config')
  getDefaultCDNConfig() {
    return this.performanceService.getDefaultCDNConfig();
  }
}
