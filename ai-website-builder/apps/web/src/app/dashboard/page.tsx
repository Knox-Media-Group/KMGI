'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Globe,
  Plus,
  ExternalLink,
  Edit3,
  Eye,
  Upload,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  CreditCard,
  LogOut,
  RotateCcw,
  Zap,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { sitesApi, jobsApi, authApi } from '@/lib/api';

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <DashboardPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <div className="text-center">
        <div className="spinner spinner-lg mx-auto mb-4" />
        <p className="text-gray-500">Loading your dashboard...</p>
      </div>
    </div>
  );
}

interface Site {
  id: string;
  name: string;
  status: string;
  wpSiteUrl: string | null;
  currentVersionId?: string | null;
  publishedVersionId?: string | null;
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

function DashboardPageContent() {
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

    authApi.me(token).then((data) => {
      setSubscription(data.subscription);
    });
  }, [token, router, setSubscription]);

  const loadSites = useCallback(async () => {
    if (!token) return;
    try {
      const data = await sitesApi.list(token);
      setSites(data);

      const urlSiteId = searchParams.get('site');
      const siteToSelect = urlSiteId ? data.find((s: Site) => s.id === urlSiteId) : data[0];
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

  useEffect(() => {
    if (!activeJob || !token || activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const job = await jobsApi.get(activeJob.id, token);
        setActiveJob(job);

        if (job.status === 'completed' || job.status === 'failed') {
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
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">
                {tenant?.name || 'AI Website Builder'}
              </span>
            </div>

            {/* Right Nav */}
            <div className="flex items-center gap-2">
              <Link
                href="/billing"
                className="btn-ghost"
              >
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Billing</span>
              </Link>

              <div className="h-6 w-px bg-gray-200 mx-2" />

              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 hidden sm:block">
                  {user?.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="btn-ghost text-gray-500 hover:text-red-600"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sites.length === 0 ? (
          /* Empty State */
          <div className="text-center py-20 animate-fade-in">
            <div className="w-20 h-20 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Welcome to your dashboard!</h1>
            <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
              You don't have any websites yet. Create your first AI-powered website in minutes.
            </p>
            <Link href="/onboarding" className="btn-primary text-lg px-8 py-4">
              <Zap className="w-5 h-5" />
              Create Your Website
            </Link>
          </div>
        ) : (
          /* Site Dashboard */
          <div className="animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Your Websites</h1>
                <p className="text-gray-600 mt-1">Manage and edit your AI-generated websites</p>
              </div>
              <Link href="/onboarding" className="btn-primary">
                <Plus className="w-5 h-5" />
                New Website
              </Link>
            </div>

            {/* Site selector if multiple sites */}
            {sites.length > 1 && (
              <div className="mb-6">
                <div className="relative inline-block">
                  <select
                    value={selectedSite?.id || ''}
                    onChange={(e) => loadSiteDetails(e.target.value)}
                    className="input pr-10 appearance-none cursor-pointer min-w-[200px]"
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {selectedSite && (
              <div className="space-y-6">
                {/* Active Job Status */}
                {activeJob && (activeJob.status === 'pending' || activeJob.status === 'running') && (
                  <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-soft">
                        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {activeJob.type === 'provision' && 'Setting up your website...'}
                          {activeJob.type === 'generate' && 'Generating content with AI...'}
                          {activeJob.type === 'publish' && 'Publishing to WordPress...'}
                          {activeJob.type === 'rollback' && 'Rolling back to previous version...'}
                        </div>
                        {activeJob.logs && activeJob.logs.length > 0 && (
                          <div className="text-sm text-purple-600 mt-1">
                            {activeJob.logs[activeJob.logs.length - 1].message}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4 progress-bar">
                      <div className="progress-bar-fill animate-pulse" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}

                {/* Site Card */}
                <div className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-subtle rounded-xl flex items-center justify-center border border-gray-100">
                        <Globe className="w-7 h-7 text-purple-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedSite.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={selectedSite.status} />
                          <span className="text-sm text-gray-500">
                            Created {new Date(selectedSite.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Site URL */}
                  {selectedSite.wpSiteUrl && !selectedSite.wpSiteUrl.includes('localhost') && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="w-5 h-5 text-gray-400" />
                        <span className="text-gray-700 font-medium">{selectedSite.wpSiteUrl}</span>
                      </div>
                      <a
                        href={selectedSite.wpSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost text-purple-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Visit
                      </a>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {selectedSite.currentVersionId && selectedSite.status !== 'provisioning' && (
                      <>
                        <Link
                          href={`/editor/${selectedSite.id}`}
                          className="btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                          Preview
                        </Link>
                        <Link
                          href={`/editor/${selectedSite.id}`}
                          className="btn-primary"
                        >
                          <Edit3 className="w-4 h-4" />
                          Edit Website
                        </Link>
                      </>
                    )}

                    {selectedSite.status === 'draft' && selectedSite.currentVersionId && (
                      <button
                        onClick={handlePublish}
                        disabled={publishing || !!activeJob}
                        className="btn-primary bg-emerald-500 hover:shadow-emerald-500/40 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
                      >
                        {publishing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Publishing...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            Publish
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Version History */}
                {versions.length > 0 && (
                  <div className="card">
                    <div className="flex items-center gap-3 mb-6">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-bold text-gray-900">Version History</h3>
                    </div>
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div
                          key={version.id}
                          className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-gray-600">
                                v{version.versionNumber}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  Version {version.versionNumber}
                                </span>
                                {version.id === selectedSite.publishedVersionId && (
                                  <span className="badge-success text-xs">
                                    <CheckCircle className="w-3 h-3" />
                                    Published
                                  </span>
                                )}
                                {version.id === selectedSite.currentVersionId && (
                                  <span className="badge-purple text-xs">Current</span>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {new Date(version.createdAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {version.id !== selectedSite.currentVersionId && (
                            <button
                              onClick={() => handleRollback(version.id)}
                              disabled={rollingBack || !!activeJob}
                              className="btn-ghost text-sm disabled:opacity-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Restore
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

function StatusBadge({ status }: { status: string }) {
  const config = {
    published: { class: 'badge-success', icon: CheckCircle, label: 'Published' },
    draft: { class: 'badge-warning', icon: Edit3, label: 'Draft' },
    provisioning: { class: 'badge-info', icon: Loader2, label: 'Setting up' },
    generating: { class: 'badge-purple', icon: Sparkles, label: 'Generating' },
    error: { class: 'badge-error', icon: AlertCircle, label: 'Error' },
  }[status] || { class: 'badge-info', icon: Clock, label: status };

  const Icon = config.icon;

  return (
    <span className={config.class}>
      <Icon className={`w-3.5 h-3.5 ${status === 'provisioning' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
