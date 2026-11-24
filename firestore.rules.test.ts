/**
 * Dirty Dozen Firestore Security Rule Verification Cases for TechnHobbies
 * Maps each attack payload from security_spec.md to expected PERMISSION_DENIED outcomes.
 */

export interface SecurityRuleCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: SecurityRuleCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Product Write',
    collection: 'products/prod-attack-1',
    operation: 'create',
    auth: null,
    payload: { id: 'prod-attack-1', name: 'Unauthorized Crawler', price: 1000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Non-Admin Authenticated Write',
    collection: 'products/prod-attack-2',
    operation: 'create',
    auth: { uid: 'user-99', email: 'attacker@gmail.com', email_verified: true },
    payload: { id: 'prod-attack-2', name: 'Non-Admin Item', price: 1000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Admin Email Spoof',
    collection: 'products/prod-attack-3',
    operation: 'create',
    auth: { uid: 'spoof-1', email: 'technhobbies268@gmail.com', email_verified: false },
    payload: { id: 'prod-attack-3', name: 'Spoofed Item', price: 1000 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Self-Assigned Admin Escalation',
    collection: 'admins/user-99',
    operation: 'create',
    auth: { uid: 'user-99', email: 'attacker@gmail.com', email_verified: true },
    payload: { uid: 'user-99', email: 'attacker@gmail.com', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow Ghost Field Injection',
    collection: 'products/prod-1',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-1', isVerifiedOverride: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'ID Poisoning (>128 chars)',
    collection: `products/${'a'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'a'.repeat(200) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Unbounded String Exhaustion',
    collection: 'products/prod-1',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-1', shortDescription: 'x'.repeat(20000) },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Orphaned Product Reference',
    collection: 'products/prod-orphan',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-orphan', categoryId: 'missing-cat', brandId: 'missing-brand' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-Forged Timestamp',
    collection: 'products/prod-1',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-1', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable createdAt Tampering',
    collection: 'products/prod-1',
    operation: 'update',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { createdAt: '2021-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Audit Log Deletion Attempt',
    collection: 'admin_logs/log-1',
    operation: 'delete',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-Admin Admin Log Read',
    collection: 'admin_logs',
    operation: 'list',
    auth: { uid: 'user-99', email: 'attacker@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
