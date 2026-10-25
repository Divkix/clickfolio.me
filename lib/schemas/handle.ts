import * as z from "zod/mini";
import { noXssPattern } from "@/lib/utils/sanitization";

// zod/mini: the home page validates handles as you type, and full zod would add ~11 KB gz there.
export const handleSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(3, "Handle must be at least 3 characters"),
    z.maxLength(30, "Handle must not exceed 30 characters"),
    z.regex(/^[a-z0-9-]+$/, "Handle can only contain lowercase letters, numbers, and hyphens"),
    z.regex(/^[a-z0-9]/, "Handle must start with a letter or number"),
    z.regex(/[a-z0-9]$/, "Handle must end with a letter or number"),
    z.regex(/^(?!.*--)/, "Handle cannot contain consecutive hyphens"),
    z.refine(noXssPattern, { message: "Invalid content detected" }),
  );
