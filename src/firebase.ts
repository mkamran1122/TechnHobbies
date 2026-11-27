import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const ADMIN_EMAIL = 'technhobbies268@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Persist authenticated admin session across page refreshes
export const persistenceReady = setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Failed to configure Firebase Auth persistence:', err);
});

export function isAuthorizedAdminEmail(user: User | null): boolean {
  if (!user || !user.email) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAuthorizedAdminUser(user: User | null): boolean {
  return isAuthorizedAdminEmail(user) && Boolean(user?.emailVerified);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatFirestoreUserMessage(error: unknown): string {
  const fallback = 'Unable to complete Firestore request. Please verify connection and permissions.';
  if (!(error instanceof Error)) return fallback;

  let rawMsg = error.message;
  try {
    const parsed = JSON.parse(error.message) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      rawMsg = parsed.error;
    }
  } catch {
    // Plain error message
  }

  const lower = rawMsg.toLowerCase();
  if (lower.includes('permission-denied') || lower.includes('missing or insufficient permissions')) {
    return 'Firestore permission denied. Verify you are signed in with the verified admin account and that updated Firestore Security Rules are deployed.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Firestore daily quota exceeded. Please check Firebase Console usage limits.';
  }
  if (lower.includes('the client is offline') || lower.includes('unavailable')) {
    return 'Unable to reach Cloud Firestore right now. Check your internet connection and try again.';
  }
  return rawMsg || fallback;
}
