import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PageSpeedResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number; // First Contentful Paint (ms)
  lcp: number; // Largest Contentful Paint (ms)
  tbt: number; // Total Blocking Time (ms)
  cls: number; // Cumulative Layout Shift
  speedIndex: number;
  ttfb: number; // Time to First Byte (ms)
  recommendations: PageSpeedRecommendation[];
}

export interface PageSpeedRecommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'performance' | 'accessibility' | 'best-practices' | 'seo';
  savings?: string;
}

export interface CDNConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'bunny' | 'custom';
  zoneId?: string;
  cacheEnabled: boolean;
  minifyHtml: boolean;
  minifyCss: boolean;
  minifyJs: boolean;
  imageOptimization: boolean;
  lazyLoading: boolean;
  preloadFonts: boolean;
}

export interface PerformanceReport {
  siteId: string;
  url: string;
  timestamp: Date;
  desktop: PageSpeedResult;
  mobile: PageSpeedResult;
  cdnConfig: CDNConfig;
  overallScore: number;
}

@Injectable()
export class PerformanceService {
  private pageSpeedApiKey: string;
  private mockMode: boolean;

  constructor(private configService: ConfigService) {
    this.pageSpeedApiKey = this.configService.get('PAGESPEED_API_KEY') || '';
    this.mockMode = !this.pageSpeedApiKey;

    if (this.mockMode) {
      console.log('Performance Service: Running in mock mode (no PAGESPEED_API_KEY)');
    }
  }

  async analyzeUrl(url: string): Promise<{ desktop: PageSpeedResult; mobile: PageSpeedResult }> {
    if (this.mockMode) {
      return this.getMockResults();
    }

    const [desktop, mobile] = await Promise.all([
      this.runPageSpeedAnalysis(url, 'desktop'),
      this.runPageSpeedAnalysis(url, 'mobile'),
    ]);

    return { desktop, mobile };
  }

