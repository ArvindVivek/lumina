// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Reveal.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { fadeUp } from "@/lib/kl/motion";

/**
 * Fades its children up into place on first render (the `enter` curve, staggered by index).
 * A client island, so server pages can use it without becoming client components.
 */
export function Reveal({
  children,
  index = 0,
  as = "div",
  className,
}: {
  children: ReactNode;
  index?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}) {
  const Tag = motion[as];
  return (
    <Tag {...fadeUp(index)} className={className}>
      {children}
    </Tag>
  );
}
