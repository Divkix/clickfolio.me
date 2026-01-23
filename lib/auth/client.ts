/**
 * Client-side Better Auth configuration
 *
 * Provides React hooks and utilities for authentication in client components.
 * The auth client communicates with the Better Auth API routes.
 */

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client instance
 *
 * Automatically detects the base URL from the browser's location.
 * Falls back to empty string for SSR contexts (will be hydrated on client).
 */
const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
});

/**
 * Sign in with email/password or social provider
 *
 * @example
 * ```tsx
 * // Email sign in
 * const { data, error } = await signIn.email({
 *   email: "user@example.com",
 *   password: "password123",
 * });
 *
 * // Social sign in
 * signIn.social({ provider: "google" });
 * ```
 */
export const { signIn } = authClient;

/**
 * Sign up with email/password
 *
 * @example
 * ```tsx
 * const { data, error } = await signUp.email({
 *   name: "John Doe",
 *   email: "john@example.com",
 *   password: "password123",
 * });
 * ```
 */
export const { signUp } = authClient;

/**
 * Sign out the current user
 *
 * @example
 * ```tsx
 * <button onClick={() => signOut()}>Sign out</button>
 * ```
 */
export const { signOut } = authClient;

/**
 * Request password reset email
 *
 * Aliased from Better Auth's `requestPasswordReset` to `forgetPassword`
 * for semantic clarity.
 *
 * @example
 * ```tsx
 * const { data, error } = await forgetPassword({
 *   email: "user@example.com",
 *   redirectTo: "/reset-password",
 * });
 * ```
 */
export const forgetPassword = authClient.requestPasswordReset;

/**
 * Reset password with token from email link
 *
 * @example
 * ```tsx
 * const { data, error } = await resetPassword({
 *   newPassword: "newpassword123",
 *   token: tokenFromUrl,
 * });
 * ```
 */
export const { resetPassword } = authClient;

/**
 * React hook to access the current session
 *
 * @returns Session object with user data, loading state, and error
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { data: session, isPending, error } = useSession();
 *
 *   if (isPending) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!session) return <div>Not signed in</div>;
 *
 *   return <div>Welcome, {session.user.name}!</div>;
 * }
 * ```
 */
export const { useSession } = authClient;
