// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/lib/motion.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// One motion vocabulary for every Kitchen Labs app, converted from KLMotion.swift
// (response/damping → stiffness/damping, mass 1). Use these instead of inline springs.
// The <MotionConfig reducedMotion="user"> wrapper is MotionProvider in components/kl/Providers.tsx;
// this file stays free of React so server code can import the constants.
import type { Transition } from "motion/react";

/** Taps, toggles, layout. Overdraft's spring. */
export const snappy = { type: "spring", stiffness: 420, damping: 30 } as const satisfies Transition;
/** Rewards, pops, reveals. */
export const bouncy = { type: "spring", stiffness: 385, damping: 24 } as const satisfies Transition;
/** Screens, sheets, big moves. */
export const smooth = { type: "spring", stiffness: 195, damping: 25 } as const satisfies Transition;
/** Content fading up into place. */
export const enter = { duration: 0.5, ease: [0.22, 0.8, 0.32, 1] } as const satisfies Transition;
/** Button press-in (the CSS buttons use Tailwind's duration-75 for the same feel). */
export const press = { duration: 0.08, ease: "easeOut" } as const satisfies Transition;
/** Seconds between list items entering. */
export const stagger = 0.04;
/** Past this many items the stagger stops growing, so long lists don't crawl in. */
export const maxStaggerItems = 12;

/** Props for a fade-up entrance: `<motion.li {...fadeUp(index)} />`. */
export function fadeUp(index = 0, distance = 12) {
  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { ...enter, delay: Math.min(index, maxStaggerItems) * stagger },
  } as const;
}

/** Props for a pop-in (badges, rewards): `<motion.span {...popIn()} />`. */
export function popIn(delay = 0) {
  return {
    initial: { opacity: 0, scale: 0.85 },
    animate: { opacity: 1, scale: 1 },
    transition: { ...bouncy, delay },
  } as const;
}
