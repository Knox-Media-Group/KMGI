'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Briefcase,
  UtensilsCrossed,
  Home,
  HeartPulse,
  Monitor,
  Dumbbell,
  Scale,
  GraduationCap,
  ShoppingBag,
  Scissors,
  HardHat,
  Car,
  Landmark,
  Wrench,
  Megaphone,
  Heart,
  Camera,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  Check,
  Zap,
  Shield,
  Crown,
  CreditCard,
  Mail,
  Phone,
  FileText,
  Palette,
  Type,
  CheckSquare,
  MessageSquare,
  HelpCircle,
  BookOpen,
  ShoppingCart,
  Wand2,
  CircleDot,
} from 'lucide-react';
import { useAuthStore, useWizardStore } from '@/lib/store';
import { sitesApi, billingApi } from '@/lib/api';
import { INDUSTRIES, DEFAULT_ACCENT_COLORS } from '@builder/shared';
import type { StylePreset } from '@builder/shared';

// ---------------------------------------------------------------------------
// TYPES & DATA
// ---------------------------------------------------------------------------

interface ToneOption {
  id: string;
  label: string;
  subtitle: string;
  sampleHeadline: string;
  icon: string;
}

interface StyleOption {
  id: StylePreset;
  label: string;
  description: string;
  fontHeading: string;
  fontBody: string;
  previewBg: string;
  previewAccent: string;
}

interface PageOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  recommended: boolean;
  alwaysOn?: boolean;
}

const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'professional',
    label: 'Professional',
    subtitle: 'Corporate, trustworthy',
    sampleHeadline: 'Delivering Excellence in Every Solution',
    icon: 'briefcase',
  },
  {
    id: 'friendly',
    label: 'Friendly',
    subtitle: 'Warm, approachable',
    sampleHeadline: 'Hey there! We\'re here to help you succeed',
    icon: 'smile',
  },
  {
    id: 'bold',
    label: 'Bold',
    subtitle: 'Confident, dynamic',
    sampleHeadline: 'DOMINATE Your Industry. Start Now.',
    icon: 'zap',
  },
  {
    id: 'playful',
    label: 'Playful',
    subtitle: 'Fun, energetic',
    sampleHeadline: 'Ready for something awesome? Let\'s go!',
    icon: 'party',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    subtitle: 'Sophisticated, refined',
    sampleHeadline: 'Where Quality Meets Timeless Distinction',
    icon: 'gem',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    subtitle: 'Clean, simple',
    sampleHeadline: 'Less noise. More results.',
    icon: 'minus',
  },
];

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean lines, bold typography, spacious layouts',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    previewBg: '#F8FAFC',
    previewAccent: '#6366F1',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Timeless elegance, serif fonts, warm tones',
    fontHeading: 'font-serif',
    fontBody: 'font-serif',
    previewBg: '#FFFBEB',
    previewAccent: '#B45309',
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Strong colors, large elements, high contrast',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    previewBg: '#0F172A',
    previewAccent: '#F59E0B',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Whitespace-driven, subtle details, focused',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    previewBg: '#FFFFFF',
    previewAccent: '#18181B',
  },
  {
    id: 'playful',
    label: 'Playful',
    description: 'Vibrant colors, rounded shapes, fun energy',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    previewBg: '#FDF4FF',
    previewAccent: '#D946EF',
  },
  {
    id: 'professional',
    label: 'Professional',
    description: 'Corporate feel, structured grids, trust signals',
    fontHeading: 'font-sans',
    fontBody: 'font-sans',
    previewBg: '#F0F9FF',
    previewAccent: '#0369A1',
  },
];

const PAGE_OPTIONS: PageOption[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Your main landing page with hero section',
    icon: <Home className="w-5 h-5" />,
    recommended: true,
    alwaysOn: true,
  },
  {
    id: 'about',
    label: 'About',
    description: 'Tell your story and build trust',
    icon: <FileText className="w-5 h-5" />,
    recommended: true,
  },
  {
    id: 'services',
    label: 'Services',
    description: 'Showcase what you offer',
    icon: <Briefcase className="w-5 h-5" />,
    recommended: true,
  },
  {
    id: 'contact',
    label: 'Contact',
    description: 'Let visitors reach you easily',
    icon: <Mail className="w-5 h-5" />,
    recommended: true,
  },
  {
    id: 'faq',
    label: 'FAQ',
    description: 'Answer common questions upfront',
    icon: <HelpCircle className="w-5 h-5" />,
    recommended: false,
  },
  {
    id: 'blog',
    label: 'Blog',
    description: 'Share news, tips, and updates',
    icon: <BookOpen className="w-5 h-5" />,
    recommended: false,
  },
  {
    id: 'shop',
    label: 'Shop',
    description: 'Sell products directly on your site',
    icon: <ShoppingCart className="w-5 h-5" />,
    recommended: false,
  },
];

