# Security Review

Date: 2026-11-12

## Summary

This review covered the repository for high-confidence security issues affecting worker and auth paths. The most significant issues are user-scoped data access and credential handling that can be abused without verified authentication.

## Findings

### 1) Unauthenticated user-scoped alert history access and deletion
- Severity: HIGH
- Confidence: 9/10
- File: `worker/routes/alert-history.ts`
- Lines: 154-188
- Issue: The alert history, export, and delete handlers accept a caller-supplied `user_id` and query or mutate the database for that user without verifying the caller is the same authenticated user.
- Impact: Anyone who knows or guesses a valid user ID can read alert history, including securities, thresholds, and timestamps, or delete that user’s alert history.
- Recommendation: Bind the requested data to a verified server-side identity from the session or JWT and enforce authorization checks before any database operation.

### 2) Passkey auth can fail open and allow credential-ID-based access
- Severity: MEDIUM
- Confidence: 8/10
- File: `worker/routes/auth.ts`
- Lines: 117-120, 295-337, 384-420
- Issue: Registration and assertion flows allow cases where the public key is absent or signature verification is skipped, and user-scoped routes rely on a raw `credentialId` instead of a validated auth context.
- Impact: An attacker who knows a credential ID can access or overwrite user data without proving passkey possession.
- Recommendation: Fail closed on missing public keys, verify complete WebAuthn assertion/registration, and require a verified authenticated session/token for user-scoped endpoints.

## Notes

- The review focused on concrete, exploitable issues in the codebase rather than theoretical concerns.
- This repository’s worker routes and auth flows should be treated as having a strong need for server-side authorization and verified credential validation before exposing user data.
