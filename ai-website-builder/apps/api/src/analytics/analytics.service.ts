import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface VisitorStats {
  total: number;
  unique: number;
  returning: number;
  change: number; // percentage change from previous period
}

export interface PageViewStats {
  total: number;
  change: number;
  averagePerVisitor: number;
}

export interface SessionStats {
  total: number;
  averageDuration: number; // in seconds
  bounceRate: number; // percentage
  pagesPerSession: number;
}

export interface TopPage {
  path: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number; // seconds
  bounceRate: number;
}

export interface TrafficSource {
  source: string;
  medium: string;
  visitors: number;
  percentage: number;
}

export interface DeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet';
  visitors: number;
  percentage: number;
}

export interface BrowserBreakdown {
  browser: string;
  visitors: number;
  percentage: number;
}

export interface CountryBreakdown {
  country: string;
  countryCode: string;
  visitors: number;
  percentage: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  visitors: number;
  pageViews: number;
}

export interface ConversionGoal {
  id: string;
  name: string;
  type: 'pageview' | 'event' | 'form_submit' | 'click';
  target: string;
  completions: number;
  conversionRate: number;
}

export interface AnalyticsDashboard {
  siteId: string;
  period: string;
  visitors: VisitorStats;
  pageViews: PageViewStats;
  sessions: SessionStats;
  topPages: TopPage[];
  trafficSources: TrafficSource[];
  devices: DeviceBreakdown[];
  browsers: BrowserBreakdown[];
  countries: CountryBreakdown[];
  timeSeries: TimeSeriesDataPoint[];
  goals: ConversionGoal[];
  lastUpdated: string;
}

export interface RealTimeData {
  activeVisitors: number;
  activePages: { path: string; visitors: number }[];
  recentEvents: { type: string; path: string; timestamp: string }[];
}

@Injectable()
export class AnalyticsService {
  private googleAnalyticsKey: string | null;

  constructor(private configService: ConfigService) {
    this.googleAnalyticsKey = this.configService.get('GOOGLE_ANALYTICS_API_KEY') || null;
  }

