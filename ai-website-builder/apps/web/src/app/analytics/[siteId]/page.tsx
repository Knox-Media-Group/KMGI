'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Users, Eye, Clock, MousePointerClick, TrendingUp, TrendingDown,
  Globe, Monitor, Smartphone, Tablet, ChevronDown, RefreshCw, Loader2,
  Target, BarChart3, Activity, MapPin, Calendar, ArrowUpRight, Zap
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  analyticsApi,
  AnalyticsDashboard,
  RealTimeData,
  TimeSeriesDataPoint,
} from '@/lib/api';

type Period = '7d' | '30d' | '90d' | '12m';

export default function AnalyticsDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const { token } = useAuthStore();

  const [period, setPeriod] = useState<Period>('30d');
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [realTime, setRealTime] = useState<RealTimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (!token) return;
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const [dashboardData, realTimeData] = await Promise.all([
        analyticsApi.getDashboard(siteId, period, token),
        analyticsApi.getRealTime(siteId, token),
      ]);

      setAnalytics(dashboardData);
      setRealTime(realTimeData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      // Set mock data for demo
      setAnalytics(getMockAnalytics(siteId, period));
      setRealTime(getMockRealTime());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [siteId, period, token]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh real-time data every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (token) {
        analyticsApi.getRealTime(siteId, token).then(setRealTime).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [siteId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const data = analytics || getMockAnalytics(siteId, period);
  const rt = realTime || getMockRealTime();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
                <p className="text-xs text-gray-500">Site performance & visitor insights</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Real-time indicator */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {rt.activeVisitors} active now
              </div>

              {/* Period selector */}
              <div className="relative">
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="12m">Last 12 months</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Refresh button */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Key metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            icon={Users}
            label="Total Visitors"
            value={formatNumber(data.visitors.total)}
            change={data.visitors.change}
            sublabel={`${formatNumber(data.visitors.unique)} unique`}
          />
          <MetricCard
            icon={Eye}
            label="Page Views"
            value={formatNumber(data.pageViews.total)}
            change={data.pageViews.change}
            sublabel={`${data.pageViews.averagePerVisitor} per visitor`}
          />
          <MetricCard
            icon={Clock}
            label="Avg. Session"
            value={formatDuration(data.sessions.averageDuration)}
            sublabel={`${data.sessions.pagesPerSession} pages/session`}
          />
          <MetricCard
            icon={MousePointerClick}
            label="Bounce Rate"
            value={`${data.sessions.bounceRate}%`}
            sublabel={`${formatNumber(data.sessions.total)} sessions`}
            invertChange
          />
        </div>

        {/* Chart and top pages */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Traffic chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Traffic Overview</h2>
            <div className="h-64">
              <SimpleChart data={data.timeSeries} />
            </div>
          </div>

          {/* Top pages */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Pages</h2>
            <div className="space-y-3">
              {data.topPages.slice(0, 5).map((page, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                    <span className="text-sm text-gray-900 truncate">{page.title}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-600">{formatNumber(page.views)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Traffic sources and devices */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Traffic sources */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h2>
            <div className="space-y-4">
              {data.trafficSources.slice(0, 5).map((source, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700">{source.source}</span>
                    <span className="text-gray-500">{source.percentage}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${source.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Devices */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Devices</h2>
            <div className="space-y-4">
              {data.devices.map((device) => (
                <div key={device.device} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    device.device === 'desktop' ? 'bg-blue-100 text-blue-600' :
                    device.device === 'mobile' ? 'bg-purple-100 text-purple-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {device.device === 'desktop' ? <Monitor className="w-5 h-5" /> :
                     device.device === 'mobile' ? <Smartphone className="w-5 h-5" /> :
                     <Tablet className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 capitalize">{device.device}</span>
                      <span className="text-gray-500">{device.percentage}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          device.device === 'desktop' ? 'bg-blue-500' :
                          device.device === 'mobile' ? 'bg-purple-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${device.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top countries */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Countries</h2>
            <div className="space-y-3">
              {data.countries.slice(0, 5).map((country, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCountryFlag(country.countryCode)}</span>
                    <span className="text-sm text-gray-700">{country.country}</span>
                  </div>
                  <span className="text-sm text-gray-500">{country.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conversion goals */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Conversion Goals</h2>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              + Add Goal
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.goals.map((goal) => (
              <div key={goal.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{goal.completions}</p>
                    <p className="text-xs text-gray-500">completions</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-emerald-600">{goal.conversionRate}%</p>
                    <p className="text-xs text-gray-500">conversion</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components

function MetricCard({
  icon: Icon,
  label,
  value,
  change,
  sublabel,
  invertChange = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  change?: number;
  sublabel?: string;
  invertChange?: boolean;
}) {
  const isPositive = change !== undefined && (invertChange ? change < 0 : change > 0);
  const isNegative = change !== undefined && (invertChange ? change > 0 : change < 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-gray-500'
          }`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : isNegative ? <TrendingDown className="w-4 h-4" /> : null}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-sm text-gray-500">{label}</p>
        {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
      </div>
    </div>
  );
}

function SimpleChart({ data }: { data: TimeSeriesDataPoint[] }) {
  const maxVisitors = Math.max(...data.map(d => d.visitors));
  const maxPageViews = Math.max(...data.map(d => d.pageViews));
  const max = Math.max(maxVisitors, maxPageViews);

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-xs text-gray-600">Visitors</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-xs text-gray-600">Page Views</span>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 flex items-end gap-1">
        {data.map((point, i) => {
          const visitorHeight = (point.visitors / max) * 100;
          const pageViewHeight = (point.pageViews / max) * 100;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap">
                  <p className="font-medium">{point.date}</p>
                  <p>Visitors: {point.visitors}</p>
                  <p>Page Views: {point.pageViews}</p>
                </div>
              </div>
              {/* Bars */}
              <div className="w-full flex gap-0.5 items-end h-40">
                <div
                  className="flex-1 bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                  style={{ height: `${visitorHeight}%` }}
                />
                <div
                  className="flex-1 bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                  style={{ height: `${pageViewHeight}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-400">
        <span>{data[0]?.date}</span>
        <span>{data[Math.floor(data.length / 2)]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

// Utility functions

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    US: '\ud83c\uddfa\ud83c\uddf8',
    GB: '\ud83c\uddec\ud83c\udde7',
    CA: '\ud83c\udde8\ud83c\udde6',
    AU: '\ud83c\udde6\ud83c\uddfa',
    DE: '\ud83c\udde9\ud83c\uddea',
    FR: '\ud83c\uddeb\ud83c\uddf7',
    IN: '\ud83c\uddee\ud83c\uddf3',
    XX: '\ud83c\udf10',
  };
  return flags[code] || '\ud83c\udf10';
}

// Mock data generators

function getMockAnalytics(siteId: string, period: Period): AnalyticsDashboard {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const baseVisitors = Math.floor(Math.random() * 3000) + 1500;

  return {
    siteId,
    period,
    visitors: { total: baseVisitors, unique: Math.floor(baseVisitors * 0.75), returning: Math.floor(baseVisitors * 0.25), change: 12 },
    pageViews: { total: Math.floor(baseVisitors * 2.5), change: 8, averagePerVisitor: 2.5 },
    sessions: { total: Math.floor(baseVisitors * 1.2), averageDuration: 145, bounceRate: 42, pagesPerSession: 2.3 },
    topPages: [
      { path: '/', title: 'Home', views: 1250, uniqueViews: 980, avgTimeOnPage: 65, bounceRate: 38 },
      { path: '/services', title: 'Services', views: 820, uniqueViews: 650, avgTimeOnPage: 95, bounceRate: 35 },
      { path: '/about', title: 'About Us', views: 540, uniqueViews: 420, avgTimeOnPage: 78, bounceRate: 45 },
      { path: '/contact', title: 'Contact', views: 380, uniqueViews: 310, avgTimeOnPage: 120, bounceRate: 25 },
      { path: '/faq', title: 'FAQ', views: 220, uniqueViews: 180, avgTimeOnPage: 85, bounceRate: 40 },
    ],
    trafficSources: [
      { source: 'Google', medium: 'organic', visitors: 1200, percentage: 45 },
      { source: 'Direct', medium: 'none', visitors: 650, percentage: 25 },
      { source: 'Facebook', medium: 'social', visitors: 380, percentage: 15 },
      { source: 'Google', medium: 'cpc', visitors: 250, percentage: 10 },
      { source: 'Other', medium: 'referral', visitors: 120, percentage: 5 },
    ],
    devices: [
      { device: 'desktop', visitors: 1500, percentage: 55 },
      { device: 'mobile', visitors: 950, percentage: 35 },
      { device: 'tablet', visitors: 270, percentage: 10 },
    ],
    browsers: [
      { browser: 'Chrome', visitors: 1500, percentage: 55 },
      { browser: 'Safari', visitors: 550, percentage: 20 },
      { browser: 'Firefox', visitors: 350, percentage: 13 },
      { browser: 'Edge', visitors: 220, percentage: 8 },
      { browser: 'Other', visitors: 100, percentage: 4 },
    ],
    countries: [
      { country: 'United States', countryCode: 'US', visitors: 1200, percentage: 45 },
      { country: 'United Kingdom', countryCode: 'GB', visitors: 350, percentage: 13 },
      { country: 'Canada', countryCode: 'CA', visitors: 280, percentage: 10 },
      { country: 'Australia', countryCode: 'AU', visitors: 200, percentage: 8 },
      { country: 'Germany', countryCode: 'DE', visitors: 150, percentage: 6 },
    ],
    timeSeries: Array.from({ length: Math.min(days, 30) }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (Math.min(days, 30) - 1 - i));
      return {
        date: date.toISOString().split('T')[0],
        visitors: Math.floor(Math.random() * 100) + 50,
        pageViews: Math.floor(Math.random() * 200) + 100,
      };
    }),
    goals: [
      { id: '1', name: 'Contact Form', type: 'form_submit', target: '/contact', completions: 45, conversionRate: 3.2 },
      { id: '2', name: 'Phone Click', type: 'click', target: 'tel:', completions: 28, conversionRate: 2.1 },
      { id: '3', name: 'Service View', type: 'pageview', target: '/services', completions: 820, conversionRate: 32 },
    ],
    lastUpdated: new Date().toISOString(),
  };
}

function getMockRealTime(): RealTimeData {
  return {
    activeVisitors: Math.floor(Math.random() * 30) + 5,
    activePages: [
      { path: '/', visitors: Math.floor(Math.random() * 10) + 3 },
      { path: '/services', visitors: Math.floor(Math.random() * 5) + 1 },
      { path: '/contact', visitors: Math.floor(Math.random() * 3) + 1 },
    ],
    recentEvents: [],
  };
}
