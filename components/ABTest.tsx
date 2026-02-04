"use client";

import { createContext, type ReactNode, useContext } from "react";
import { type ABVariant, getVariantClient } from "@/lib/ab-testing";

/**
 * A/B Test Context
 *
 * Provides the current variant to all child components.
 * The variant is set server-side and passed down via ABProvider.
 */
const ABContext = createContext<ABVariant>("A");

/**
 * Props for ABProvider component
 */
interface ABProviderProps {
  /**
   * The A/B test variant determined server-side
   */
  variant: ABVariant;
  /**
   * Child components that may consume the variant
   */
  children: ReactNode;
}

/**
 * ABProvider wraps the application and provides the A/B variant via context
 *
 * The variant should be read server-side using getVariantServer() and passed
 * to ABProvider to ensure consistency during hydration.
 *
 * @example
 * ```tsx
 * // In app/layout.tsx
 * export default async function RootLayout({ children }) {
 *   const variant = await getVariantServer();
 *   return (
 *     <html>
 *       <body>
 *         <ABProvider variant={variant}>
 *           {children}
 *         </ABProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function ABProvider({ variant, children }: ABProviderProps) {
  return <ABContext.Provider value={variant}>{children}</ABContext.Provider>;
}

/**
 * Hook to access the current A/B test variant
 *
 * @returns The current variant ("A" or "B")
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const variant = useABVariant();
 *   return <div>You are in variant {variant}</div>;
 * }
 * ```
 */
export function useABVariant(): ABVariant {
  return useContext(ABContext);
}

/**
 * Props for VariantB component
 */
interface VariantBProps {
  /**
   * Content to render only when variant is "B"
   */
  children: ReactNode;
}

/**
 * VariantB renders its children only when the current variant is "B"
 *
 * Use this component to wrap content that should only appear in variant B.
 * For variant A content, simply render it normally (it's the control).
 *
 * @example
 * ```tsx
 * function Hero() {
 *   return (
 *     <div>
 *       <h1>Welcome</h1>
 *       <VariantB>
 *         <p>This special message only shows in variant B!</p>
 *       </VariantB>
 *     </div>
 *   );
 * }
 * ```
 */
export function VariantB({ children }: VariantBProps) {
  const variant = useABVariant();
  if (variant !== "B") {
    return null;
  }
  return <>{children}</>;
}

/**
 * Props for ABSwitch component
 */
interface ABSwitchProps {
  /**
   * Content to render for variant A (control)
   */
  a: ReactNode;
  /**
   * Content to render for variant B (treatment)
   */
  b: ReactNode;
}

/**
 * ABSwitch renders different content based on the current variant
 *
 * Use this component when you need to show completely different content
 * for each variant, rather than just adding/removing content.
 *
 * @example
 * ```tsx
 * function CTAButton() {
 *   return (
 *     <ABSwitch
 *       a={<button>Sign Up</button>}
 *       b={<button>Get Started Free</button>}
 *     />
 *   );
 * }
 * ```
 */
export function ABSwitch({ a, b }: ABSwitchProps) {
  const variant = useABVariant();
  return <>{variant === "B" ? b : a}</>;
}

/**
 * Re-export getVariantClient for convenience
 *
 * Allows direct client-side variant reading without context,
 * useful in event handlers or non-React code.
 */
export { getVariantClient };
