'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  CreditCard,
  Check,
  Crown,
  Zap,
  Shield,
  Globe,
  Loader2,
  Calendar,
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  XCircle,
  LogOut,
  HelpCircle,
  Mail
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { billingApi } from '@/lib/api';

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BillingPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
      <div className="text-center">
        <div className="spinner spinner-lg mx-auto mb-4" />
        <p className="text-gray-500">Loading billing...</p>
      </div>
    </div>
  );
}

function BillingPageContent() {
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
              <Link href="/dashboard" className="btn-ghost">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Dashboard</span>
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow-sm">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing & Subscription</h1>
              <p className="text-gray-600">Manage your plan and payment details</p>
            </div>
          </div>
        </div>

        {/* Checkout Result Banners */}
        {checkoutResult === 'success' && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 animate-slide-up">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="font-semibold text-emerald-800">Subscription Activated!</div>
              <div className="text-sm text-emerald-700">Your subscription is now active. Start creating unlimited websites!</div>
            </div>
          </div>
        )}
        {checkoutResult === 'canceled' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 animate-slide-up">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="font-semibold text-amber-800">Checkout Canceled</div>
              <div className="text-sm text-amber-700">No worries! Subscribe anytime to unlock all features.</div>
            </div>
          </div>
        )}

        {/* Subscription Status Card */}
        <div className="card mb-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <Crown className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-gray-900">Subscription Status</h2>
          </div>

          {billingStatus?.hasSubscription ? (
            <div>
              {/* Active Subscription */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-800 text-lg">Pro Plan</span>
                      <span className="badge-success capitalize">
                        {billingStatus.subscription?.status || 'Active'}
                      </span>
                    </div>
                    {billingStatus.subscription?.currentPeriodEnd && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 mt-1">
                        <Calendar className="w-4 h-4" />
                        Renews on {new Date(billingStatus.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-emerald-700">$29</div>
                  <div className="text-sm text-emerald-600">/month</div>
                </div>
              </div>

              {/* Features included */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <FeatureItem icon={<Globe className="w-4 h-4" />} text="Unlimited websites" />
                <FeatureItem icon={<Sparkles className="w-4 h-4" />} text="AI content generation" />
                <FeatureItem icon={<Shield className="w-4 h-4" />} text="Managed WordPress hosting" />
                <FeatureItem icon={<Zap className="w-4 h-4" />} text="Priority support" />
              </div>

              {/* Manage Subscription Button */}
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="btn-secondary w-full justify-center disabled:opacity-50"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Opening Portal...
                  </>
                ) : (
                  <>
                    <Settings className="w-5 h-5" />
                    Manage Subscription
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* No Subscription */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <div className="font-semibold text-gray-700">No Active Subscription</div>
                  <div className="text-sm text-gray-500">Subscribe to unlock all features and create websites</div>
                </div>
              </div>

              {/* Pricing Card */}
              <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-purple-50 rounded-xl p-6 border border-purple-100 mb-6">
                <div className="text-center mb-6">
                  <div className="inline-block px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-3">
                    Best Value
                  </div>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-gray-900">$29</span>
                    <span className="text-gray-500">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  <PricingFeature text="Unlimited AI-generated websites" />
                  <PricingFeature text="AI content & copy generation" />
                  <PricingFeature text="Managed WordPress hosting" />
                  <PricingFeature text="Custom domain support" />
                  <PricingFeature text="Version history & rollback" />
                  <PricingFeature text="Priority email support" />
                </ul>

                <button
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="btn-primary w-full py-4 text-lg disabled:opacity-50"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redirecting to Checkout...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Subscribe Now
                    </>
                  )}
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex justify-center items-center gap-6 text-gray-400 text-sm">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Secure Payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Cancel Anytime</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Card */}
        <div className="card bg-gray-50 border-gray-200 animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-soft flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-3">
                Have questions about billing or need assistance? We're here to help.
              </p>
              <a
                href="mailto:support@example.com"
                className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <div className="text-emerald-500">{icon}</div>
      <span>{text}</span>
    </div>
  );
}

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
        <Check className="w-3 h-3 text-emerald-600" />
      </div>
      <span className="text-gray-700">{text}</span>
    </li>
  );
}
