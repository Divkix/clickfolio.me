// Design-sync shim: signed-out Clerk surface so auth-aware components render.
import type { ReactNode } from "react";

export interface ClientSessionUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export const ClerkProvider = ({ children }: { children?: ReactNode }) => children;
export const SignInButton = ({ children }: { children?: ReactNode; mode?: string }) => children;
export const useClerk = () => ({ signOut: async () => {}, openSignIn: () => {} });
export const useUser = () => ({ user: null, isLoaded: true, isSignedIn: false });
export const useSession = () => ({ data: null, error: null, isPending: false });
