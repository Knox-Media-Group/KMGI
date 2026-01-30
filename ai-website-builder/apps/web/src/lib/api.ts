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
