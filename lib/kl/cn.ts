// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/lib/cn.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's built-in scale. Without this, `text-title` (a KL type
 * size) and `text-ink` (a colour) look like two colours, and the merge silently drops one.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "large", "title", "title2", "title3", "number"] }],
    },
  },
});

/** Joins class names; later Tailwind classes win over earlier ones (`cn("px-4", "px-6")` → `px-6`). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
