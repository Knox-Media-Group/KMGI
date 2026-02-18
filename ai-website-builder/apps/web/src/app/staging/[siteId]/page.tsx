'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, GitBranch, RefreshCw, Upload, Download, Plus, Trash2,
  CheckCircle, Clock, AlertTriangle, Loader2, ExternalLink, History,
  FileText, Puzzle, Palette, Image as ImageIcon, Settings, ArrowRight,
  XCircle, Globe, HardDrive, Server
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { stagingApi, StagingStatus, StagingChange, StagingHistoryEntry } from '@/lib/api';

export default function StagingDashboard() {
  const params = useParams();
  const siteId = params.siteId as string;
  const { token } = useAuthStore();

  const [staging, setStaging] = useState<StagingStatus | null>(null);
  const [changes, setChanges] = useState<StagingChange[]>([]);
  const [history, setHistory] = useState<StagingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const wpSiteUrl = 'https://example.com'; // Would come from site data

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [statusData, historyData] = await Promise.all([
        stagingApi.getStatus(siteId, wpSiteUrl, token),
        stagingApi.getHistory(siteId, token),
      ]);
      setStaging(statusData);
      setHistory(historyData.history);

      if (statusData.exists && statusData.stagingUrl) {
        const changesData = await stagingApi.getChanges(siteId, wpSiteUrl, statusData.stagingUrl, token);
        setChanges(changesData.changes);
      }
    } catch {
      // Use mock data
      setStaging(getMockStagingStatus(siteId));
      setChanges(getMockChanges());
      setHistory(getMockHistory());
    } finally {
      setLoading(false);
    }
  }, [siteId, token]);

  useEffect(() => { loadData(); }, [loadData]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateStaging = async () => {
    if (!token) return;
    setActionLoading('create');
    try {
      const result = await stagingApi.create(siteId, wpSiteUrl, undefined, token);
      if (result.success) {
        showMessage('success', result.message);
        loadData();
      } else {
        showMessage('error', result.message);
      }
    } catch {
      showMessage('error', 'Failed to create staging environment');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePushToProduction = async () => {
    if (!token || !staging?.stagingUrl) return;
    if (!confirm('Are you sure you want to push staging changes to production? This will overwrite your live site.')) return;
    setActionLoading('push');
    try {
      const result = await stagingApi.pushToProduction(siteId, wpSiteUrl, staging.stagingUrl, token);
      showMessage(result.success ? 'success' : 'error', result.message);
      if (result.success) loadData();
    } catch {
      showMessage('error', 'Failed to push to production');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncFromProduction = async () => {
    if (!token || !staging?.stagingUrl) return;
    if (!confirm('Are you sure you want to sync from production? This will overwrite your staging changes.')) return;
    setActionLoading('sync');
    try {
      const result = await stagingApi.syncFromProduction(siteId, wpSiteUrl, staging.stagingUrl, token);
      showMessage(result.success ? 'success' : 'error', result.message);
      if (result.success) loadData();
    } catch {
      showMessage('error', 'Failed to sync from production');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteStaging = async () => {
    if (!token || !staging?.stagingUrl) return;
    if (!confirm('Are you sure you want to delete the staging environment? All staging changes will be lost.')) return;
    setActionLoading('delete');
    try {
      const result = await stagingApi.delete(siteId, staging.stagingUrl, token);
      showMessage(result.success ? 'success' : 'error', result.message);
      if (result.success) loadData();
    } catch {
      showMessage('error', 'Failed to delete staging');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-gray-500">Loading staging environment...</p>
        </div>
      </div>
    );
  }

  const s = staging || getMockStagingStatus(siteId);

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
                <h1 className="text-xl font-bold text-gray-900">Staging Environment</h1>
                <p className="text-xs text-gray-500">Test changes before going live</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {s.exists && (
                <>
                  <a
                    href={s.stagingUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Staging
                  </a>
                  <button
                    onClick={handlePushToProduction}
                    disabled={actionLoading === 'push' || changes.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition"
                  >
                    {actionLoading === 'push' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Push to Production
                  </button>
                </>
              )}
            </div>
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!s.exists ? (
          /* No staging - show create prompt */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <GitBranch className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Staging Environment</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Create a staging environment to safely test changes before pushing them to your live site.
            </p>
            <button
              onClick={handleCreateStaging}
              disabled={actionLoading === 'create'}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 disabled:opacity-50 transition"
            >
              {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Staging Environment
            </button>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-lg text-left">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">Safe Testing</h3>
                <p className="text-xs text-gray-500">Test changes without affecting your live site</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-left">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">Easy Sync</h3>
                <p className="text-xs text-gray-500">Push or pull changes with one click</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-left">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                  <History className="w-4 h-4 text-purple-600" />
                </div>
                <h3 className="text-sm font-medium text-gray-900">Full History</h3>
                <p className="text-xs text-gray-500">Track all changes and deployments</p>
              </div>
            </div>
          </div>
        ) : (
          /* Staging exists */
          <div className="space-y-6">
            {/* Status overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Production */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Production</h2>
                      <p className="text-xs text-gray-500">Live website</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <a
                  href={s.productionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {s.productionUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Staging */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Staging</h2>
                      <p className="text-xs text-gray-500">Test environment</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {s.changes} changes
                  </span>
                </div>
                <a
                  href={s.stagingUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
                >
                  {s.stagingUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>Created {s.createdAt ? timeAgo(new Date(s.createdAt)) : 'N/A'}</span>
                  <span>Last synced {s.lastSynced ? timeAgo(new Date(s.lastSynced)) : 'Never'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={handleSyncFromProduction}
                disabled={actionLoading === 'sync'}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {actionLoading === 'sync' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Sync from Production
              </button>
              <div className="flex items-center gap-2 text-gray-400">
                <ArrowRight className="w-4 h-4" />
              </div>
              <button
                onClick={handlePushToProduction}
                disabled={actionLoading === 'push' || changes.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
              >
                {actionLoading === 'push' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Push to Production
              </button>
            </div>

            {/* Changes list */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Changes</h2>
              {changes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p>Staging is in sync with production</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {changes.map((change, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <ChangeIcon type={change.type} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{change.name}</p>
                          <p className="text-xs text-gray-500">{change.details}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          change.action === 'added' ? 'bg-emerald-100 text-emerald-700' :
                          change.action === 'modified' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {change.action}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(new Date(change.modifiedAt))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Deployment History</h2>
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        entry.action === 'push_to_production' ? 'bg-emerald-100' :
                        entry.action === 'sync_from_production' ? 'bg-blue-100' :
                        entry.action === 'create_staging' ? 'bg-purple-100' : 'bg-red-100'
                      }`}>
                        {entry.action === 'push_to_production' ? <Upload className="w-4 h-4 text-emerald-600" /> :
                         entry.action === 'sync_from_production' ? <Download className="w-4 h-4 text-blue-600" /> :
                         entry.action === 'create_staging' ? <Plus className="w-4 h-4 text-purple-600" /> :
                         <Trash2 className="w-4 h-4 text-red-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {entry.action === 'push_to_production' ? 'Pushed to production' :
                           entry.action === 'sync_from_production' ? 'Synced from production' :
                           entry.action === 'create_staging' ? 'Created staging' : 'Deleted staging'}
                        </p>
                        {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{entry.user}</p>
                      <p className="text-xs text-gray-400">{timeAgo(new Date(entry.timestamp))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delete staging */}
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-red-700">Delete Staging Environment</h3>
                  <p className="text-xs text-red-500">This will permanently delete the staging site and all its changes.</p>
                </div>
                <button
                  onClick={handleDeleteStaging}
                  disabled={actionLoading === 'delete'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                >
                  {actionLoading === 'delete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete Staging
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper components

function ChangeIcon({ type }: { type: StagingChange['type'] }) {
  const config = {
    page: { icon: FileText, color: 'bg-blue-100 text-blue-600' },
    plugin: { icon: Puzzle, color: 'bg-purple-100 text-purple-600' },
    theme: { icon: Palette, color: 'bg-pink-100 text-pink-600' },
    media: { icon: ImageIcon, color: 'bg-amber-100 text-amber-600' },
    setting: { icon: Settings, color: 'bg-gray-100 text-gray-600' },
  };

  const { icon: Icon, color } = config[type];

  return (
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
      <Icon className="w-4 h-4" />
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

// Mock data

function getMockStagingStatus(siteId: string): StagingStatus {
  return {
    exists: true,
    siteId,
    stagingUrl: 'https://staging.example.com',
    productionUrl: 'https://example.com',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    lastSynced: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    changes: 5,
    status: 'active',
    wpVersion: '6.5',
    phpVersion: '8.2',
    diskUsage: { used: 450, total: 5000, percentage: 9 },
  };
}

function getMockChanges(): StagingChange[] {
  return [
    { type: 'page', action: 'modified', name: 'Home', path: '/', modifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), details: 'Updated hero section' },
    { type: 'page', action: 'modified', name: 'About', path: '/about', modifiedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), details: 'Changed team photos' },
    { type: 'page', action: 'added', name: 'New Services', path: '/new-services', modifiedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), details: 'New page created' },
    { type: 'theme', action: 'modified', name: 'Site Theme', path: null, modifiedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), details: 'Custom CSS changes' },
    { type: 'media', action: 'added', name: 'banner.jpg', path: '/uploads/', modifiedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), details: 'New image uploaded' },
  ];
}

function getMockHistory(): StagingHistoryEntry[] {
  return [
    { id: '1', action: 'push_to_production', user: 'admin@example.com', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), changes: 8, status: 'completed', note: 'Weekly update' },
    { id: '2', action: 'sync_from_production', user: 'admin@example.com', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), changes: 0, status: 'completed', note: 'Refreshed staging' },
    { id: '3', action: 'push_to_production', user: 'admin@example.com', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), changes: 12, status: 'completed', note: 'New services page' },
    { id: '4', action: 'create_staging', user: 'admin@example.com', timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), changes: 0, status: 'completed', note: 'Initial setup' },
  ];
}
