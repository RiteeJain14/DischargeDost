# DischargeDost Firestore Security Specification

## 1. Data Invariants
1. **User PII Isolation**: `/users/{userId}` documents contain user email addresses and can only be read, created, or updated by the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`). No cross-user reads or collection listing on `/users`.
2. **Recovery Plan Ownership**: Every `/recoveryPlans/{planId}` document MUST store `ownerId == request.auth.uid` on creation, and `ownerId` and `createdAt` are immutable across updates. List queries require `resource.data.ownerId == request.auth.uid`.
3. **Subcollection Master Gate**: Every `/recoveryPlans/{planId}/checkIns/{checkInId}` and `/recoveryPlans/{planId}/doseLogs/{logId}` write MUST verify via `get()` that the parent `/recoveryPlans/{planId}` exists and belongs to `request.auth.uid`, and that `incoming().planId == planId` and `incoming().ownerId == request.auth.uid`.
4. **Terminal State Lock**: Once a `/recoveryPlans/{planId}` document is set to `status: 'archived'`, no further mutations are allowed.
5. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps MUST equal `request.time`.
6. **Bounded Arrays & Strict Keys**: Every collection validates `hasAll` and `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, strict string `.size()` upper bounds, and array `.size()` limits to prevent payload exhaustion.

## 2. The "Dirty Dozen" Attack Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Plan Read**: Anonymous client attempts `get /recoveryPlans/plan_1`.
2. **Cross-Owner Plan Spoofing**: User B creates `/recoveryPlans/plan_2` with `ownerId: "user_A"`.
3. **Ghost Field Shadow Write**: Owner creates `/recoveryPlans/plan_3` with extra `"isAdminApproved": true`.
4. **Unverified Email Bypass**: Authenticated user with `email_verified: false` attempts to create `/users/{uid}`.
5. **Immutable Owner Tampering**: Owner updates `/recoveryPlans/plan_1` trying to change `ownerId` or `createdAt`.
6. **Client-Forged Timestamp**: Owner creates `/recoveryPlans/plan_1` with a past ISO/Timestamp instead of `request.time`.
7. **Oversized ID Poisoning**: Client writes to `/recoveryPlans/${'a'.repeat(200)}` or non-alphanumeric ID `../admin`.
8. **PII Blanket Read**: User B attempts `get /users/user_A` or `list /users`.
9. **Unscoped List Scraping**: User B runs `list /recoveryPlans` without matching `where('ownerId', '==', userB)`.
10. **Orphaned Subcollection Check-In**: User A creates `/recoveryPlans/nonexistent/checkIns/c1` where parent plan does not exist.
11. **Cross-Tenant Check-In Injection**: User B creates `/recoveryPlans/plan_owned_by_A/checkIns/c2`.
12. **Terminal State Mutation**: Owner tries to update medicines on an already `archived` recovery plan.
