'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, Sparkles, CheckCircle, Shield, Rocket } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { authApi, tenantApi } from '@/lib/api';

export default function SignupPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <SignupPageContent />
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
      <div className="spinner spinner-lg" />
    </div>
  );
}

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || 'demo';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tenant, setTenant] = useState<{ name: string; primaryColor: string; logoUrl: string | null } | null>(null);

  const { setAuth, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      router.push('/dashboard');
    }
  }, [token, router]);

  useEffect(() => {
    tenantApi.getBySlug(tenantSlug).then(setTenant).catch(() => {
      setTenant({ name: 'AI Website Builder', primaryColor: '#8B5CF6', logoUrl: null });
    });
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await authApi.signup(email, password, tenantSlug);
      setAuth(result.token, result.user, result.tenant);
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="decorative-blob w-96 h-96 -top-48 -right-48 animate-float" />
        <div className="decorative-blob w-[500px] h-[500px] -bottom-64 -left-64 animate-float" style={{ animationDelay: '1s' }} />
        <div className="decorative-blob w-64 h-64 bottom-1/4 right-1/4 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 decorative-grid opacity-40" />
      </div>

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Signup Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
          <div className="w-full max-w-md animate-slide-up">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">{tenant?.name || 'AI Website Builder'}</span>
            </div>

            {/* Signup Card */}
            <div className="glass-card p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
                <p className="text-gray-600">Start building your website today</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-600 text-xs">!</span>
                  </div>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="email" className="label">Email address</label>
                  <div className="relative">
                    <Mail className="input-icon w-5 h-5" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input input-with-icon"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <label htmlFor="password" className="label">Password</label>
                  <div className="relative">
                    <Lock className="input-icon w-5 h-5" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input input-with-icon"
                      placeholder="At least 8 characters"
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Must be at least 8 characters</p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="spinner" />
                      Creating account...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      Get Started Free
                      <ArrowRight className="w-5 h-5" />
                    </span>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Already have an account?</span>
                </div>
              </div>

              {/* Sign In Link */}
              <Link
                href={`/login?tenant=${tenantSlug}`}
                className="btn-secondary w-full justify-center"
              >
                Sign in instead
              </Link>
            </div>

            {/* Footer */}
            <p className="mt-8 text-center text-sm text-gray-500">
              By signing up, you agree to our{' '}
              <a href="#" className="text-purple-400 hover:text-purple-300">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-purple-400 hover:text-purple-300">Privacy Policy</a>
            </p>
          </div>
        </div>

        {/* Right Side - Features */}
        <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 xl:px-24">
          <div className="animate-fade-in">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">{tenant?.name || 'AI Website Builder'}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl xl:text-5xl font-bold text-white mb-6 leading-tight">
              Your website,
              <br />
              <span className="text-gradient">powered by AI</span>
            </h1>

            <p className="text-lg text-gray-400 mb-12 max-w-md">
              Join thousands of businesses building professional websites in minutes.
            </p>

            {/* Benefits List */}
            <div className="space-y-4">
              <BenefitItem
                icon={<Rocket className="w-5 h-5" />}
                text="Launch your website in under 5 minutes"
              />
              <BenefitItem
                icon={<CheckCircle className="w-5 h-5" />}
                text="No coding or design skills required"
              />
              <BenefitItem
                icon={<Shield className="w-5 h-5" />}
                text="Secure WordPress hosting included"
              />
            </div>

            {/* Stats */}
            <div className="mt-12 flex gap-12">
              <div>
                <div className="text-3xl font-bold text-white">10k+</div>
                <div className="text-gray-400 text-sm">Websites created</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">98%</div>
                <div className="text-gray-400 text-sm">Customer satisfaction</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">24/7</div>
                <div className="text-gray-400 text-sm">Support available</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center text-emerald-400 flex-shrink-0">
        {icon}
      </div>
      <span className="text-gray-300">{text}</span>
    </div>
  );
}
