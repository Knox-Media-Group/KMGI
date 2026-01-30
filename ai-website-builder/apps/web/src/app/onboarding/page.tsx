'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWizardStore } from '@/lib/store';
import { sitesApi, billingApi } from '@/lib/api';
import { STYLE_PRESETS, INDUSTRIES, PRIMARY_CTA_OPTIONS, DEFAULT_ACCENT_COLORS } from '@builder/shared';
import type { SiteSettings } from '@builder/shared';

const TOTAL_STEPS = 8;

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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold mb-4">Subscribe to Continue</h1>
          <p className="text-gray-600 mb-8">
            You need an active subscription to create and publish websites.
          </p>

          <div className="bg-white p-8 rounded-xl shadow-sm border mb-6">
            <div className="text-4xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
              $29<span className="text-lg font-normal text-gray-500">/month</span>
            </div>
            <ul className="text-left text-gray-600 space-y-2 mt-4">
              <li>✓ Unlimited websites</li>
              <li>✓ AI content generation</li>
              <li>✓ WordPress hosting</li>
              <li>✓ Priority support</li>
            </ul>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Redirecting...' : 'Subscribe Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%`, backgroundColor: tenant?.primaryColor }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white p-8 rounded-xl shadow-sm border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
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
              primaryColor={tenant?.primaryColor}
            />
          )}

          {step === 5 && (
            <Step5
              value={data.accentColor || tenant?.primaryColor || '#2563EB'}
              onChange={(accentColor) => updateData({ accentColor })}
            />
          )}

          {step === 6 && (
            <Step6
              value={data.primaryCta || 'call'}
              onChange={(primaryCta) => updateData({ primaryCta: primaryCta as SiteSettings['primaryCta'] })}
              primaryColor={tenant?.primaryColor}
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
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="px-6 py-3 text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid(step, data)}
                className="btn-primary disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !isStepValid(step, data)}
                className="btn-primary disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Generate My Website'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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
      <h2 className="text-2xl font-bold mb-2">What's your business name?</h2>
      <p className="text-gray-600 mb-6">This will be displayed on your website.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input text-xl"
        placeholder="Acme Corp"
        autoFocus
      />
    </div>
  );
}

function Step2({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">What industry are you in?</h2>
      <p className="text-gray-600 mb-6">This helps us generate relevant content.</p>
      <div className="grid grid-cols-2 gap-3">
        {INDUSTRIES.map((industry) => (
          <button
            key={industry}
            onClick={() => onChange(industry)}
            className={`p-4 text-left rounded-lg border-2 transition-colors ${
              value === industry
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {industry}
          </button>
        ))}
      </div>
    </div>
  );
}

function Step3({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Describe your website</h2>
      <p className="text-gray-600 mb-6">
        Tell us what you want. The more detail you provide, the better the AI can tailor your site.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input min-h-[160px] resize-y"
        placeholder="e.g. We're a local bakery specializing in custom wedding cakes and pastries. We want to showcase our gallery, highlight our most popular items, include pricing tiers, and make it easy for customers to place orders or book tastings."
        autoFocus
      />
      <p className="mt-2 text-sm text-gray-400">
        {value.length < 10 ? 'At least 10 characters required' : `${value.length} characters`}
      </p>
    </div>
  );
}

function Step4({ value, onChange, primaryColor }: { value: string; onChange: (v: string) => void; primaryColor?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Choose a style</h2>
      <p className="text-gray-600 mb-6">Pick the look that best represents your brand.</p>
      <div className="grid grid-cols-2 gap-3">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={`p-4 text-left rounded-lg border-2 transition-colors ${
              value === preset.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">{preset.label}</div>
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
      <h2 className="text-2xl font-bold mb-2">Pick your accent color</h2>
      <p className="text-gray-600 mb-6">This will be used for buttons and highlights.</p>
      <div className="flex flex-wrap gap-4 mb-6">
        {DEFAULT_ACCENT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-14 h-14 rounded-full border-4 transition-transform ${
              value === color ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-600">Custom:</label>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input w-32"
          placeholder="#2563EB"
        />
      </div>
    </div>
  );
}

function Step6({ value, onChange, primaryColor }: { value: string; onChange: (v: string) => void; primaryColor?: string }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">What should visitors do?</h2>
      <p className="text-gray-600 mb-6">Choose your main call-to-action.</p>
      <div className="space-y-3">
        {PRIMARY_CTA_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`w-full p-4 text-left rounded-lg border-2 transition-colors ${
              value === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-semibold">{option.label}</div>
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
      <h2 className="text-2xl font-bold mb-2">Contact information</h2>
      <p className="text-gray-600 mb-6">How should customers reach you?</p>
      <div className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            className="input"
            placeholder="hello@example.com"
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="input"
            placeholder="+1 555-0123"
          />
        </div>
      </div>
    </div>
  );
}

function Step8({ data }: { data: Record<string, unknown> }) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Ready to generate!</h2>
      <p className="text-gray-600 mb-6">Here's a summary of your choices:</p>

      <div className="bg-gray-50 rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">Business Name:</span>
          <span className="font-medium">{data.businessName as string}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Industry:</span>
          <span className="font-medium">{data.industry as string}</span>
        </div>
        <div>
          <span className="text-gray-600">Description:</span>
          <p className="font-medium text-sm mt-1">{data.description as string}</p>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Style:</span>
          <span className="font-medium capitalize">{data.stylePreset as string}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Accent Color:</span>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full border"
              style={{ backgroundColor: data.accentColor as string }}
            />
            <span className="font-medium">{data.accentColor as string}</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Primary CTA:</span>
          <span className="font-medium capitalize">
            {data.primaryCta === 'call' ? 'Call Us' : data.primaryCta === 'book' ? 'Book Appointment' : 'Get a Quote'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Contact:</span>
          <span className="font-medium">{data.contactEmail as string}</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Click "Generate My Website" to create your site. AI will generate your pages based on your description.
      </p>
    </div>
  );
}
