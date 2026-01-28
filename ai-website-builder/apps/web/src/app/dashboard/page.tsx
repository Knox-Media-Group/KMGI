'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { sitesApi, jobsApi, authApi } from '@/lib/api';

interface Site {
  id: string;
  name: string;
  status: string;
  wpSiteUrl: string | null;
  currentVersionId: string | null;
  publishedVersionId: string | null;
  createdAt: string;
}

interface Version {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  error: string | null;
  logs: Array<{ message: string; createdAt: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, tenant, user, setSubscription, logout } = useAuthStore();

  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch user data to get subscription status
    authApi.me(token).then((data) => {
      setSubscription(data.subscription);
    });
  }, [token, router, setSubscription]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadSites = useCallback(async () => {
    if (!token) return;
    try {
      const data = await sitesApi.list(token);
      setSites(data);

      // Auto-select site from URL or first site
      const urlSiteId = searchParams.get('site');
      const siteToSelect = urlSiteId ? data.find(s => s.id === urlSiteId) : data[0];
      if (siteToSelect) {
        loadSiteDetails(siteToSelect.id);
      }
    } catch (err) {
      console.error('Failed to load sites:', err);
    } finally {
      setLoading(false);
    }
  }, [token, searchParams]);

  const loadSiteDetails = async (siteId: string) => {
    if (!token) return;
    try {
      const data = await sitesApi.get(siteId, token);
      setSelectedSite(data.site);
      setVersions(data.versions);
      setActiveJob(data.activeJob as Job | null);
    } catch (err) {
      console.error('Failed to load site details:', err);
    }
  };

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Poll for job status
  useEffect(() => {
    if (!activeJob || !token || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await jobsApi.get(activeJob.id, token);
        setActiveJob(job);

        if (job.status === 'completed' || job.status === 'failed') {
          // Reload site details
          if (selectedSite) {
            loadSiteDetails(selectedSite.id);
          }
        }
      } catch (err) {
        console.error('Failed to poll job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, token, selectedSite]);

  const handlePublish = async () => {
    if (!token || !selectedSite) return;
    setPublishing(true);
    try {
      const result = await sitesApi.publish(selectedSite.id, token);
      // Start polling for the new job
      const job = await jobsApi.get(result.jobId, token);
      setActiveJob(job);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (versionId: string) => {
    if (!token || !selectedSite) return;
    if (!confirm('Are you sure you want to rollback to this version?')) return;

    setRollingBack(true);
    try {
      const result = await sitesApi.rollback(selectedSite.id, versionId, token);
      const job = await jobsApi.get(result.jobId, token);
      setActiveJob(job);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rollback');
    } finally {
      setRollingBack(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold" style={{ color: tenant?.primaryColor }}>
            {tenant?.name || 'Website Builder'}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/billing" className="text-gray-600 hover:text-gray-900">
              Billing
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {sites.length === 0 ? (
          /* No sites - prompt to create */
          <div className="text-center py-16">
            <h1 className="text-3xl font-bold mb-4">Welcome!</h1>
            <p className="text-gray-600 mb-8">
              You don't have any websites yet. Let's create your first one!
            </p>
            <Link href="/onboarding" className="btn-primary">
              Create Your Website
            </Link>
          </div>
        ) : (
          /* Site Dashboard */
          <div>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Website Overview</h1>
              <Link href="/onboarding" className="btn-secondary text-base py-2 px-4">
                + New Website
              </Link>
            </div>

            {/* Site selector if multiple sites */}
            {sites.length > 1 && (
              <div className="mb-6">
                <select
                  value={selectedSite?.id || ''}
                  onChange={(e) => loadSiteDetails(e.target.value)}
                  className="input max-w-xs"
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSite && (
              <div className="space-y-6">
                {/* Active Job Status */}
                {activeJob && (activeJob.status === 'pending' || activeJob.status === 'running') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <div>
                        <div className="font-medium">
                          {activeJob.type === 'provision' && 'Setting up your website...'}
                          {activeJob.type === 'generate' && 'Generating content with AI...'}
                          {activeJob.type === 'publish' && 'Publishing to WordPress...'}
                          {activeJob.type === 'rollback' && 'Rolling back...'}
                        </div>
                        {activeJob.logs && activeJob.logs.length > 0 && (
                          <div className="text-sm text-blue-600 mt-1">
                            {activeJob.logs[activeJob.logs.length - 1].message}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Site Status Card */}
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold">{selectedSite.name}</h2>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        selectedSite.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : selectedSite.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : selectedSite.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {selectedSite.status}
                    </span>
                  </div>

                  {selectedSite.wpSiteUrl && (
                    <div className="mb-6">
                      <a
                        href={selectedSite.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedSite.wpSiteUrl}
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-4">
                    {selectedSite.wpSiteUrl && (
                      <a
                        href={selectedSite.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-base py-3 px-6"
                      >
                        Preview Site
                      </a>
                    )}

                    {selectedSite.currentVersionId && selectedSite.status !== 'provisioning' && (
                      <Link
                        href={`/editor/${selectedSite.id}`}
                        className="btn-primary text-base py-3 px-6"
                      >
                        Edit Website
                      </Link>
                    )}

                    {selectedSite.status === 'draft' && (
                      <button
                        onClick={handlePublish}
                        disabled={publishing || !!activeJob}
                        className="btn-primary text-base py-3 px-6 disabled:opacity-50"
                      >
                        {publishing ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Version History */}
                {versions.length > 0 && (
                  <div className="bg-white rounded-xl border p-6">
                    <h3 className="text-lg font-bold mb-4">Version History</h3>
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                        >
                          <div>
                            <span className="font-medium">Version {version.versionNumber}</span>
                            <span className="text-gray-500 ml-3 text-sm">
                              {new Date(version.createdAt).toLocaleString()}
                            </span>
                            {version.id === selectedSite.publishedVersionId && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                                Published
                              </span>
                            )}
                            {version.id === selectedSite.currentVersionId && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
                                Current
                              </span>
                            )}
                          </div>
                          {version.id !== selectedSite.currentVersionId && (
                            <button
                              onClick={() => handleRollback(version.id)}
                              disabled={rollingBack || !!activeJob}
                              className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Rollback
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