const INDUSTRY_ICON_MAP: Record<string, React.ReactNode> = {
  'Restaurant': <UtensilsCrossed className="w-5 h-5" />,
  'Retail': <ShoppingBag className="w-5 h-5" />,
  'Healthcare': <HeartPulse className="w-5 h-5" />,
  'Real Estate': <Home className="w-5 h-5" />,
  'Legal': <Scale className="w-5 h-5" />,
  'Consulting': <Landmark className="w-5 h-5" />,
  'Fitness': <Dumbbell className="w-5 h-5" />,
  'Beauty & Spa': <Scissors className="w-5 h-5" />,
  'Photography': <Camera className="w-5 h-5" />,
  'Construction': <HardHat className="w-5 h-5" />,
  'Technology': <Monitor className="w-5 h-5" />,
  'Education': <GraduationCap className="w-5 h-5" />,
  'Automotive': <Car className="w-5 h-5" />,
  'Financial Services': <Landmark className="w-5 h-5" />,
  'Home Services': <Wrench className="w-5 h-5" />,
  'Marketing Agency': <Megaphone className="w-5 h-5" />,
  'Non-Profit': <Heart className="w-5 h-5" />,
  'Other': <MoreHorizontal className="w-5 h-5" />,
};

const GENERATION_STEPS = [
  { label: 'Analyzing your business...', duration: 2200 },
  { label: 'Generating content...', duration: 2800 },
  { label: 'Designing pages...', duration: 3000 },
  { label: 'Optimizing for SEO...', duration: 1800 },
  { label: 'Adding finishing touches...', duration: 1500 },
];

const TOTAL_STEPS = 5;

