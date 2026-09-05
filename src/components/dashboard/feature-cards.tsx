"use client";

/**
 * FeatureCards — 3 cartes avec images sportives décoratives.
 *
 * Pattern "Bento grid" de 21st.dev appliqué au secteur paris sportifs.
 * Chaque card a une image Unsplash en fond (opacity très basse, gradient overlay)
 * + icône + tagline + micro-description.
 *
 * Affiché sous le HeroSection sur la homepage "home" tab.
 * Images : Unsplash (libres de droits), très dégradées pour rester sobres.
 *
 * Refonte design 2026-08-25 — cf. .context/design-refonte-2026-08-25.md
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, BarChart3, Trophy, Target, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { BentoTile } from "@/components/ui/bento-grid";

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  accentBorder: string;
  image: string;
  imageAlt: string;
}

const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: "Value Bets en temps réel",
    description:
      "Edge calculé sur 3 000+ marchés. Cotes flashées, signal vert = opportunité.",
    accent: "text-emerald-400",
    accentBorder: "border-emerald-500/20",
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=60",
    imageAlt: "Football — stade de nuit sous les projecteurs",
  },
  {
    icon: BarChart3,
    title: "Data & prédictions IA",
    description:
      "Modèles probabilistes, xG, forme, H2H. Chaque pari est un signal, pas un pari.",
    accent: "text-sky-400",
    accentBorder: "border-sky-500/20",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=60",
    imageAlt: "Écran de dashboard avec graphiques et données",
  },
  {
    icon: Trophy,
    title: "1 582 championnats",
    description:
      "De la Ligue 1 aux ligues asiatiques. Stats home/away, sparklines PPG, classements live.",
    accent: "text-amber-400",
    accentBorder: "border-amber-500/20",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=60",
    imageAlt: "Tennis — match en cours sur terre battue",
  },
];

export function FeatureCards() {
  const reduceMotion = useReducedMotion();

  const containerVariants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: { staggerChildren: 0.1, delayChildren: 0.2 },
      },
    }),
    [],
  );

  const cardVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 16, scale: 0.98 },
      visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
      },
    }),
    [reduceMotion],
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        return (
          <motion.div
            key={f.title}
            variants={cardVariants}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-[#F5F3FA] transition-all duration-300",
              "hover:border-border/60 hover:bg-[#EDE8F5]",
              f.accentBorder,
              /* Première card = tile large (2 cols) sur desktop */
              i === 0 && "sm:col-span-2",
            )}
          >
            {/* Image décorative en fond — opacity très basse + gradient */}
            <div className="pointer-events-none absolute inset-0">
              <img
                src={f.image}
                alt=""
                aria-hidden
                loading="lazy"
                className="h-full w-full object-cover opacity-[0.07] transition-opacity duration-500 group-hover:opacity-[0.12]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/90 to-zinc-900/60" />
            </div>

            {/* Contenu */}
            <div className="relative p-4 sm:p-5">
              <div className={cn("mb-3 inline-flex items-center justify-center rounded-lg bg-[#EDE8F5] p-2", f.accent)}>
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-400">{f.description}</p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
