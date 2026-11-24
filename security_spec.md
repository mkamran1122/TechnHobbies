# TechnHobbies Firestore Security Specification

## 1. Data Invariants
1. **Admin Authority**: Only verified Firebase-authenticated administrators matching `technhobbies268@gmail.com` (`email_verified == true`) or holding a trusted `/admins/{uid}` record can create, update, or delete catalog documents (`products`, `categories`, `brands`, `store_settings`) or view/write `/admins` and `/admin_logs`.
2. **No Self-Privilege Escalation**: Non-admin signed-in users cannot create or modify `/admins/{uid}` records or inject `role: 'admin'`.
3. **Referential Integrity on Products**: Every created product must reference existing `categoryId` and `brandId` documents in `/categories` and `/brands`, and `updatedBy` must equal `request.auth.uid`.
4. **Immutable Audit & Ownership Fields**: `createdAt` is immutable on update and must equal `request.time` on creation; `updatedAt` must equal `request.time` on both create and update.
5. **Public Read Scope**: Storefront catalog reads on `products`, `categories`, `brands`, and `store_settings` are restricted to published/public records without exposing private admin emails or PII.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Product Write**: Anonymous client attempts `setDoc('/products/p-1', validProduct)`.
2. **Non-Admin Authenticated Write**: User signed in as `attacker@gmail.com` (`email_verified: true`) attempts `setDoc('/products/p-1', validProduct)`.
3. **Unverified Admin Email Spoof**: User with `email: 'technhobbies268@gmail.com'` and `email_verified: false` attempts `setDoc('/products/p-1', validProduct)`.
4. **Self-Assigned Admin Escalation**: Non-admin user attempts `setDoc('/admins/' + uid, { uid, email: 'attacker@gmail.com', role: 'admin', ... })`.
5. **Shadow / Ghost Field Injection**: Admin sends `{ ...validProduct, isVerifiedOverride: true }` — rejected by `keys().hasOnly(...)`.
6. **ID Poisoning**: Admin attempts `setDoc('/products/' + 'a'.repeat(300), validProduct)` or invalid characters in document ID (`bad/id$`).
7. **Unbounded String / Denial of Wallet**: Admin sends a 20KB string in `shortDescription` (`> 400` chars) or `name` (`> 200` chars).
8. **Orphaned Product Reference**: Admin creates product referencing non-existent `categoryId: 'fake-cat'`.
9. **Client-Forged Timestamp**: Admin sends `createdAt: new Date('2020-01-01')` instead of `serverTimestamp()`.
10. **Immutable `createdAt` Tampering**: Admin attempts `updateDoc` altering `createdAt` on an existing product.
11. **Audit Log Tampering / Deletion**: Even an admin attempts `updateDoc` or `deleteDoc` on `/admin_logs/{logId}` (append-only).
12. **PII / Admin Log Read by Non-Admin**: Unauthenticated or non-admin authenticated user attempts `getDocs('/admin_logs')` or `getDoc('/admins/uid1')`.