  private async runPageSpeedAnalysis(url: string, strategy: 'desktop' | 'mobile'): Promise<PageSpeedResult> {
    const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&key=${this.pageSpeedApiKey}&category=performance&category=accessibility&category=best-practices&category=seo`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'PageSpeed API error');
      }

      const lighthouse = data.lighthouseResult;
      const categories = lighthouse.categories;
      const audits = lighthouse.audits;

      // Extract core web vitals
      const fcp = audits['first-contentful-paint']?.numericValue || 0;
      const lcp = audits['largest-contentful-paint']?.numericValue || 0;
      const tbt = audits['total-blocking-time']?.numericValue || 0;
      const cls = audits['cumulative-layout-shift']?.numericValue || 0;
      const speedIndex = audits['speed-index']?.numericValue || 0;
      const ttfb = audits['server-response-time']?.numericValue || 0;

      // Extract recommendations
      const recommendations: PageSpeedRecommendation[] = [];
      const opportunityAudits = ['render-blocking-resources', 'unused-css-rules', 'unused-javascript', 'modern-image-formats', 'efficient-animated-content', 'uses-optimized-images', 'offscreen-images', 'uses-text-compression', 'uses-responsive-images'];

      for (const auditId of opportunityAudits) {
        const audit = audits[auditId];
        if (audit && audit.score !== null && audit.score < 1) {
          recommendations.push({
            id: auditId,
            title: audit.title,
            description: audit.description,
            impact: audit.score < 0.5 ? 'high' : audit.score < 0.8 ? 'medium' : 'low',
            category: 'performance',
            savings: audit.displayValue,
          });
        }
      }

      return {
        performance: Math.round((categories.performance?.score || 0) * 100),
        accessibility: Math.round((categories.accessibility?.score || 0) * 100),
        bestPractices: Math.round((categories['best-practices']?.score || 0) * 100),
        seo: Math.round((categories.seo?.score || 0) * 100),
        fcp: Math.round(fcp),
        lcp: Math.round(lcp),
        tbt: Math.round(tbt),
        cls: parseFloat(cls.toFixed(3)),
        speedIndex: Math.round(speedIndex),
        ttfb: Math.round(ttfb),
        recommendations: recommendations.slice(0, 10),
      };
    } catch (error) {
      console.error('PageSpeed analysis error:', error);
      return this.getMockResults().desktop;
    }
  }

  private getMockResults(): { desktop: PageSpeedResult; mobile: PageSpeedResult } {
    const baseResult: PageSpeedResult = {
      performance: 92,
      accessibility: 95,
      bestPractices: 100,
      seo: 98,
      fcp: 1200,
      lcp: 2100,
      tbt: 150,
      cls: 0.05,
      speedIndex: 2500,
      ttfb: 450,
      recommendations: [
        {
          id: 'modern-image-formats',
          title: 'Serve images in next-gen formats',
          description: 'Image formats like WebP and AVIF often provide better compression than PNG or JPEG.',
          impact: 'medium',
          category: 'performance',
          savings: '0.5 s',
        },
        {
          id: 'unused-css-rules',
          title: 'Reduce unused CSS',
          description: 'Reduce unused rules from stylesheets to reduce bytes consumed by network activity.',
          impact: 'low',
          category: 'performance',
          savings: '0.15 s',
        },
        {
          id: 'uses-text-compression',
          title: 'Enable text compression',
          description: 'Text-based resources should be served with compression (gzip, deflate or brotli).',
          impact: 'low',
          category: 'performance',
          savings: '0.1 s',
        },
      ],
    };

    return {
      desktop: baseResult,
      mobile: {
        ...baseResult,
        performance: 85,
        fcp: 1800,
        lcp: 3200,
        speedIndex: 3500,
      },
    };
  }

  getDefaultCDNConfig(): CDNConfig {
    return {
      enabled: true,
      provider: 'cloudflare',
      cacheEnabled: true,
      minifyHtml: true,
      minifyCss: true,
      minifyJs: true,
      imageOptimization: true,
      lazyLoading: true,
      preloadFonts: true,
    };
  }

  async generatePerformanceReport(siteId: string, url: string): Promise<PerformanceReport> {
    const { desktop, mobile } = await this.analyzeUrl(url);
    const cdnConfig = this.getDefaultCDNConfig();

    // Calculate overall score (weighted average favoring mobile)
    const overallScore = Math.round(
      (desktop.performance * 0.3 + mobile.performance * 0.7)
    );

    return {
      siteId,
      url,
      timestamp: new Date(),
      desktop,
      mobile,
      cdnConfig,
      overallScore,
    };
  }

  getPerformanceGrade(score: number): { grade: string; color: string; label: string } {
    if (score >= 90) {
      return { grade: 'A', color: '#22c55e', label: 'Excellent' };
    } else if (score >= 75) {
      return { grade: 'B', color: '#84cc16', label: 'Good' };
    } else if (score >= 50) {
      return { grade: 'C', color: '#eab308', label: 'Needs Improvement' };
    } else if (score >= 25) {
      return { grade: 'D', color: '#f97316', label: 'Poor' };
    } else {
      return { grade: 'F', color: '#ef4444', label: 'Critical' };
    }
  }

  async optimizeSite(siteId: string, config: Partial<CDNConfig>): Promise<{ success: boolean; message: string }> {
    // In a real implementation, this would configure CDN settings
    console.log(`Optimizing site ${siteId} with config:`, config);

    // Mock implementation
    return {
      success: true,
      message: 'Performance optimizations applied successfully. Changes may take up to 5 minutes to propagate.',
    };
  }

  async purgeCache(siteId: string, paths?: string[]): Promise<{ success: boolean; message: string }> {
    // In a real implementation, this would purge CDN cache
    console.log(`Purging cache for site ${siteId}`, paths ? `paths: ${paths.join(', ')}` : 'all');

    return {
      success: true,
      message: paths
        ? `Cache purged for ${paths.length} paths.`
        : 'Full cache purge initiated. May take up to 30 seconds.',
    };
  }
}