// ---------------------------------------------------------------------------
// MAIN COMPONENT
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const { token, tenant } = useAuthStore();
  const { step, data, setStep, updateData, reset } = useWizardStore();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // Derived state from wizard data for our new fields
  const [tone, setTone] = useState<string>(
    (data as Record<string, unknown>).tone as string || ''
  );
  const [selectedPages, setSelectedPages] = useState<string[]>(
    ((data as Record<string, unknown>).selectedPages as string[]) || ['home', 'about', 'services', 'contact']
  );

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
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

  // Reset step to 1 on mount if we're beyond the range
  useEffect(() => {
    if (step > TOTAL_STEPS) {
      setStep(1);
    }
  }, [step, setStep]);

  const handleNext = useCallback(() => {
    if (step < TOTAL_STEPS) {
      setDirection('forward');
      setStep(step + 1);
    }
  }, [step, setStep]);

  const handleBack = useCallback(() => {
    if (step > 1) {
      setDirection('backward');
      setStep(step - 1);
    }
  }, [step, setStep]);

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

  const handleGenerate = async () => {
    if (!token) return;

    // Move to generation step
    setDirection('forward');
    setStep(5);
  };

  const handleSubmitFromGeneration = useCallback(async () => {
    if (!token) return;

    const settings = {
      businessName: data.businessName || '',
      industry: data.industry || 'Other',
      description: data.description || '',
      stylePreset: data.stylePreset || 'modern',
      accentColor: data.accentColor || '#8B5CF6',
      primaryCta: data.primaryCta || 'call',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
    };

    try {
      const result = await sitesApi.create(settings, token);
      reset();
      router.push(`/dashboard?site=${result.site.id}&job=${result.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create site');
      setStep(4); // Go back to pages step on error
    }
  }, [token, data, reset, router, setStep]);

  const isCurrentStepValid = useCallback((): boolean => {
    switch (step) {
      case 1:
        return !!(data.businessName && (data.businessName as string).length >= 2 && data.industry);
      case 2:
        return !!tone;
      case 3:
        return !!data.stylePreset;
      case 4:
        return selectedPages.length >= 1;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, data, tone, selectedPages]);

  // Subscription required screen
  if (needsSubscription) {
    return (
      <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="decorative-blob w-96 h-96 -top-48 -right-48 animate-float" />
          <div className="decorative-blob w-[500px] h-[500px] -bottom-64 -left-64 animate-float" style={{ animationDelay: '1s' }} />
          <div className="absolute inset-0 decorative-grid opacity-40" />
        </div>
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-lg animate-slide-up">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-glow">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Unlock Your Potential</h1>
              <p className="text-gray-400 text-lg">Subscribe to create unlimited AI-powered websites</p>
            </div>
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
                {[
                  'Unlimited AI-generated websites',
                  'AI content & copy generation',
                  'Managed WordPress hosting',
                  'Custom domain support',
                  'Priority support',
                  'Version history & rollback',
                ].map((text) => (
                  <li key={text} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-gray-700">{text}</span>
                  </li>
                ))}
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">
                {tenant?.name || 'AI Website Builder'}
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100"
            >
              Exit
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Top Progress Bar */}
        {step < 5 && (
          <div className="mb-10">
            {/* Step labels */}
            <div className="hidden sm:flex items-center justify-between mb-3 px-1">
              {['About You', 'Tone', 'Style', 'Pages'].map((label, i) => {
                const stepNum = i + 1;
                const isActive = step === stepNum;
                const isComplete = step > stepNum;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      if (step > stepNum) {
                        setDirection('backward');
                        setStep(stepNum);
                      }
                    }}
                    disabled={step <= stepNum}
                    className={`text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-purple-700'
                        : isComplete
                          ? 'text-purple-500 cursor-pointer hover:text-purple-700'
                          : 'text-gray-400'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isComplete
                            ? 'bg-purple-600 text-white'
                            : isActive
                              ? 'bg-purple-600 text-white ring-4 ring-purple-100'
                              : 'bg-gray-200 text-gray-500'
                        }`}
                      >
                        {isComplete ? <Check className="w-3.5 h-3.5" /> : stepNum}
                      </span>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${((step - 1) / (TOTAL_STEPS - 2)) * 100}%` }}
              />
            </div>

            {/* Mobile step indicator */}
            <div className="sm:hidden text-center mt-4">
              <span className="text-sm font-medium text-purple-600">
                Step {step} of 4 &mdash;{' '}
                {['About You', 'Tone', 'Style', 'Pages'][step - 1]}
              </span>
            </div>
          </div>
        )}

        {/* Step Content with animation */}
        <div
          className="transition-all duration-500 ease-out"
          style={{
            animation:
              step < 5
                ? direction === 'forward'
                  ? 'slideInRight 0.4s ease-out'
                  : 'slideInLeft 0.4s ease-out'
                : 'fadeIn 0.6s ease-out',
          }}
          key={step}
        >
          {error && step !== 5 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 text-xs font-bold">!</span>
              </div>
              {error}
            </div>
          )}

          {step === 1 && (
            <StepBusiness
              businessName={data.businessName || ''}
              industry={data.industry || ''}
              description={data.description || ''}
              contactEmail={data.contactEmail || ''}
              contactPhone={data.contactPhone || ''}
              onBusinessNameChange={(v) => updateData({ businessName: v })}
              onIndustryChange={(v) => updateData({ industry: v })}
              onDescriptionChange={(v) => updateData({ description: v })}
              onEmailChange={(v) => updateData({ contactEmail: v })}
              onPhoneChange={(v) => updateData({ contactPhone: v })}
            />
          )}

          {step === 2 && (
            <StepTone
              value={tone}
              onChange={(v) => {
                setTone(v);
                updateData({ description: `${data.description || ''}\n[Tone: ${v}]`.replace(/\n\[Tone:.*\]/, `\n[Tone: ${v}]`) } as never);
              }}
            />
          )}

          {step === 3 && (
            <StepStyle
              stylePreset={data.stylePreset || 'modern'}
              accentColor={data.accentColor || tenant?.primaryColor || '#8B5CF6'}
              onStyleChange={(v) => updateData({ stylePreset: v as StylePreset })}
              onAccentChange={(v) => updateData({ accentColor: v })}
            />
          )}

          {step === 4 && (
            <StepPages
              selectedPages={selectedPages}
              onChange={(pages) => setSelectedPages(pages)}
            />
          )}

          {step === 5 && (
            <StepGenerating
              onComplete={handleSubmitFromGeneration}
              error={error}
            />
          )}
        </div>

        {/* Navigation Footer */}
        {step < 5 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-40">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 px-5 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all text-sm font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  disabled={!isCurrentStepValid()}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : step === 4 ? (
                <button
                  onClick={handleGenerate}
                  disabled={!isCurrentStepValid() || loading}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  <Wand2 className="w-4 h-4" />
                  Generate My Website
                </button>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Inline keyframe animations */}
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.98);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes progressPulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
        @keyframes spinSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes checkPop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 1 - TELL US ABOUT YOUR BUSINESS
