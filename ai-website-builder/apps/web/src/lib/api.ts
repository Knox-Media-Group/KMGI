const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth endpoints
export const authApi = {
  signup: (email: string, password: string, tenantSlug?: string) =>
    api<{ token: string; user: { id: string; email: string }; tenant: { id: string; name: string; primaryColor: string; logoUrl: string | null } }>(
      '/auth/signup',
      { method: 'POST', body: { email, password, tenantSlug } }
    ),

  login: (email: string, password: string, tenantSlug?: string) =>
    api<{ token: string; user: { id: string; email: string }; tenant: { id: string; name: string; primaryColor: string; logoUrl: string | null } }>(
      '/auth/login',
      { method: 'POST', body: { email, password, tenantSlug } }
    ),

  me: (token: string) =>
    api<{
      user: { id: string; email: string };
      tenant: { id: string; name: string; primaryColor: string; logoUrl: string | null };
      membership: { role: string };
      subscription: { status: string; currentPeriodEnd: string } | null;
    }>('/auth/me', { token }),
};

// Tenant endpoints
export const tenantApi = {
  getBySlug: (slug: string) =>
    api<{ id: string; name: string; slug: string; logoUrl: string | null; primaryColor: string }>(
      `/tenants/${slug}`
    ),
};

// Sites endpoints
export const sitesApi = {
  list: (token: string) =>
    api<Array<{
      id: string;
      name: string;
      status: string;
      wpSiteUrl: string | null;
      createdAt: string;
    }>>('/sites', { token }),

  get: (id: string, token: string) =>
    api<{
      site: {
        id: string;
        name: string;
        status: string;
        wpSiteUrl: string | null;
        currentVersionId: string | null;
        publishedVersionId: string | null;
        createdAt: string;
      };
      currentVersion: { id: string; versionNumber: number; pageJson: unknown } | null;
      versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
      activeJob: { id: string; type: string; status: string } | null;
    }>(`/sites/${id}`, { token }),

  create: (settings: unknown, token: string) =>
    api<{ site: { id: string }; jobId: string }>('/sites', { method: 'POST', body: { settings }, token }),

  generate: (id: string, token: string, sectionId?: string) =>
    api<{ jobId: string }>(`/sites/${id}/generate`, { method: 'POST', body: { sectionId }, token }),

  saveDraft: (id: string, pages: unknown, token: string) =>
    api<{ version: { id: string; versionNumber: number } }>(`/sites/${id}/draft`, { method: 'PUT', body: { pages }, token }),

  publish: (id: string, token: string) =>
    api<{ jobId: string }>(`/sites/${id}/publish`, { method: 'POST', token }),

  rollback: (id: string, versionId: string, token: string) =>
    api<{ jobId: string }>(`/sites/${id}/rollback`, { method: 'POST', body: { versionId }, token }),
};

// Jobs endpoints
export const jobsApi = {
  get: (id: string, token: string) =>
    api<{
      id: string;
      type: string;
      status: string;
      error: string | null;
      createdAt: string;
      completedAt: string | null;
      logs: Array<{ id: string; message: string; createdAt: string }>;
    }>(`/jobs/${id}`, { token }),
};

// Billing endpoints
export const billingApi = {
  status: (token: string) =>
    api<{ hasSubscription: boolean; subscription: { status: string; currentPeriodEnd: string } | null }>(
      '/billing/status',
      { token }
    ),

  createCheckout: (token: string) =>
    api<{ checkoutUrl: string }>('/billing/checkout', { method: 'POST', token }),

  createPortal: (token: string) =>
    api<{ portalUrl: string }>('/billing/portal', { method: 'POST', token }),
};

// AI Co-Pilot endpoints
export interface CopilotMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CopilotAction {
  type: 'update_text' | 'update_style' | 'add_section' | 'remove_section' | 'reorder' | 'update_image';
  target: {
    sectionId?: string;
    blockId?: string;
    pageSlug?: string;
  };
  payload: Record<string, unknown>;
}

export interface CopilotResponse {
  message: string;
  actions?: CopilotAction[];
  suggestions?: string[];
}

export const copilotApi = {
  chat: (messages: CopilotMessage[], context: unknown, token: string) =>
    api<CopilotResponse>('/ai/copilot/chat', {
      method: 'POST',
      body: { messages, context },
      token,
    }),

  suggest: (context: unknown, token: string) =>
    api<CopilotResponse>('/ai/copilot/suggest', {
      method: 'POST',
      body: { context },
      token,
    }),

  rewrite: (text: string, style: string, context: unknown, token: string) =>
    api<{ original: string; rewritten: string; alternatives: string[] }>('/ai/copilot/rewrite', {
      method: 'POST',
      body: { text, style, context },
      token,
    }),
};

