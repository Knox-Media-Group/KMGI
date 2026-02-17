'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Briefcase,
  FileText,
  Palette,
  Paintbrush,
  MousePointerClick,
  Mail,
  Phone,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Rocket,
  CreditCard,
  Check,
  Zap,
  Shield,
  Crown
} from 'lucide-react';
import { useAuthStore, useWizardStore } from '@/lib/store';
import { sitesApi, billingApi } from '@/lib/api';
import { STYLE_PRESETS, INDUSTRIES, PRIMARY_CTA_OPTIONS, DEFAULT_ACCENT_COLORS } from '@builder/shared';
import type { SiteSettings } from '@builder/shared';

const TOTAL_STEPS = 8;

const STEP_ICONS = [
  Building2,
  Briefcase,
  FileText,
  Palette,
  Paintbrush,
  MousePointerClick,
  Mail,
  CheckCircle,
];

const STEP_LABELS = [
  'Business',
  'Industry',
  'Description',
  'Style',
  'Colors',
  'CTA',
  'Contact',
  'Review',
];

// Industry icons mapping
const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  'Restaurant': '🍽️',
  'Retail': '🛍️',
  'Healthcare': '🏥',
  'Real Estate': '🏠',
  'Legal': '⚖️',
  'Finance': '💰',
  'Technology': '💻',
  'Education': '📚',
  'Fitness': '💪',
  'Beauty': '💄',
  'Construction': '🏗️',
  'Automotive': '🚗',
  'Other': '🏢',
};

