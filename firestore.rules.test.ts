/**
 * Firestore Security Rule Verification Specification for TechnHobbies
 * Maps each attack/authorization case from security_spec.md to expected outcomes.
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
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const SECURITY_RULE_CASES: SecurityRuleCase[] = [
  {
    id: 1,
    name: 'Anonymous Read of Published Non-Archived Product',
    collection: 'products/prod-1',
    operation: 'get',
    auth: null,
    expected: 'ALLOW',
  },
  {
    id: 2,
    name: 'Anonymous Read of Unpublished or Archived Product',
    collection: 'products/prod-archived',
    operation: 'get',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unauthenticated Product Write',
    collection: 'products/prod-attack-1',
    operation: 'create',
    auth: null,
    payload: { id: 'prod-attack-1', name: 'Unauthorized Crawler', price: 1000, archived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Verified Other Email Admin CRUD Attempt',
    collection: 'products/prod-attack-2',
    operation: 'create',
    auth: { uid: 'user-99', email: 'other@gmail.com', email_verified: true },
    payload: { id: 'prod-attack-2', name: 'Non-Admin Item', price: 1000, archived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Unverified Admin Email Spoof',
    collection: 'products/prod-attack-3',
    operation: 'create',
    auth: { uid: 'spoof-1', email: 'technhobbies268@gmail.com', email_verified: false },
    payload: { id: 'prod-attack-3', name: 'Spoofed Item', price: 1000, archived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Self-Assigned Admin Escalation by Other Verified User',
    collection: 'admins/user-99',
    operation: 'create',
    auth: { uid: 'user-99', email: 'other@gmail.com', email_verified: true },
    payload: { uid: 'user-99', email: 'other@gmail.com', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Existing Admin Promoting Another User in /admins',
    collection: 'admins/user-99',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { uid: 'user-99', email: 'other@gmail.com', role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Other Verified User Reading Admin Private Settings & Logs',
    collection: 'store_settings/admin_private',
    operation: 'get',
    auth: { uid: 'user-99', email: 'other@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Verified Authorized Admin Product Write',
    collection: 'products/prod-1',
    operation: 'update',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    expected: 'ALLOW',
  },
  {
    id: 10,
    name: 'Shadow Ghost Field Injection',
    collection: 'products/prod-1',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-1', isVerifiedOverride: true, archived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Orphaned Product Reference',
    collection: 'products/prod-orphan',
    operation: 'create',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    payload: { id: 'prod-orphan', categoryId: 'missing-cat', brandId: 'missing-brand', archived: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Audit Log Deletion Attempt',
    collection: 'admin_logs/log-1',
    operation: 'delete',
    auth: { uid: 'admin-1', email: 'technhobbies268@gmail.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
