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
 * Sign in with a social provider
 *
 * @example
 * ```tsx
 * <button onClick={() => signIn.social({ provider: "google" })}>
 *   Sign in with Google
 * </button>
 * ```
 */
export const { signIn } = authClient;

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
