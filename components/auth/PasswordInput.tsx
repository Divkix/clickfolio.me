"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { checkBreached } from "@/lib/password/hibp";
import { checkPasswordStrength, type PasswordStrengthResult } from "@/lib/password/strength";
import { cn } from "@/lib/utils";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Show password strength meter */
  showStrengthMeter?: boolean;
  /** User email for context-aware scoring (penalizes passwords containing email) */
  email?: string;
  /** User name for context-aware scoring (penalizes passwords containing name) */
  name?: string;
  /** Check HIBP breach database (debounced, optional) */
  checkBreach?: boolean;
  /** Callback when strength result changes */
  onStrengthChange?: (result: PasswordStrengthResult | null) => void;
  /** Show validation error state */
  hasError?: boolean;
}

/**
 * Password input with visibility toggle and optional strength meter
 *
 * Features:
 * - Password visibility toggle
 * - Integrated strength meter with zxcvbn scoring
 * - Context-aware scoring (penalizes passwords containing user info)
 * - Optional HIBP breach checking (debounced)
 * - Neubrutalist design system compatible
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      showStrengthMeter = false,
      email,
      name,
      checkBreach = false,
      onStrengthChange,
      hasError,
      className,
      value,
      onChange,
      ...props
    },
    ref,
  ) {
    const [showPassword, setShowPassword] = useState(false);
    const [strengthResult, setStrengthResult] = useState<PasswordStrengthResult | null>(null);
    const [breachCount, setBreachCount] = useState<number | undefined>(undefined);
    const [internalValue, setInternalValue] = useState("");

    // Use controlled or uncontrolled value
    const passwordValue = value !== undefined ? String(value) : internalValue;

    // Build user inputs for context-aware scoring
    const userInputs = useMemo(() => {
      const inputs: string[] = [];
      if (email) inputs.push(email);
      if (name) inputs.push(name);
      return inputs;
    }, [email, name]);

    // Check password strength (debounced)
    useEffect(() => {
      if (!showStrengthMeter || !passwordValue) {
        setStrengthResult(null);
        setBreachCount(undefined);
        onStrengthChange?.(null);
        return;
      }

      const timeoutId = setTimeout(async () => {
        const result = await checkPasswordStrength(passwordValue, userInputs);
        setStrengthResult(result);
        onStrengthChange?.(result);
      }, 150); // 150ms debounce for strength check

      return () => clearTimeout(timeoutId);
    }, [passwordValue, userInputs, showStrengthMeter, onStrengthChange]);

    // Check HIBP breach (longer debounce)
    useEffect(() => {
      if (!checkBreach || !passwordValue || passwordValue.length < 8) {
        setBreachCount(undefined);
        return;
      }

      const timeoutId = setTimeout(async () => {
        const result = await checkBreached(passwordValue);
        setBreachCount(result.isBreached ? result.count : 0);
      }, 500); // 500ms debounce for API call

      return () => clearTimeout(timeoutId);
    }, [passwordValue, checkBreach]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
        onChange?.(e);
      },
      [onChange],
    );

    const toggleVisibility = useCallback(() => {
      setShowPassword((prev) => !prev);
    }, []);

    return (
      <div className="space-y-2">
        <div className="relative">
          <input
            ref={ref}
            type={showPassword ? "text" : "password"}
            value={passwordValue}
            onChange={handleChange}
            className={cn(
              `
                w-full
                px-4
                py-2.5
                pr-10
                bg-cream
                text-ink
                font-medium
                border-3
                border-ink
                shadow-brutal-sm
                placeholder:text-ink/40
                focus:outline-none
                focus:shadow-brutal-md
                focus:translate-x-[-2px]
                focus:translate-y-[-2px]
                transition-all
                duration-150
                disabled:opacity-50
                disabled:cursor-not-allowed
              `,
              hasError && "border-brand",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={toggleVisibility}
            className="
              absolute
              right-3
              top-1/2
              -translate-y-1/2
              text-ink/50
              hover:text-ink
              transition-colors
              p-1
            "
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {showStrengthMeter && passwordValue && (
          <PasswordStrengthMeter
            result={strengthResult}
            breachCount={checkBreach ? breachCount : undefined}
          />
        )}
      </div>
    );
  },
);