// Performance API
export interface PageSpeedResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  speedIndex: number;
  ttfb: number;
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    category: string;
    savings?: string;
  }>;
}

export interface CDNConfig {
  enabled: boolean;
  provider: string;
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
  timestamp: string;
  desktop: PageSpeedResult;
  mobile: PageSpeedResult;
  cdnConfig: CDNConfig;
  overallScore: number;
}

export const performanceApi = {
  analyze: (url: string, token: string) =>
    api<{ desktop: PageSpeedResult; mobile: PageSpeedResult }>(`/performance/analyze?url=${encodeURIComponent(url)}`, { token }),

  getReport: (siteId: string, url: string, token: string) =>
    api<PerformanceReport>(`/performance/report/${siteId}?url=${encodeURIComponent(url)}`, { token }),

  getGrade: (score: number, token: string) =>
    api<{ grade: string; color: string; label: string }>(`/performance/grade/${score}`, { token }),

  optimize: (siteId: string, config: Partial<CDNConfig>, token: string) =>
    api<{ success: boolean; message: string }>(`/performance/${siteId}/optimize`, {
      method: 'POST',
      body: { config },
      token,
    }),

  purgeCache: (siteId: string, paths: string[] | undefined, token: string) =>
    api<{ success: boolean; message: string }>(`/performance/${siteId}/purge`, {
      method: 'POST',
      body: { paths },
      token,
    }),

  getCDNConfig: (token: string) =>
    api<CDNConfig>('/performance/cdn-config', { token }),
};

// AI Image Generation API
export interface AIImageResult {
  url: string;
  revisedPrompt: string;
  source: 'ai-generated' | 'unsplash' | 'fallback';
}

export const aiImagesApi = {
  generate: (prompt: string, options: { style?: string; size?: string; quality?: string }, token: string) =>
    api<AIImageResult>('/ai/images/generate', {
      method: 'POST',
      body: { prompt, ...options },
      token,
    }),

  generateBusiness: (businessName: string, industry: string, sectionType: string, style: string, token: string) =>
    api<AIImageResult>('/ai/images/business', {
      method: 'POST',
      body: { businessName, industry, sectionType, style },
      token,
    }),

  generateLogo: (businessName: string, industry: string, colorScheme: string, token: string) =>
    api<AIImageResult>('/ai/images/logo', {
      method: 'POST',
      body: { businessName, industry, colorScheme },
      token,
    }),
};

// Hosting API
export interface HostingStatus {
  siteId: string;
  domain: string;
  ssl: {
    enabled: boolean;
    provider: string;
    expiresAt: string | null;
    autoRenew: boolean;
    grade: string;
  };
  uptime: {
    current: boolean;
    uptimePercentage: number;
    lastDowntime: string | null;
    responseTime: number;
    checksLast24h: number;
    failedChecks: number;
  };
  storage: {
    used: number;
    total: number;
    percentage: number;
    breakdown: {
      wordpress: number;
      uploads: number;
      database: number;
      plugins: number;
      themes: number;
    };
  };
  backups: {
    lastBackup: string | null;
    nextBackup: string | null;
    frequency: string;
    retention: number;
    autoBackup: boolean;
    backups: Array<{
      id: string;
      createdAt: string;
      size: number;
      type: string;
      status: string;
    }>;
  };
  phpVersion: string;
  wordpressVersion: string;
  serverLocation: string;
}

export interface DomainInfo {
  domain: string;
  connected: boolean;
  dns: {
    aRecord: string;
    cnameRecord: string;
    nameservers: string[];
  };
  ssl: HostingStatus['ssl'];
}

