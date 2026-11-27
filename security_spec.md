# TechnHobbies Firestore Security Specification

## 1. Data Invariants
1. **Strict Single-Admin Authority**: ONLY a verified Firebase-authenticated user whose token email matches `technhobbies268@gmail.com` (`email_verified == true`) is authorized as admin (`isAdmin()`). Holding or creating an `/admins/{uid}` document NEVER grants admin privileges, and even the existing admin cannot promote another user or create `/admins/{otherUid}` records.
2. **No Self-Privilege Escalation or Promotion**: Non-admin signed-in users cannot read, create, or modify `/admins/{uid}` records, and `isValidAdminAccount` strictly requires `uid == request.auth.uid`, `email == 'technhobbies268@gmail.com'`, and `role == 'admin'`.
3. **Archived & Unpublished Product Protection**: `archived` is a mandatory boolean on every product and cannot be `true` while `published == true`. Public visitors (`get` and `list`) may ONLY read products where `published == true && archived == false`. Only `isAdmin()` may read draft or archived products.
4. **Referential Integrity on Products & Categories**: Every created/updated product must reference existing `categoryId` and `brandId` documents in `/categories` and `/brands`, may optionally carry a bounded `subcategoryId`, and `updatedBy` must equal `request.auth.uid`. Categories may optionally carry a valid non-self `parentId` for nested subcategories.
5. **Immutable Audit & Ownership Fields**: `createdAt` is immutable on update and must equal `request.time` on creation; `updatedAt` must equal `request.time` on both create and update.
6. **Store Settings Split**: `store_settings/public` exposes only storefront identity, social links, WhatsApp public template/button labels, and SEO metadata (validated against exact keys and bounds). `store_settings/admin_private` and `admin_logs` are readable/writable strictly by `isAdmin()`.

## 2. Security Verification Cases (Must Return Expected Outcome)
1. **Public Read of Published Non-Archived Product**: Anonymous visitor reads `products/prod-1` (`published: true, archived: false`) -> `ALLOW`.
2. **Public Get/List of Unpublished or Archived Product**: Anonymous visitor queries without `archived == false` or reads `products/prod-archived` (`archived: true`) or `products/prod-draft` (`published: false`) -> `PERMISSION_DENIED`.
3. **Unauthenticated Product Write**: Anonymous client attempts `setDoc('/products/prod-attack-1', ...)` -> `PERMISSION_DENIED`.
4. **Verified Other Email Access & CRUD**: Verified user `other@gmail.com` (`email_verified: true`) attempts admin CRUD on `products`, `categories`, `brands`, `store_settings`, or reads `store_settings/admin_private` / `admin_logs` -> `PERMISSION_DENIED`.
5. **Other User /admins Escalation**: Verified user `attacker@gmail.com` creates `/admins/user-99` (or existing admin attempts to create `/admins/user-99` for `other@gmail.com`) -> `PERMISSION_DENIED`.
6. **Unverified Admin Email Spoof**: User with `email: 'technhobbies268@gmail.com'` and `email_verified: false` attempts any admin read/write -> `PERMISSION_DENIED`.
7. **Verified Authorized Admin CRUD**: Verified `technhobbies268@gmail.com` creates/updates/deletes valid products, categories, brands, `store_settings/public`, and `store_settings/admin_private` -> `ALLOW`.
8. **Shadow / Ghost Field Injection**: Admin sends `{ ...validProduct, isVerifiedOverride: true }` or unknown key on `store_settings/public` -> `PERMISSION_DENIED`.
9. **ID Poisoning & Unbounded Strings**: Admin sends >128 char doc ID or >400 char `shortDescription` -> `PERMISSION_DENIED`.
10. **Orphaned Product Reference**: Admin creates product referencing non-existent `categoryId` or `brandId` -> `PERMISSION_DENIED`.
11. **Client-Forged or Tampered Timestamps**: Client sends non-server `createdAt` or alters `createdAt` on update -> `PERMISSION_DENIED`.
12. **Audit Log Immutability**: Attempt to update or delete `/admin_logs/{logId}` -> `PERMISSION_DENIED`.
