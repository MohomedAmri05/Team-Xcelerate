/*
 * Shared animation variants for the premium
 * About / Services / FAQ / Contact pages.
 * Kept separate so the page files stay lean
 * and every page animates in the same
 * cinematic, consistent way.
 */

export const fadeUp = {
  hidden: {
    opacity: 0,
    y: 36
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export const fadeIn = {
  hidden: {
    opacity: 0
  },
  show: {
    opacity: 1,
    transition: {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export const scaleReveal = {
  hidden: {
    opacity: 0,
    scale: 1.08
  },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export const stagger = (
  delay = 0.12,
  startAt = 0
) => ({
  hidden: {},
  show: {
    transition: {
      staggerChildren: delay,
      delayChildren: startAt
    }
  }
});

export const viewport = {
  once: true,
  amount: 0.25
};

export const easePremium = [0.16, 1, 0.3, 1];