export const hostingApi = {
  getStatus: (siteId: string, domain: string, token: string) =>
    api<HostingStatus>(`/hosting/${siteId}/status?domain=${encodeURIComponent(domain)}`, { token }),

  getSSL: (domain: string, token: string) =>
    api<HostingStatus['ssl']>(`/hosting/ssl/${domain}`, { token }),

  provisionSSL: (domain: string, token: string) =>
    api<{ success: boolean; message: string }>(`/hosting/ssl/${domain}/provision`, { method: 'POST', token }),

  getStorage: (siteId: string, token: string) =>
    api<HostingStatus['storage']>(`/hosting/${siteId}/storage`, { token }),

  getUptime: (domain: string, token: string) =>
    api<HostingStatus['uptime']>(`/hosting/uptime/${domain}`, { token }),

  getBackups: (siteId: string, token: string) =>
    api<HostingStatus['backups']>(`/hosting/${siteId}/backups`, { token }),

  createBackup: (siteId: string, type: string, token: string) =>
    api<{ success: boolean; backupId: string; message: string }>(`/hosting/${siteId}/backups`, {
      method: 'POST',
      body: { type },
      token,
    }),

  restoreBackup: (siteId: string, backupId: string, token: string) =>
    api<{ success: boolean; message: string }>(`/hosting/${siteId}/backups/${backupId}/restore`, {
      method: 'POST',
      token,
    }),

  getDomain: (domain: string, token: string) =>
    api<DomainInfo>(`/hosting/domain/${domain}`, { token }),

  connectDomain: (siteId: string, domain: string, token: string) =>
    api<{
      success: boolean;
      message: string;
      dnsRecords: Array<{ type: string; name: string; value: string }>;
    }>(`/hosting/${siteId}/domain/connect`, {
      method: 'POST',
      body: { domain },
      token,
    }),

  updateWordPress: (siteId: string, wpSiteUrl: string, token: string) =>
    api<{ success: boolean; message: string }>(`/hosting/${siteId}/update`, {
      method: 'POST',
      body: { wpSiteUrl },
      token,
    }),
};

// Analytics API
export interface VisitorStats {
  total: number;
  unique: number;
  returning: number;
  change: number;
}

export interface PageViewStats {
  total: number;
  change: number;
  averagePerVisitor: number;
}

export interface SessionStats {
  total: number;
  averageDuration: number;
  bounceRate: number;
  pagesPerSession: number;
}

export interface TopPage {
  path: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTimeOnPage: number;
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
  browsers: { browser: string; visitors: number; percentage: number }[];
  countries: { country: string; countryCode: string; visitors: number; percentage: number }[];
  timeSeries: TimeSeriesDataPoint[];
  goals: ConversionGoal[];
  lastUpdated: string;
}

export interface RealTimeData {
  activeVisitors: number;
  activePages: { path: string; visitors: number }[];
  recentEvents: { type: string; path: string; timestamp: string }[];
}

export const analyticsApi = {
  getDashboard: (siteId: string, period: '7d' | '30d' | '90d' | '12m', token: string) =>
    api<AnalyticsDashboard>(`/analytics/${siteId}/dashboard?period=${period}`, { token }),

  getRealTime: (siteId: string, token: string) =>
    api<RealTimeData>(`/analytics/${siteId}/realtime`, { token }),

  getPageAnalytics: (siteId: string, path: string, period: string, token: string) =>
    api<TopPage>(`/analytics/${siteId}/page?path=${encodeURIComponent(path)}&period=${period}`, { token }),

  trackEvent: (siteId: string, event: { name: string; category: string; value?: number }, token: string) =>
    api<{ success: boolean }>(`/analytics/${siteId}/event`, {
      method: 'POST',
      body: event,
      token,
    }),

  createGoal: (siteId: string, goal: { name: string; type: string; target: string }, token: string) =>
    api<ConversionGoal>(`/analytics/${siteId}/goals`, {
      method: 'POST',
      body: goal,
      token,
    }),
};

// E-commerce API
export interface Product {
  id: string;
  name: string;
  slug: string;
  status: 'publish' | 'draft' | 'pending';
  price: string;
  salePrice: string | null;
  sku: string;
  stockQuantity: number;
  stockStatus: string;
  categories: string[];
  images: string[];
  description: string;
  shortDescription: string;
  dateCreated: string;
  totalSales: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'refunded' | 'cancelled';
  customer: { name: string; email: string };
  items: Array<{ name: string; quantity: number; price: string }>;
  total: string;
  dateCreated: string;
  paymentMethod: string;
}

export interface EcommerceStats {
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  averageOrderValue: number;
  ordersToday: number;
  revenueToday: number;
  pendingOrders: number;
  lowStockProducts: number;
  topProducts: Array<{ id: string; name: string; sales: number; revenue: number }>;
  recentOrders: Order[];
}

