import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  MailCheck,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AdminLoginPageProps {
  notice?: string | null;
  onBackToStorefront: () => void;
}

export function AdminLoginPage({ notice, onBackToStorefront }: AdminLoginPageProps) {
  const {
    user,
    needsEmailVerification,
    signInAdmin,
    sendVerification,
    refreshUser,
    logoutAdmin,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sendingVerification, setSendingVerification] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

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

  const handleSendVerification = async () => {
    setSendingVerification(true);
    setVerificationMessage(null);
    try {
      await sendVerification();
      setVerificationMessage({
        type: 'success',
        text: `Verification email sent to ${user?.email}. Open the verification link in your inbox, then click "Refresh Verification Status".`,
      });
    } catch (err) {
      setVerificationMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send verification email.',
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    setCheckingVerification(true);
    setVerificationMessage(null);
    try {
      const verified = await refreshUser();
      if (!verified) {
        setVerificationMessage({
          type: 'error',
          text: 'Email is not verified yet. Please click the verification link in your inbox first, then check again.',
        });
      }
    } catch (err) {
      setVerificationMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to refresh authentication status.',
      });
    } finally {
      setCheckingVerification(false);
    }
  };

  const activeMessage = error || notice;

  if (needsEmailVerification && user) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-3 sm:px-6 py-8 bg-slate-50">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-5">
          <div className="space-y-2 text-center">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">
              Admin Session Verification
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Email Verification Required
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Signed in as <span className="font-mono font-semibold text-slate-900">{user.email}</span>.
              To protect Cloud Firestore writes, the Admin Dashboard requires a verified email address.
            </p>
          </div>

          {verificationMessage && (
            <div
              role="status"
              className={`rounded-lg p-3.5 flex items-start gap-2.5 text-xs border ${
                verificationMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {verificationMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
              )}
              <p className="leading-relaxed">{verificationMessage.text}</p>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={sendingVerification}
              onClick={handleSendVerification}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-60 rounded-lg"
            >
              <MailCheck className="w-4 h-4" />
              <span>
                {sendingVerification ? 'Sending Verification Email...' : 'Send Verification Email'}
              </span>
            </button>

            <button
              type="button"
              disabled={checkingVerification}
              onClick={handleRefreshVerification}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 min-h-[44px] text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg"
            >
              <RefreshCw className={`w-4 h-4 ${checkingVerification ? 'animate-spin' : ''}`} />
              <span>
                {checkingVerification ? 'Checking Status...' : 'Refresh Verification Status'}
              </span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-2.5">
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

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
              Protected by Firebase Authentication (verified admin only) and server-side Cloud
              Firestore Security Rules. Public account registration is disabled.
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
