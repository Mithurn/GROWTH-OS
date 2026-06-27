'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess('Check your email to confirm your account, then sign in.');
        setMode('signin');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push('/');
        router.refresh();
      }
    }

    setLoading(false);
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="GrowthOS" width={120} height={40} className="object-contain" />
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8">
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1A1A1A]">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              {mode === 'signin'
                ? 'Sign in to your GrowthOS workspace'
                : 'Start growing your retail business with AI'}
            </p>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#1A1A1A] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50 mb-5"
          >
            {googleLoading ? (
              <span className="h-4 w-4 border-2 border-[#6B7280] border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-xs text-[#9CA3AF]">or</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-[#374151]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="rounded-xl border-[#E5E7EB] focus:border-[#5B4FFF] focus:ring-[#5B4FFF]/20 h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-[#374151]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="rounded-xl border-[#E5E7EB] focus:border-[#5B4FFF] focus:ring-[#5B4FFF]/20 h-10"
              />
            </div>

            {/* Error / Success */}
            {error && (
              <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            {success && (
              <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#5B4FFF] hover:bg-[#4B3FE5] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Toggle */}
          <p className="text-center text-sm text-[#6B7280] mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setSuccess(null); }}
              className="text-[#5B4FFF] font-medium hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          AI-powered growth for retail marketers
        </p>
      </div>
    </div>
  );
}
