import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AdminLoginPageProps {
  notice?: string | null;
  onBackToStorefront: () => void;
}

export function AdminLoginPage({ notice, onBackToStorefront }: AdminLoginPageProps) {
  const { signInAdmin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both your admin email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await signInAdmin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const activeMessage = error || notice;

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-3 sm:px-6 py-8 bg-slate-50">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
            TechnHobbies Store Management
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Admin Sign In
          </h1>
          <p className="text-xs sm:text-sm text-slate-600">
            Sign in with the authorized TechnHobbies administrator email and password.
          </p>
        </div>

        {activeMessage && (
          <div
            role="alert"
            className="bg-rose-50 border border-rose-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-rose-900"
          >
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{activeMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-700">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter authorized admin email"
              className="w-full px-3.5 py-2.5 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-3.5 pr-12 py-2.5 min-h-[44px] text-base md:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-md focus-visible:outline-2 focus-visible:outline-orange-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg"
          >
            {submitting ? 'Signing In...' : 'Sign In to Admin Dashboard'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
            <p>
              Protected by Firebase Authentication and server-side Firestore Security Rules.
              Unauthorized accounts are automatically signed out and redirected.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToStorefront}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to TechnHobbies Storefront</span>
          </button>
        </div>
      </div>
    </div>
  );
}
