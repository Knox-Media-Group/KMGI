'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Shield, HardDrive, Activity, Database, Globe, RefreshCw,
  CheckCircle, AlertTriangle, XCircle, Loader2, Download, Upload,
  Lock, Unlock, Server, Clock, Wifi, ChevronRight, Settings,
  Zap, BarChart3, CloudOff, Cloud, Plus, Trash2, RotateCcw,
  ExternalLink, Copy, Info, TrendingUp
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { hostingApi, HostingStatus, DomainInfo } from '@/lib/api';

type Tab = 'overview' | 'ssl' | 'backups' | 'domain' | 'storage';

export default function HostingDashboard() {
  const params = useParams();
  const router = useRouter();
  const siteId = params.siteId as string;
  const { token } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [hosting, setHosting] = useState<HostingStatus | null>(null);
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [domain, setDomain] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadHostingData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const status = await hostingApi.getStatus(siteId, domain || 'localhost', token);
      setHosting(status);
      if (status.domain && status.domain !== 'localhost') {
        setDomain(status.domain);
        const dInfo = await hostingApi.getDomain(status.domain, token);
        setDomainInfo(dInfo);
      }
    } catch {
      // Use mock data if API fails
      setHosting(getMockHosting());
    } finally {
      setLoading(false);
    }
  }, [siteId, domain, token]);

  useEffect(() => { loadHostingData(); }, [loadHostingData]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateBackup = async (type: 'full' | 'database' | 'files') => {
    if (!token) return;
    setActionLoading('backup');
    try {
      const result = await hostingApi.createBackup(siteId, type, token);
      if (result.success) {
        showMessage('success', result.message);
        loadHostingData();
      } else {
        showMessage('error', result.message);
      }
    } catch {
      showMessage('error', 'Failed to create backup');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!token || !confirm('Are you sure you want to restore this backup? Current site content will be replaced.')) return;
    setActionLoading(`restore-${backupId}`);
    try {
      const result = await hostingApi.restoreBackup(siteId, backupId, token);
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch {
      showMessage('error', 'Failed to restore backup');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProvisionSSL = async () => {
    if (!token || !domain) return;
    setActionLoading('ssl');
    try {
      const result = await hostingApi.provisionSSL(domain, token);
      showMessage(result.success ? 'success' : 'error', result.message);
      if (result.success) loadHostingData();
    } catch {
      showMessage('error', 'Failed to provision SSL');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnectDomain = async () => {
    if (!token || !newDomain) return;
    setActionLoading('domain');
    try {
      const result = await hostingApi.connectDomain(siteId, newDomain, token);
      if (result.success) {
        showMessage('success', result.message);
        setDomain(newDomain);
        setNewDomain('');
        loadHostingData();
      }
    } catch {
      showMessage('error', 'Failed to connect domain');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateWP = async () => {
    if (!token) return;
    setActionLoading('update');
    try {
      const result = await hostingApi.updateWordPress(siteId, domain, token);
      showMessage(result.success ? 'success' : 'error', result.message);
    } catch {
      showMessage('error', 'Failed to update WordPress');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading hosting dashboard...</p>
        </div>
      </div>
    );
  }

  const h = hosting || getMockHosting();

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'ssl', label: 'SSL & Security', icon: Shield },
    { id: 'backups', label: 'Backups', icon: Database },
    { id: 'domain', label: 'Domain', icon: Globe },
    { id: 'storage', label: 'Storage', icon: HardDrive },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Managed Hosting</h1>
              <p className="text-sm text-gray-500">{h.domain || 'No domain connected'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </div>
            <span className="text-sm text-gray-500">
              {h.uptime.uptimePercentage}% uptime
            </span>
          </div>
        </div>
      </header>

      {/* Message toast */}
      {message && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
          message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
                activeTab === tab.id
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Activity}
                label="Response Time"
                value={`${h.uptime.responseTime}ms`}
                subtitle="Average"
                color="blue"
              />
              <StatCard
                icon={Shield}
                label="SSL Grade"
                value={h.ssl.grade}
                subtitle={h.ssl.enabled ? 'Secure' : 'Not secure'}
                color="green"
              />
              <StatCard
                icon={HardDrive}
                label="Storage Used"
                value={`${h.storage.percentage}%`}
                subtitle={`${h.storage.used}MB / ${h.storage.total}MB`}
                color="purple"
              />
              <StatCard
                icon={Database}
                label="Last Backup"
                value={h.backups.lastBackup ? timeAgo(new Date(h.backups.lastBackup)) : 'Never'}
                subtitle={h.backups.autoBackup ? 'Auto-backup on' : 'Manual only'}
                color="amber"
              />
            </div>

            {/* Server info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Server Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoRow label="PHP Version" value={h.phpVersion} />
                <InfoRow label="WordPress Version" value={h.wordpressVersion} />
                <InfoRow label="Server Location" value={h.serverLocation} />
                <InfoRow label="SSL Provider" value={h.ssl.provider} />
                <InfoRow label="Backup Frequency" value={h.backups.frequency} />
                <InfoRow label="Backup Retention" value={`${h.backups.retention} days`} />
              </div>
              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={handleUpdateWP}
                  disabled={actionLoading === 'update'}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium transition"
                >
                  {actionLoading === 'update' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Update WordPress
                </button>
              </div>
            </div>

            {/* Uptime chart placeholder */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Uptime Monitor</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm text-gray-600">Online</span>
                </div>
                <span className="text-sm text-gray-500">
                  {h.uptime.checksLast24h} checks in last 24h · {h.uptime.failedChecks} failed
                </span>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 90 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-8 flex-1 rounded-sm ${
                      i === 45 && h.uptime.failedChecks > 0
                        ? 'bg-red-400'
                        : 'bg-emerald-400'
                    }`}
                    title={`Day ${90 - i}: Online`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>90 days ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ssl' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">SSL Certificate</h2>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  h.ssl.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                }`}>
                  {h.ssl.enabled ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {h.ssl.enabled ? 'Active' : 'Not Active'}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <InfoRow label="Provider" value={h.ssl.provider} />
                  <InfoRow label="Grade" value={h.ssl.grade} />
                  <InfoRow label="Auto-Renew" value={h.ssl.autoRenew ? 'Enabled' : 'Disabled'} />
                  <InfoRow
                    label="Expires"
                    value={h.ssl.expiresAt ? new Date(h.ssl.expiresAt).toLocaleDateString() : 'N/A'}
                  />
                </div>
                <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                    <Shield className="w-10 h-10 text-emerald-600" />
                  </div>
                  <span className="text-4xl font-bold text-emerald-700">{h.ssl.grade}</span>
                  <span className="text-sm text-emerald-600 mt-1">Security Grade</span>
                </div>
              </div>

              {!h.ssl.enabled && (
                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={handleProvisionSSL}
                    disabled={actionLoading === 'ssl' || !domain}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {actionLoading === 'ssl' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Provision SSL Certificate
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'backups' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Backups</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {h.backups.frequency} backups · {h.backups.retention} day retention
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCreateBackup('full')}
                    disabled={actionLoading === 'backup'}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium transition"
                  >
                    {actionLoading === 'backup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Backup
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {h.backups.backups.map((backup) => (
                  <div
                    key={backup.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        backup.status === 'completed' ? 'bg-emerald-100' : backup.status === 'in_progress' ? 'bg-amber-100' : 'bg-red-100'
                      }`}>
                        {backup.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : backup.status === 'in_progress' ? (
                          <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {backup.type === 'full' ? 'Full Backup' : backup.type === 'database' ? 'Database Only' : 'Files Only'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(backup.createdAt).toLocaleString()} · {backup.size}MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreBackup(backup.id)}
                        disabled={actionLoading === `restore-${backup.id}` || backup.status !== 'completed'}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition"
                      >
                        {actionLoading === `restore-${backup.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'domain' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Domain Management</h2>

              {domain ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <Globe className="w-6 h-6 text-emerald-600" />
                    <div>
                      <p className="font-medium text-emerald-800">{domain}</p>
                      <p className="text-sm text-emerald-600">Connected and active</p>
                    </div>
                  </div>

                  {domainInfo && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">DNS Records</h3>
                      <div className="space-y-2">
                        <DNSRow type="A" name="@" value={domainInfo.dns.aRecord} />
                        <DNSRow type="CNAME" name="www" value={domainInfo.dns.cnameRecord} />
                        {domainInfo.dns.nameservers.map((ns, i) => (
                          <DNSRow key={i} type="NS" name={`ns${i + 1}`} value={ns} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Connect a custom domain to your website.</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="yourdomain.com"
                      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleConnectDomain}
                      disabled={actionLoading === 'domain' || !newDomain}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 text-sm font-medium transition"
                    >
                      {actionLoading === 'domain' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                      Connect
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Storage Usage</h2>

              {/* Storage bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{h.storage.used}MB used</span>
                  <span className="text-gray-400">{h.storage.total}MB total</span>
                </div>
                <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      h.storage.percentage > 80 ? 'bg-red-500' : h.storage.percentage > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${h.storage.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{h.storage.percentage}% used</p>
              </div>

              {/* Breakdown */}
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Storage Breakdown</h3>
              <div className="space-y-3">
                <StorageRow label="WordPress Core" size={h.storage.breakdown.wordpress} total={h.storage.used} color="bg-blue-500" />
                <StorageRow label="Media Uploads" size={h.storage.breakdown.uploads} total={h.storage.used} color="bg-purple-500" />
                <StorageRow label="Database" size={h.storage.breakdown.database} total={h.storage.used} color="bg-emerald-500" />
                <StorageRow label="Plugins" size={h.storage.breakdown.plugins} total={h.storage.used} color="bg-amber-500" />
                <StorageRow label="Themes" size={h.storage.breakdown.themes} total={h.storage.used} color="bg-pink-500" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components

function StatCard({ icon: Icon, label, value, subtitle, color }: {
  icon: typeof Activity;
  label: string;
  value: string;
  subtitle: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function DNSRow({ type, name, value }: { type: string; name: string; value: string }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg font-mono text-sm">
      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-semibold">{type}</span>
      <span className="text-gray-600 w-16">{name}</span>
      <span className="text-gray-900 flex-1">{value}</span>
      <button
        onClick={() => navigator.clipboard.writeText(value)}
        className="text-gray-400 hover:text-gray-600 transition"
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

function StorageRow({ label, size, total, color }: { label: string; size: number; total: number; color: string }) {
  const pct = Math.round((size / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-900 font-medium">{size}MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getMockHosting(): HostingStatus {
  return {
    siteId: 'mock',
    domain: 'example.com',
    ssl: {
      enabled: true,
      provider: "Let's Encrypt",
      expiresAt: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString(),
      autoRenew: true,
      grade: 'A+',
    },
    uptime: {
      current: true,
      uptimePercentage: 99.97,
      lastDowntime: null,
      responseTime: 285,
      checksLast24h: 288,
      failedChecks: 0,
    },
    storage: {
      used: 1200,
      total: 25000,
      percentage: 5,
      breakdown: { wordpress: 350, uploads: 650, database: 85, plugins: 80, themes: 35 },
    },
    backups: {
      lastBackup: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      nextBackup: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      frequency: 'daily',
      retention: 30,
      autoBackup: true,
      backups: [
        { id: 'bk-1', createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), size: 245, type: 'full', status: 'completed' },
        { id: 'bk-2', createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(), size: 242, type: 'full', status: 'completed' },
        { id: 'bk-3', createdAt: new Date(Date.now() - 54 * 60 * 60 * 1000).toISOString(), size: 238, type: 'full', status: 'completed' },
      ],
    },
    phpVersion: '8.2',
    wordpressVersion: '6.5',
    serverLocation: 'US East (Virginia)',
  };
}
