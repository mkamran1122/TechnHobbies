import {
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  ADMIN_EMAIL,
  auth,
  isAuthorizedAdminEmail,
  isAuthorizedAdminUser,
  persistenceReady,
} from '../firebase';
import { ensureAdminProfileAndLog } from '../services/firestoreCatalogService';

interface AuthContextValue {
  user: User | null;
  isAdmin: boolean;
  needsEmailVerification: boolean;
  authLoading: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  signInAdmin: (email: string, password: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many failed sign-in attempts. Please wait a few minutes before retrying.';
    case 'auth/user-disabled':
      return 'This administrator account has been disabled in Firebase Authentication.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method → Email/Password).';
    case 'auth/network-request-failed':
      return 'Network error while contacting Firebase Authentication. Check your connection and try again.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Unable to sign in right now. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [, setAuthVersion] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !isAuthorizedAdminEmail(currentUser)) {
        try {
          await signOut(auth);
        } catch {
          // Ignore sign-out errors during unauthorized enforcement
        }
        setUser(null);
        setAuthNotice(
          `Access denied: Only the authorized administrator (${ADMIN_EMAIL}) can access the Admin Dashboard.`
        );
        setAuthLoading(false);
        return;
      }

      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthNotice = useCallback(() => {
    setAuthNotice(null);
  }, []);

  const signInAdmin = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim();
    if (trimmedEmail.toLowerCase() !== ADMIN_EMAIL) {
      throw new Error(
        `Access restricted. Only ${ADMIN_EMAIL} is authorized to access the TechnHobbies Admin Dashboard.`
      );
    }

    try {
      await persistenceReady;
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      if (!isAuthorizedAdminEmail(credential.user)) {
        await signOut(auth);
        throw new Error(
          `Access denied. Only ${ADMIN_EMAIL} is authorized to access the TechnHobbies Admin Dashboard.`
        );
      }
      setAuthNotice(null);
      setUser(credential.user);
      if (credential.user.emailVerified) {
        void ensureAdminProfileAndLog(credential.user, 'ADMIN_LOGIN');
      }
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error));
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    if (isAuthorizedAdminUser(auth.currentUser)) {
      await ensureAdminProfileAndLog(auth.currentUser!, 'ADMIN_LOGOUT').catch(() => undefined);
    }
    await signOut(auth);
    setUser(null);
  }, []);

  const sendVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    const reloaded = auth.currentUser;
    setUser(reloaded);
    setAuthVersion((v) => v + 1);
    if (reloaded && isAuthorizedAdminUser(reloaded)) {
      void ensureAdminProfileAndLog(reloaded, 'ADMIN_LOGIN');
      return true;
    }
    return false;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin: isAuthorizedAdminUser(user),
        needsEmailVerification: Boolean(user && isAuthorizedAdminEmail(user) && !user.emailVerified),
        authLoading,
        authNotice,
        clearAuthNotice,
        signInAdmin,
        logoutAdmin,
        sendVerification,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