  /**
   * Get full analytics dashboard for a site
   */
  async getDashboard(siteId: string, period: '7d' | '30d' | '90d' | '12m' = '30d'): Promise<AnalyticsDashboard> {
    // In a production environment, this would fetch from Google Analytics, Plausible, or similar
    // For now, we generate realistic mock data

    const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const baseVisitors = Math.floor(Math.random() * 5000) + 1000;

    return {
      siteId,
      period,
      visitors: this.generateVisitorStats(baseVisitors),
      pageViews: this.generatePageViewStats(baseVisitors),
      sessions: this.generateSessionStats(baseVisitors),
      topPages: this.generateTopPages(),
      trafficSources: this.generateTrafficSources(),
      devices: this.generateDeviceBreakdown(),
      browsers: this.generateBrowserBreakdown(),
      countries: this.generateCountryBreakdown(),
      timeSeries: this.generateTimeSeries(periodDays),
      goals: this.generateGoals(),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get real-time analytics data
   */
  async getRealTimeData(siteId: string): Promise<RealTimeData> {
    const activeVisitors = Math.floor(Math.random() * 50) + 1;

    return {
      activeVisitors,
      activePages: [
        { path: '/', visitors: Math.floor(activeVisitors * 0.4) },
        { path: '/services', visitors: Math.floor(activeVisitors * 0.25) },
        { path: '/about', visitors: Math.floor(activeVisitors * 0.2) },
        { path: '/contact', visitors: Math.floor(activeVisitors * 0.15) },
      ].filter(p => p.visitors > 0),
      recentEvents: [
        { type: 'pageview', path: '/', timestamp: new Date(Date.now() - 5000).toISOString() },
        { type: 'pageview', path: '/services', timestamp: new Date(Date.now() - 15000).toISOString() },
        { type: 'form_submit', path: '/contact', timestamp: new Date(Date.now() - 45000).toISOString() },
        { type: 'click', path: '/services', timestamp: new Date(Date.now() - 60000).toISOString() },
        { type: 'pageview', path: '/about', timestamp: new Date(Date.now() - 120000).toISOString() },
      ],
    };
  }

  /**
   * Get visitor stats for a specific page
   */
  async getPageAnalytics(siteId: string, pagePath: string, period: string = '30d'): Promise<TopPage> {
    const baseViews = Math.floor(Math.random() * 2000) + 100;
    return {
      path: pagePath,
      title: this.pathToTitle(pagePath),
      views: baseViews,
      uniqueViews: Math.floor(baseViews * 0.7),
      avgTimeOnPage: Math.floor(Math.random() * 180) + 30,
      bounceRate: Math.floor(Math.random() * 40) + 20,
    };
  }

  /**
   * Track a custom event
   */
  async trackEvent(siteId: string, event: {
    name: string;
    category: string;
    value?: number;
    properties?: Record<string, unknown>;
  }): Promise<{ success: boolean }> {
    // In production, this would send to analytics service
    console.log(`[Analytics] Event tracked for site ${siteId}:`, event);
    return { success: true };
  }

  /**
   * Create a conversion goal
   */
  async createGoal(siteId: string, goal: Omit<ConversionGoal, 'id' | 'completions' | 'conversionRate'>): Promise<ConversionGoal> {
    return {
      id: `goal-${Date.now()}`,
      ...goal,
      completions: 0,
      conversionRate: 0,
    };
  }

  // ============================================
  // Private helper methods for generating mock data
  // ============================================

  private generateVisitorStats(base: number): VisitorStats {
    return {
      total: base,
      unique: Math.floor(base * 0.75),
      returning: Math.floor(base * 0.25),
      change: Math.floor(Math.random() * 40) - 10, // -10% to +30%
    };
  }

  private generatePageViewStats(visitors: number): PageViewStats {
    const total = Math.floor(visitors * 2.5);
    return {
      total,
      change: Math.floor(Math.random() * 35) - 5,
      averagePerVisitor: parseFloat((total / visitors).toFixed(2)),
    };
  }

  private generateSessionStats(visitors: number): SessionStats {
    return {
      total: Math.floor(visitors * 1.2),
      averageDuration: Math.floor(Math.random() * 180) + 60, // 1-4 minutes
      bounceRate: Math.floor(Math.random() * 30) + 30, // 30-60%
      pagesPerSession: parseFloat((Math.random() * 2 + 1.5).toFixed(2)), // 1.5-3.5
    };
  }

  private generateTopPages(): TopPage[] {
    const pages = [
      { path: '/', title: 'Home' },
      { path: '/services', title: 'Services' },
      { path: '/about', title: 'About Us' },
      { path: '/contact', title: 'Contact' },
      { path: '/faq', title: 'FAQ' },
      { path: '/blog', title: 'Blog' },
      { path: '/pricing', title: 'Pricing' },
    ];

    return pages.map((page, index) => {
      const views = Math.floor(Math.random() * 1000) + 100 - (index * 100);
      return {
        ...page,
        views: Math.max(views, 50),
        uniqueViews: Math.floor(views * 0.7),
        avgTimeOnPage: Math.floor(Math.random() * 120) + 30,
        bounceRate: Math.floor(Math.random() * 40) + 20,
      };
    }).sort((a, b) => b.views - a.views);
  }

  private generateTrafficSources(): TrafficSource[] {
    const sources = [
      { source: 'Google', medium: 'organic' },
      { source: 'Direct', medium: 'none' },
      { source: 'Facebook', medium: 'social' },
      { source: 'Google', medium: 'cpc' },
      { source: 'Instagram', medium: 'social' },
      { source: 'Bing', medium: 'organic' },
      { source: 'Twitter', medium: 'social' },
    ];

    let remaining = 100;
    return sources.map((s, i) => {
      const isLast = i === sources.length - 1;
      const pct = isLast ? remaining : Math.floor(Math.random() * (remaining * 0.6)) + 5;
      remaining -= pct;
      return {
        ...s,
        visitors: Math.floor(pct * 50),
        percentage: pct,
      };
    }).sort((a, b) => b.percentage - a.percentage);
  }

  private generateDeviceBreakdown(): DeviceBreakdown[] {
    const desktop = Math.floor(Math.random() * 20) + 45; // 45-65%
    const mobile = Math.floor(Math.random() * 20) + 25; // 25-45%
    const tablet = 100 - desktop - mobile;

    return [
      { device: 'desktop', visitors: desktop * 50, percentage: desktop },
      { device: 'mobile', visitors: mobile * 50, percentage: mobile },
      { device: 'tablet', visitors: tablet * 50, percentage: tablet },
    ];
  }

  private generateBrowserBreakdown(): BrowserBreakdown[] {
    const browsers = [
      { browser: 'Chrome', base: 55 },
      { browser: 'Safari', base: 20 },
      { browser: 'Firefox', base: 10 },
      { browser: 'Edge', base: 8 },
      { browser: 'Other', base: 7 },
    ];

    return browsers.map(b => ({
      browser: b.browser,
      visitors: b.base * 50 + Math.floor(Math.random() * 500),
      percentage: b.base + Math.floor(Math.random() * 5) - 2,
    }));
  }

  private generateCountryBreakdown(): CountryBreakdown[] {
    const countries = [
      { country: 'United States', countryCode: 'US', base: 45 },
      { country: 'United Kingdom', countryCode: 'GB', base: 12 },
      { country: 'Canada', countryCode: 'CA', base: 8 },
      { country: 'Australia', countryCode: 'AU', base: 6 },
      { country: 'Germany', countryCode: 'DE', base: 5 },
      { country: 'France', countryCode: 'FR', base: 4 },
      { country: 'India', countryCode: 'IN', base: 4 },
      { country: 'Other', countryCode: 'XX', base: 16 },
    ];

    return countries.map(c => ({
      ...c,
      visitors: c.base * 50 + Math.floor(Math.random() * 200),
      percentage: c.base + Math.floor(Math.random() * 3) - 1,
    }));
  }

  private generateTimeSeries(days: number): TimeSeriesDataPoint[] {
    const data: TimeSeriesDataPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Add some weekly patterns (weekends lower)
      const dayOfWeek = date.getDay();
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.7 : 1;

      const visitors = Math.floor((Math.random() * 100 + 50) * weekendFactor);
      const pageViews = Math.floor(visitors * (2 + Math.random()));

      data.push({
        date: date.toISOString().split('T')[0],
        visitors,
        pageViews,
      });
    }

    return data;
  }

  private generateGoals(): ConversionGoal[] {
    return [
      {
        id: 'goal-1',
        name: 'Contact Form Submission',
        type: 'form_submit',
        target: '/contact',
        completions: Math.floor(Math.random() * 100) + 20,
        conversionRate: parseFloat((Math.random() * 5 + 1).toFixed(2)),
      },
      {
        id: 'goal-2',
        name: 'Phone Number Click',
        type: 'click',
        target: 'tel:',
        completions: Math.floor(Math.random() * 80) + 10,
        conversionRate: parseFloat((Math.random() * 4 + 0.5).toFixed(2)),
      },
      {
        id: 'goal-3',
        name: 'Services Page View',
        type: 'pageview',
        target: '/services',
        completions: Math.floor(Math.random() * 500) + 100,
        conversionRate: parseFloat((Math.random() * 30 + 15).toFixed(2)),
      },
    ];
  }

  private pathToTitle(path: string): string {
    if (path === '/') return 'Home';
    return path
      .replace(/^\//, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
