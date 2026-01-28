'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { authApi, tenantApi } from '@/lib/api';

export default function LoginPage() {
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
      // Use default if tenant not found
      setTenant({ name: 'Website Builder', primaryColor: '#2563EB', logoUrl: null });
    });
  }, [tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authApi.login(email, password, tenantSlug);
      setAuth(result.token, result.user, result.tenant);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Set tenant color as CSS variable
  useEffect(() => {
    if (tenant?.primaryColor) {
      document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
    }
  }, [tenant]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name} className="h-12 mx-auto mb-4" />
          ) : (
            <div className="text-3xl font-bold mb-2" style={{ color: tenant?.primaryColor }}>
              {tenant?.name || 'Website Builder'}
            </div>
          )}
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-gray-600">
          Don't have an account?{' '}
          <Link href={`/signup?tenant=${tenantSlug}`} className="font-medium" style={{ color: tenant?.primaryColor }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
