/**
 * Tailwind CSS class merger utility.
 *
 * Combines `clsx` (conditional class joining) with `tailwind-merge`
 * (conflict resolution) to produce clean, deduplicated className strings.
 *
 * @example
 * cn("px-2", condition && "py-2", "px-4") // => "py-2 px-4"
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with conditional logic and deduplication.
 *
 * @param inputs - Class values (strings, objects, arrays, etc.)
 * @returns Merged and deduplicated class string
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