export default function OnboardingPage() {
  const router = useRouter();
  const { token, tenant, subscription } = useAuthStore();
  const { step, data, setStep, updateData, reset } = useWizardStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    // Check subscription status
    billingApi.status(token).then((status) => {
      if (!status.hasSubscription) {
        setNeedsSubscription(true);
      }
    });
  }, [token, router]);

  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubscribe = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { checkoutUrl } = await billingApi.createCheckout(token);
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!token) return;

    const settings = {
      businessName: data.businessName || '',
      industry: data.industry || 'Other',
      description: data.description || '',
      stylePreset: data.stylePreset || 'modern',
      accentColor: data.accentColor || '#2563EB',
      primaryCta: data.primaryCta || 'call',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
    };

    setLoading(true);
    setError('');

    try {
      const result = await sitesApi.create(settings, token);
      reset(); // Reset wizard state
      router.push(`/dashboard?site=${result.site.id}&job=${result.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  // Subscription required screen
  if (needsSubscription) {
    return (
      <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="decorative-blob w-96 h-96 -top-48 -right-48 animate-float" />
          <div className="decorative-blob w-[500px] h-[500px] -bottom-64 -left-64 animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute inset-0 decorative-grid opacity-40" />
        </div>

        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg animate-slide-up">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Unlock Your Potential</h1>
              <p className="text-gray-400 text-lg">
                Subscribe to create unlimited AI-powered websites
              </p>
            </div>

            {/* Pricing Card */}
            <div className="glass-card p-8 mb-6">
              <div className="text-center mb-8">
                <div className="inline-block px-4 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
                  Most Popular
                </div>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-gray-900">$29</span>
                  <span className="text-gray-500">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <PricingFeature text="Unlimited AI-generated websites" />
                <PricingFeature text="AI content & copy generation" />
                <PricingFeature text="Managed WordPress hosting" />
                <PricingFeature text="Custom domain support" />
                <PricingFeature text="Priority support" />
                <PricingFeature text="Version history & rollback" />
              </ul>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 text-xs">!</span>
                  </div>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubscribe}
                disabled={loading}
                className="btn-primary w-full py-4 text-lg disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Subscribe Now
                  </span>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center shadow-glow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">
                {tenant?.name || 'AI Website Builder'}
              </span>
            </Link>
            <Link href="/dashboard" className="btn-ghost text-sm">
              Exit
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step Indicators */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between relative">
            {/* Progress line background */}
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200" />
            {/* Progress line fill */}
            <div
              className="absolute left-0 top-5 h-0.5 bg-gradient-primary transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
            />

            {STEP_ICONS.map((Icon, index) => {
              const stepNum = index + 1;
              const isActive = step === stepNum;
              const isCompleted = step > stepNum;

              return (
                <div
                  key={index}
                  className="relative z-10 flex flex-col items-center"
                >
                  <button
                    onClick={() => step > stepNum && setStep(stepNum)}
                    disabled={step <= stepNum}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? 'bg-gradient-primary text-white shadow-glow-sm cursor-pointer'
                        : isActive
                          ? 'bg-gradient-primary text-white shadow-glow animate-pulse-glow'
                          : 'bg-white border-2 border-gray-200 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </button>
                  <span className={`mt-2 text-xs font-medium hidden sm:block ${
                    isActive || isCompleted ? 'text-purple-600' : 'text-gray-400'
                  }`}>
                    {STEP_LABELS[index]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile step indicator */}
          <div className="sm:hidden text-center mt-4">
            <span className="text-sm font-medium text-purple-600">
              Step {step}: {STEP_LABELS[step - 1]}
            </span>
          </div>
        </div>

        {/* Step Content */}
        <div className="card animate-slide-up" key={step}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-xs">!</span>
              </div>
              {error}
            </div>
          )}

          {step === 1 && (
            <Step1
              value={data.businessName || ''}
              onChange={(businessName) => updateData({ businessName })}
            />
          )}

          {step === 2 && (
            <Step2
              value={data.industry || ''}
              onChange={(industry) => updateData({ industry })}
            />
          )}

          {step === 3 && (
            <Step3
              value={data.description || ''}
              onChange={(description) => updateData({ description })}
            />
          )}

          {step === 4 && (
            <Step4
              value={data.stylePreset || 'modern'}
              onChange={(stylePreset) => updateData({ stylePreset: stylePreset as SiteSettings['stylePreset'] })}
            />
          )}

          {step === 5 && (
            <Step5
              value={data.accentColor || tenant?.primaryColor || '#8B5CF6'}
              onChange={(accentColor) => updateData({ accentColor })}
            />
          )}

          {step === 6 && (
            <Step6
              value={data.primaryCta || 'call'}
              onChange={(primaryCta) => updateData({ primaryCta: primaryCta as SiteSettings['primaryCta'] })}
            />
          )}

          {step === 7 && (
            <Step7
              email={data.contactEmail || ''}
              phone={data.contactPhone || ''}
              onEmailChange={(contactEmail) => updateData({ contactEmail })}
              onPhoneChange={(contactPhone) => updateData({ contactPhone })}
            />
          )}

          {step === 8 && (
            <Step8 data={data} />
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="btn-secondary"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid(step, data)}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !isStepValid(step, data)}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Rocket className="w-5 h-5" />
                    Generate My Website
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function PricingFeature({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
        <Check className="w-4 h-4 text-emerald-600" />
      </div>
      <span className="text-gray-700">{text}</span>
    </li>
  );
}

function isStepValid(step: number, data: Record<string, unknown>): boolean {
  switch (step) {
    case 1:
      return !!data.businessName && (data.businessName as string).length >= 2;
    case 2:
      return !!data.industry;
    case 3:
      return !!data.description && (data.description as string).length >= 10;
    case 4:
      return !!data.stylePreset;
    case 5:
      return !!data.accentColor;
    case 6:
      return !!data.primaryCta;
    case 7:
      return !!data.contactEmail && !!data.contactPhone;
    case 8:
      return true;
    default:
      return false;
  }
}

// Step Components
function Step1({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Building2 className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">What's your business name?</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">This will be displayed prominently on your website.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-xl"
        placeholder="e.g., Acme Corporation"
        autoFocus
      />
    </div>
  );
}

function Step2({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Briefcase className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">What industry are you in?</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">This helps our AI generate relevant content for your business.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {INDUSTRIES.map((industry) => (
          <button
            key={industry}
            onClick={() => onChange(industry)}
            className={`p-4 text-left rounded-xl border-2 transition-all duration-200 ${
              value === industry
                ? 'border-purple-500 bg-purple-50 shadow-soft'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
            }`}
          >
            <span className="text-2xl mb-2 block">{INDUSTRY_ICONS[industry] || '🏢'}</span>
            <span className={`font-medium ${value === industry ? 'text-purple-700' : 'text-gray-700'}`}>
              {industry}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Describe your website</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">
        Tell us what you want. The more detail you provide, the better our AI can tailor your site.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input min-h-[180px] resize-y"
        placeholder="e.g., We're a local bakery specializing in custom wedding cakes and pastries. We want to showcase our gallery, highlight our most popular items, include pricing tiers, and make it easy for customers to place orders or book tastings."
        autoFocus
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {value.length < 10 ? 'At least 10 characters required' : ''}
        </p>
        <p className={`text-sm ${value.length >= 10 ? 'text-emerald-600' : 'text-gray-400'}`}>
          {value.length} characters
        </p>
      </div>
    </div>
  );
}

function Step4({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const styleIcons: Record<string, React.ReactNode> = {
    modern: '✨',
    classic: '🏛️',
    bold: '⚡',
    minimal: '◻️',
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Palette className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Choose a style</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">Pick the visual style that best represents your brand.</p>
      <div className="grid grid-cols-2 gap-4">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={`p-6 text-left rounded-xl border-2 transition-all duration-200 ${
              value === preset.value
                ? 'border-purple-500 bg-purple-50 shadow-soft'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
            }`}
          >
            <span className="text-3xl mb-3 block">{styleIcons[preset.value] || '🎨'}</span>
            <div className={`font-semibold text-lg mb-1 ${value === preset.value ? 'text-purple-700' : 'text-gray-900'}`}>
              {preset.label}
            </div>
            <div className="text-sm text-gray-500">{preset.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step5({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Paintbrush className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Pick your accent color</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">This will be used for buttons, links, and highlights.</p>

      <div className="space-y-6">
        {/* Color swatches */}
        <div className="flex flex-wrap gap-4 justify-center p-6 bg-gray-50 rounded-xl">
          {DEFAULT_ACCENT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange(color)}
              className={`w-14 h-14 rounded-xl shadow-soft transition-all duration-200 ${
                value === color
                  ? 'ring-4 ring-offset-2 ring-purple-500 scale-110'
                  : 'hover:scale-105 hover:shadow-medium'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        {/* Custom color picker */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
          <span className="text-sm font-medium text-gray-600">Custom color:</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input w-32 text-center font-mono"
            placeholder="#8B5CF6"
          />

          {/* Color preview */}
          <div className="flex-1 flex justify-end">
            <div
              className="px-6 py-3 rounded-xl text-white font-semibold shadow-soft"
              style={{ backgroundColor: value }}
            >
              Preview Button
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step6({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ctaIcons: Record<string, React.ReactNode> = {
    call: <Phone className="w-6 h-6" />,
    book: <CheckCircle className="w-6 h-6" />,
    quote: <FileText className="w-6 h-6" />,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <MousePointerClick className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">What should visitors do?</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">Choose your primary call-to-action button.</p>
      <div className="space-y-3">
        {PRIMARY_CTA_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full p-5 text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-4 ${
              value === option.value
                ? 'border-purple-500 bg-purple-50 shadow-soft'
                : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
            }`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              value === option.value ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {ctaIcons[option.value]}
            </div>
            <div>
              <div className={`font-semibold text-lg ${value === option.value ? 'text-purple-700' : 'text-gray-900'}`}>
                {option.label}
              </div>
              <div className="text-sm text-gray-500">
                {option.value === 'call' && 'Perfect for service businesses that prefer phone contact'}
                {option.value === 'book' && 'Great for appointments, consultations, or reservations'}
                {option.value === 'quote' && 'Ideal for custom pricing or project inquiries'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Step7({
  email,
  phone,
  onEmailChange,
  onPhoneChange,
}: {
  email: string;
  phone: string;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Mail className="w-5 h-5 text-purple-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Contact information</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">How should customers reach you?</p>
      <div className="space-y-5">
        <div>
          <label className="label">Email address</label>
          <div className="relative">
            <Mail className="input-icon w-5 h-5" />
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              className="input input-with-icon"
              placeholder="hello@yourbusiness.com"
            />
          </div>
        </div>
        <div>
          <label className="label">Phone number</label>
          <div className="relative">
            <Phone className="input-icon w-5 h-5" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="input input-with-icon"
              placeholder="+1 (555) 123-4567"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step8({ data }: { data: Record<string, unknown> }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Rocket className="w-5 h-5 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Ready to launch!</h2>
      </div>
      <p className="text-gray-600 mb-6 ml-[52px]">Review your choices before we generate your website.</p>

      <div className="bg-gradient-subtle rounded-xl p-6 space-y-4">
        <SummaryRow label="Business Name" value={data.businessName as string} />
        <SummaryRow label="Industry" value={data.industry as string} />

        <div className="py-3 border-t border-gray-200">
          <span className="text-sm text-gray-500">Description</span>
          <p className="font-medium text-gray-900 mt-1 text-sm leading-relaxed">{data.description as string}</p>
        </div>

        <SummaryRow label="Style" value={(data.stylePreset as string)?.charAt(0).toUpperCase() + (data.stylePreset as string)?.slice(1)} />

        <div className="flex justify-between items-center py-3 border-t border-gray-200">
          <span className="text-sm text-gray-500">Accent Color</span>
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg shadow-soft border border-gray-200"
              style={{ backgroundColor: data.accentColor as string }}
            />
            <span className="font-medium text-gray-900 font-mono text-sm">{data.accentColor as string}</span>
          </div>
        </div>

        <SummaryRow
          label="Primary CTA"
          value={data.primaryCta === 'call' ? 'Call Us' : data.primaryCta === 'book' ? 'Book Appointment' : 'Get a Quote'}
        />
        <SummaryRow label="Email" value={data.contactEmail as string} />
        <SummaryRow label="Phone" value={data.contactPhone as string} />
      </div>

      <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-700">
            <strong>What happens next?</strong> Our AI will generate a complete website with custom content, images, and styling based on your choices. This usually takes a minute or two.
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-t border-gray-200 first:border-t-0 first:pt-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
