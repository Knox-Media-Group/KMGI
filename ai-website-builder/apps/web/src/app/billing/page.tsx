'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { billingApi } from '@/lib/api';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, tenant, user, subscription, setSubscription, logout } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<{
    hasSubscription: boolean;
    subscription: { status: string; currentPeriodEnd: string } | null;
  } | null>(null);

  // Check for checkout result in URL
  const checkoutResult = searchParams.get('checkout');

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    loadBillingStatus();
  }, [token, router]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const loadBillingStatus = async () => {
    if (!token) return;
    try {
      const status = await billingApi.status(token);
      setBillingStatus(status);
      setSubscription(status.subscription);
    } catch (err) {
      console.error('Failed to load billing status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!token) return;
    setPortalLoading(true);
    try {
      const { portalUrl } = await billingApi.createPortal(token);
      if (portalUrl) {
        window.location.href = portalUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!token) return;
    setCheckoutLoading(true);
    try {
      const { checkoutUrl } = await billingApi.createCheckout(token);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setCheckoutLoading(false);
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
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">{user?.email}</span>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Billing</h1>

        {/* Checkout Result Banner */}
        {checkoutResult === 'success' && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg">
            Your subscription is now active! You can start creating websites.
          </div>
        )}
        {checkoutResult === 'canceled' && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            Checkout was canceled. Subscribe to unlock all features.
          </div>
        )}

        {/* Subscription Status Card */}
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Subscription Status</h2>

          {billingStatus?.hasSubscription ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  {billingStatus.subscription?.status || 'Active'}
                </span>
              </div>

              {billingStatus.subscription?.currentPeriodEnd && (
                <p className="text-gray-600 mb-6">
                  Next billing date:{' '}
                  <strong>
                    {new Date(billingStatus.subscription.currentPeriodEnd).toLocaleDateString()}
                  </strong>
                </p>
              )}

              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="btn-secondary text-base py-3 px-6 disabled:opacity-50"
              >
                {portalLoading ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-6">
                You don't have an active subscription. Subscribe to create and publish websites.
              </p>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="text-3xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
                  $29<span className="text-lg font-normal text-gray-500">/month</span>
                </div>
                <ul className="text-gray-600 space-y-2">
                  <li>✓ Unlimited websites</li>
                  <li>✓ AI content generation</li>
                  <li>✓ WordPress hosting</li>
                  <li>✓ Priority support</li>
                </ul>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading}
                className="btn-primary w-full disabled:opacity-50"
              >
                {checkoutLoading ? 'Redirecting...' : 'Subscribe Now'}
              </button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="text-center text-gray-500 text-sm">
          <p>
            Need help?{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