export const ecommerceApi = {
  setup: (siteId: string, wpSiteUrl: string, token: string) =>
    api<{ success: boolean; message: string }>(`/ecommerce/${siteId}/setup?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'POST',
      token,
    }),

  getStats: (siteId: string, wpSiteUrl: string, token: string) =>
    api<EcommerceStats>(`/ecommerce/${siteId}/stats?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, { token }),

  listProducts: (siteId: string, wpSiteUrl: string, page: number, token: string) =>
    api<{ products: Product[]; total: number; page: number; perPage: number }>(
      `/ecommerce/${siteId}/products?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}&page=${page}`,
      { token }
    ),

  getProduct: (siteId: string, productId: string, wpSiteUrl: string, token: string) =>
    api<Product>(`/ecommerce/${siteId}/products/${productId}?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, { token }),

  createProduct: (siteId: string, wpSiteUrl: string, product: Partial<Product>, token: string) =>
    api<{ success: boolean; productId: string; message: string }>(`/ecommerce/${siteId}/products?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'POST',
      body: product,
      token,
    }),

  updateProduct: (siteId: string, productId: string, wpSiteUrl: string, product: Partial<Product>, token: string) =>
    api<{ success: boolean; message: string }>(`/ecommerce/${siteId}/products/${productId}?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'PUT',
      body: product,
      token,
    }),

  deleteProduct: (siteId: string, productId: string, wpSiteUrl: string, token: string) =>
    api<{ success: boolean; message: string }>(`/ecommerce/${siteId}/products/${productId}?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'DELETE',
      token,
    }),

  listOrders: (siteId: string, wpSiteUrl: string, page: number, token: string) =>
    api<{ orders: Order[]; total: number; page: number; perPage: number }>(
      `/ecommerce/${siteId}/orders?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}&page=${page}`,
      { token }
    ),

  updateOrderStatus: (siteId: string, orderId: string, wpSiteUrl: string, status: string, token: string) =>
    api<{ success: boolean; message: string }>(`/ecommerce/${siteId}/orders/${orderId}/status?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'PUT',
      body: { status },
      token,
    }),

  setupPayments: (siteId: string, wpSiteUrl: string, config: Record<string, unknown>, token: string) =>
    api<{ success: boolean; message: string }>(`/ecommerce/${siteId}/payments/setup?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, {
      method: 'POST',
      body: config,
      token,
    }),

  listCategories: (siteId: string, wpSiteUrl: string, token: string) =>
    api<{ categories: Array<{ id: string; name: string; slug: string; count: number }> }>(
      `/ecommerce/${siteId}/categories?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`,
      { token }
    ),
};

// Staging Environment API
export interface StagingStatus {
  exists: boolean;
  siteId: string;
  stagingUrl: string | null;
  productionUrl: string;
  createdAt: string | null;
  lastSynced: string | null;
  changes: number;
  status?: string;
  wpVersion?: string;
  phpVersion?: string;
  diskUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface StagingChange {
  type: 'page' | 'plugin' | 'theme' | 'media' | 'setting';
  action: 'added' | 'modified' | 'deleted';
  name: string;
  path: string | null;
  modifiedAt: string;
  details: string;
}

export interface StagingHistoryEntry {
  id: string;
  action: 'push_to_production' | 'sync_from_production' | 'create_staging' | 'delete_staging';
  user: string;
  timestamp: string;
  changes: number;
  status: 'completed' | 'failed' | 'in_progress';
  note: string;
}

export const stagingApi = {
  getStatus: (siteId: string, wpSiteUrl: string, token: string) =>
    api<StagingStatus>(`/staging/${siteId}/status?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`, { token }),

  create: (siteId: string, wpSiteUrl: string, name: string | undefined, token: string) =>
    api<{ success: boolean; stagingUrl: string; message: string; createdAt: string }>(
      `/staging/${siteId}/create?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}`,
      { method: 'POST', body: { name }, token }
    ),

  pushToProduction: (siteId: string, wpSiteUrl: string, stagingUrl: string, token: string) =>
    api<{ success: boolean; message: string; pushedAt: string }>(
      `/staging/${siteId}/push?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}&stagingUrl=${encodeURIComponent(stagingUrl)}`,
      { method: 'POST', token }
    ),

  syncFromProduction: (siteId: string, wpSiteUrl: string, stagingUrl: string, token: string) =>
    api<{ success: boolean; message: string; syncedAt: string }>(
      `/staging/${siteId}/sync?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}&stagingUrl=${encodeURIComponent(stagingUrl)}`,
      { method: 'POST', token }
    ),

  delete: (siteId: string, stagingUrl: string, token: string) =>
    api<{ success: boolean; message: string }>(`/staging/${siteId}?stagingUrl=${encodeURIComponent(stagingUrl)}`, {
      method: 'DELETE',
      token,
    }),

  getChanges: (siteId: string, wpSiteUrl: string, stagingUrl: string, token: string) =>
    api<{ changes: StagingChange[]; summary: { added: number; modified: number; deleted: number; total: number } }>(
      `/staging/${siteId}/changes?wpSiteUrl=${encodeURIComponent(wpSiteUrl)}&stagingUrl=${encodeURIComponent(stagingUrl)}`,
      { token }
    ),

  getHistory: (siteId: string, token: string) =>
    api<{ history: StagingHistoryEntry[] }>(`/staging/${siteId}/history`, { token }),
};
