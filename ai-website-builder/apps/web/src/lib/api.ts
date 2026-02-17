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