// ---------------------------------------------------------------------------

function StepBusiness({
  businessName,
  industry,
  description,
  contactEmail,
  contactPhone,
  onBusinessNameChange,
  onIndustryChange,
  onDescriptionChange,
  onEmailChange,
  onPhoneChange,
}: {
  businessName: string;
  industry: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  onBusinessNameChange: (v: string) => void;
  onIndustryChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Section Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-2xl mb-4">
          <Building2 className="w-7 h-7 text-purple-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Tell us about your business
        </h1>
        <p className="text-gray-500 text-lg">
          We will use this to generate tailored content for your website.
        </p>
      </div>

      <div className="space-y-6">
        {/* Business Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Business Name
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => onBusinessNameChange(e.target.value)}
            className="w-full px-4 py-3.5 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 bg-white"
            placeholder="e.g., Acme Corporation"
            autoFocus
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Industry
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {INDUSTRIES.map((ind) => (
              <button
                key={ind}
                onClick={() => onIndustryChange(ind)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  industry === ind
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm'
                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50 text-gray-700'
                }`}
              >
                <span className={`flex-shrink-0 ${industry === ind ? 'text-purple-600' : 'text-gray-400'}`}>
                  {INDUSTRY_ICON_MAP[ind] || <Building2 className="w-5 h-5" />}
                </span>
                <span className="truncate">{ind}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Brief Description
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 bg-white resize-y min-h-[100px]"
            placeholder="What does your business do? What makes it special?"
            rows={3}
          />
        </div>

        {/* Contact Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contact Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 bg-white text-sm"
                placeholder="hello@business.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => onPhoneChange(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all placeholder:text-gray-400 bg-white text-sm"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 2 - CHOOSE YOUR TONE OF VOICE
// ---------------------------------------------------------------------------

function StepTone({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-2xl mb-4">
          <MessageSquare className="w-7 h-7 text-purple-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Choose your tone of voice
        </h1>
        <p className="text-gray-500 text-lg">
          This sets the personality for all the copy on your website.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TONE_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 group ${
                isSelected
                  ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/10'
                  : 'border-gray-200 hover:border-purple-300 hover:bg-white hover:shadow-md bg-white'
              }`}
            >
              {/* Selection Indicator */}
              <div
                className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-500'
                    : 'border-gray-300 group-hover:border-purple-400'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" />}
              </div>

              <div className={`text-lg font-bold mb-1 ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                {opt.label}
              </div>
              <div className="text-sm text-gray-500 mb-4">{opt.subtitle}</div>

              {/* Sample Headline */}
              <div
                className={`text-sm italic leading-relaxed pt-4 border-t ${
                  isSelected
                    ? 'border-purple-200 text-purple-600'
                    : 'border-gray-100 text-gray-400'
                }`}
              >
                &ldquo;{opt.sampleHeadline}&rdquo;
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 3 - PICK YOUR STYLE
// ---------------------------------------------------------------------------

function StepStyle({
  stylePreset,
  accentColor,
  onStyleChange,
  onAccentChange,
}: {
  stylePreset: string;
  accentColor: string;
  onStyleChange: (v: string) => void;
  onAccentChange: (v: string) => void;
}) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-2xl mb-4">
          <Palette className="w-7 h-7 text-purple-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Pick your style
        </h1>
        <p className="text-gray-500 text-lg">
          Choose a visual theme and accent color for your website.
        </p>
      </div>

      {/* Style Preset Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {STYLE_OPTIONS.map((opt) => {
          const isSelected = stylePreset === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onStyleChange(opt.id)}
              className={`relative text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 group ${
                isSelected
                  ? 'border-purple-500 shadow-lg shadow-purple-500/10'
                  : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
              }`}
            >
              {/* Mini Website Preview */}
              <div
                className="h-32 sm:h-40 relative overflow-hidden"
                style={{ backgroundColor: opt.previewBg }}
              >
                {/* Mock navigation bar */}
                <div
                  className="h-6 flex items-center px-3 gap-1.5"
                  style={{
                    backgroundColor:
                      opt.id === 'bold' ? '#1E293B' : opt.id === 'minimal' ? '#FAFAFA' : `${opt.previewAccent}15`,
                  }}
                >
                  <div
                    className="w-12 h-2 rounded-full"
                    style={{ backgroundColor: opt.previewAccent, opacity: 0.6 }}
                  />
                  <div className="flex-1" />
                  <div
                    className="w-6 h-1.5 rounded-full opacity-30"
                    style={{ backgroundColor: opt.id === 'bold' ? '#FFF' : '#000' }}
                  />
                  <div
                    className="w-6 h-1.5 rounded-full opacity-30"
                    style={{ backgroundColor: opt.id === 'bold' ? '#FFF' : '#000' }}
                  />
                  <div
                    className="w-6 h-1.5 rounded-full opacity-30"
                    style={{ backgroundColor: opt.id === 'bold' ? '#FFF' : '#000' }}
                  />
                </div>

                {/* Mock hero section */}
                <div className="px-4 pt-4 sm:pt-6 text-center">
                  <div
                    className="h-3 sm:h-4 rounded-full mx-auto mb-2"
                    style={{
                      backgroundColor: opt.id === 'bold' ? '#FFFFFF' : '#1F2937',
                      width: '65%',
                      opacity: 0.8,
                    }}
                  />
                  <div
                    className="h-2 rounded-full mx-auto mb-3"
                    style={{
                      backgroundColor: opt.id === 'bold' ? '#FFFFFF' : '#6B7280',
                      width: '45%',
                      opacity: 0.4,
                    }}
                  />
                  <div
                    className="h-5 sm:h-6 w-16 sm:w-20 rounded-md mx-auto"
                    style={{ backgroundColor: opt.previewAccent }}
                  />
                </div>

                {/* Mock content blocks */}
                <div className="px-4 pt-4 flex justify-center gap-2">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="w-12 sm:w-16 h-8 sm:h-10 rounded"
                      style={{
                        backgroundColor: opt.id === 'bold' ? '#334155' : '#F3F4F6',
                      }}
                    />
                  ))}
                </div>

                {/* Selection overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
                    <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="p-4 bg-white">
                <div className={`font-bold text-sm ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                  {opt.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Accent Color Picker */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CircleDot className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-gray-900">Accent Color</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {DEFAULT_ACCENT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onAccentChange(color)}
              className={`w-10 h-10 rounded-xl transition-all duration-200 ${
                accentColor === color
                  ? 'ring-4 ring-offset-2 ring-purple-500 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}

          {/* Custom color input */}
          <div className="flex items-center gap-2 ml-2 pl-4 border-l border-gray-200">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => onAccentChange(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200 p-0.5"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => onAccentChange(e.target.value)}
              className="w-24 px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
              placeholder="#8B5CF6"
            />
          </div>
        </div>

        {/* Font Pairing Preview */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <Type className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Typography Preview</h3>
          </div>

          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: STYLE_OPTIONS.find((s) => s.id === stylePreset)?.previewBg || '#F8FAFC' }}
          >
            <h2
              className={`text-2xl font-bold mb-2 ${
                stylePreset === 'classic' ? 'font-serif' : 'font-sans'
              }`}
              style={{
                color: stylePreset === 'bold' ? '#FFFFFF' : '#111827',
              }}
            >
              Your Business Headline
            </h2>
            <p
              className={`text-base leading-relaxed ${stylePreset === 'classic' ? 'font-serif' : 'font-sans'}`}
              style={{
                color: stylePreset === 'bold' ? '#CBD5E1' : '#6B7280',
              }}
            >
              This is how your body text will look. We pair elegant headings with
              readable body text to create a polished, professional feel.
            </p>
            <div
              className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold"
              style={{ backgroundColor: accentColor }}
            >
              Call to Action
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 4 - SELECT YOUR PAGES
// ---------------------------------------------------------------------------

function StepPages({
  selectedPages,
  onChange,
}: {
  selectedPages: string[];
  onChange: (pages: string[]) => void;
}) {
  const toggle = (pageId: string) => {
    if (pageId === 'home') return; // home is always selected
    if (selectedPages.includes(pageId)) {
      onChange(selectedPages.filter((p) => p !== pageId));
    } else {
      onChange([...selectedPages, pageId]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-purple-100 rounded-2xl mb-4">
          <CheckSquare className="w-7 h-7 text-purple-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          Select your pages
        </h1>
        <p className="text-gray-500 text-lg">
          Choose which pages to include. You can always add more later.
        </p>
      </div>

      <div className="space-y-3">
        {PAGE_OPTIONS.map((page) => {
          const isSelected = selectedPages.includes(page.id);
          const isLocked = page.alwaysOn;

          return (
            <button
              key={page.id}
              onClick={() => toggle(page.id)}
              disabled={isLocked}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? 'border-purple-500 bg-purple-50/70'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {/* Checkbox */}
              <div
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected
                    ? 'bg-purple-600 border-purple-600'
                    : 'border-gray-300'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </div>

              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {page.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${isSelected ? 'text-purple-700' : 'text-gray-900'}`}>
                    {page.label}
                  </span>
                  {page.recommended && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                  {isLocked && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Required
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">{page.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-center text-sm text-gray-400">
        {selectedPages.length} page{selectedPages.length !== 1 ? 's' : ''} selected
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// STEP 5 - GENERATING YOUR WEBSITE
// ---------------------------------------------------------------------------

function StepGenerating({
  onComplete,
  error,
}: {
  onComplete: () => void;
  error: string;
}) {
  const [currentGenStep, setCurrentGenStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    let totalElapsed = 0;
    const totalDuration = GENERATION_STEPS.reduce((sum, s) => sum + s.duration, 0);

    // Progress each generation step sequentially
    const runSteps = async () => {
      for (let i = 0; i < GENERATION_STEPS.length; i++) {
        setCurrentGenStep(i);

        // Animate progress within this step
        const stepDuration = GENERATION_STEPS[i].duration;
        const stepStart = totalElapsed;
        const stepEnd = totalElapsed + stepDuration;
        const startTime = Date.now();

        await new Promise<void>((resolve) => {
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const stepProgress = Math.min(elapsed / stepDuration, 1);
            const overall = ((stepStart + stepDuration * stepProgress) / totalDuration) * 100;
            setOverallProgress(Math.min(overall, 100));

            if (stepProgress < 1) {
              requestAnimationFrame(tick);
            } else {
              resolve();
            }
          };
          requestAnimationFrame(tick);
        });

        totalElapsed = stepEnd;
        setCompletedSteps((prev) => [...prev, i]);
      }

      setOverallProgress(100);
      // Small delay before triggering actual API call
      setTimeout(() => {
        onComplete();
      }, 600);
    };

    runSteps();
  }, [onComplete]);

  return (
    <div className="max-w-lg mx-auto py-12 text-center">
      {/* Circular Progress */}
      <div className="relative w-40 h-40 mx-auto mb-10">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - overallProgress / 100)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
          />
          <defs>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">
            {Math.round(overallProgress)}%
          </span>
        </div>

        {/* Spinning outer ring decoration */}
        <div
          className="absolute inset-[-8px] rounded-full border-2 border-dashed border-purple-200"
          style={{ animation: 'spinSlow 12s linear infinite' }}
        />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
        Generating your website...
      </h1>
      <p className="text-gray-500 mb-10">
        Sit tight while our AI builds your perfect site.
      </p>

      {/* Steps List */}
      <div className="text-left bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        {GENERATION_STEPS.map((genStep, i) => {
          const isComplete = completedSteps.includes(i);
          const isCurrent = currentGenStep === i && !isComplete;

          return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {isComplete ? (
                  <div
                    className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center"
                    style={{ animation: 'checkPop 0.3s ease-out' }}
                  >
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                  </div>
                )}
              </div>
              <span
                className={`text-sm font-medium transition-colors ${
                  isComplete
                    ? 'text-emerald-600'
                    : isCurrent
                      ? 'text-purple-700'
                      : 'text-gray-400'
                }`}
              >
                {genStep.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
