import { type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * AnimatedSection
 *
 * Section avec animation d'entrée au scroll.
 * Pattern "reveal on scroll" utilisé par les sites premium 2026.
 *
 * Usage :
 * <AnimatedSection delay={0.1}>
 *   <h2>Titre animé</h2>
 * </AnimatedSection>
 */

type AnimatedSectionProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "fade";
  duration?: number;
  /** Distance de déplacement en px */
  distance?: number;
};

const directionVariants: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -40 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
};

export function AnimatedSection({
  children,
  className,
  delay = 0,
  direction = "up",
  duration = 0.5,
  distance = 40,
}: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion();

  const variants = directionVariants[direction] ?? directionVariants.up;

  // Apply custom distance
  const customVariants: Variants = {
    hidden: {
      ...variants.hidden,
      y: direction === "up" ? distance : direction === "down" ? -distance : undefined,
      x: direction === "left" ? distance : direction === "right" ? -distance : undefined,
    },
    visible: {
      ...variants.visible,
      y: 0,
      x: 0,
    },
  };

  return (
    <motion.div
      initial={reduceMotion ? "visible" : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      variants={customVariants}
      transition={{
        duration: reduceMotion ? 0 : duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerChildren
 *
 * Container pour animer les enfants en cascade.
 * Pattern "stagger" utilisé par les grilles de cartes.
 *
 * Usage :
 * <StaggerChildren>
 *   <MatchCard />
 *   <MatchCard />
 *   <MatchCard />
 * </StaggerChildren>
 */

type StaggerChildrenProps = {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  /** Delay avant le premier enfant */
  initialDelay?: number;
};

export function StaggerChildren({
  children,
  className,
  staggerDelay = 0.1,
  initialDelay = 0,
}: StaggerChildrenProps) {
  const reduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reduceMotion ? 0 : staggerDelay,
        delayChildren: reduceMotion ? 0 : initialDelay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-50px" }}
      variants={container}
      className={cn("space-y-4", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerItem
 *
 * Enfant de StaggerChildren avec animation d'entrée.
 */

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
};

export function StaggerItem({ children, className }: StaggerItemProps) {
  const item: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * HoverScale
 *
 * Animation de scale au hover.
 * Pattern "micro-interaction" pour les boutons et cartes.
 *
 * Usage :
 * <HoverScale>
 *   <button>Cliquer</button>
 * </HoverScale>
 */

type HoverScaleProps = {
  children: ReactNode;
  className?: string;
  scale?: number;
};

export function HoverScale({
  children,
  className,
  scale = 1.02,
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxSection
 *
 * Effet parallaxe subtil au scroll.
 * Pattern "cinematic" pour les sections hero.
 *
 * Usage :
 * <ParallaxSection speed={0.3}>
 *   <img src="bg.jpg" />
 * </ParallaxSection>
 */

type ParallaxSectionProps = {
  children: ReactNode;
  className?: string;
  speed?: number;
};

export function ParallaxSection({
  children,
  className,
  speed = 0.3,
}: ParallaxSectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      style={{ perspective: 1000 }}
    >
      <motion.div
        style={{
          y: reduceMotion ? 0 : undefined,
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, speed * -50, 0],
              }
        }
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * TextReveal
 *
 * Animation de révélation de texte caractère par caractère.
 * Pattern "typographic statement" 2026.
 *
 * Usage :
 * <TextReveal text="ParisScore" className="text-4xl font-bold" />
 */

type TextRevealProps = {
  text: string;
  className?: string;
  delay?: number;
  /** Révéler par mots (true) ou par caractères (false) */
  byWord?: boolean;
};

export function TextReveal({
  text,
  className,
  delay = 0,
  byWord = false,
}: TextRevealProps) {
  const reduceMotion = useReducedMotion();
  const units = byWord ? text.split(" ") : text.split("");

  return (
    <span className={cn("inline-flex flex-wrap", className)} aria-label={text}>
      {units.map((unit, i) => (
        <motion.span
          key={`${unit}-${i}`}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.3,
            delay: reduceMotion ? 0 : delay + i * 0.03,
            ease: [0.25, 0.1, 0.25, 1],
          }}
          className="inline-block"
        >
          {unit}
          {byWord && i < units.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
