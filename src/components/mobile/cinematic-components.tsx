import { type ReactNode, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TextReveal } from "./animations";

type CinematicHeroProps = {
  title: string;
  subtitle?: string;
  badge?: string;
  children?: ReactNode;
  className?: string;
  gradient?: string;
  showParticles?: boolean;
};

export function CinematicHero({
  title,
  subtitle,
  badge,
  children,
  className,
  gradient = "from-emerald-500/20 via-sky-500/10 to-purple-500/20",
  showParticles = true,
}: CinematicHeroProps) {
  const reduceMotion = useReducedMotion();

  const particles = useMemo(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        id: i,
        left: `${5 + (i * 47) % 90}%`,
        top: `${5 + (i * 31) % 90}%`,
        duration: 3 + (i % 5),
        delay: (i * 0.7) % 5,
      })),
    []
  );

  return (
    <section
      className={cn(
        "relative min-h-[60vh] flex items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-[#0b0e17] via-[#0e121e] to-[#0b0e17]",
        className
      )}
    >
      <motion.div
        className={cn("absolute inset-0 bg-gradient-to-br opacity-60", gradient)}
        animate={
          reduceMotion
            ? undefined
            : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
        }
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{ backgroundSize: "200% 200%" }}
      />

      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {showParticles && !reduceMotion && (
        <div className="absolute inset-0 pointer-events-none">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute h-1 w-1 rounded-full bg-emerald-400/30"
              style={{ left: p.left, top: p.top }}
              animate={{ y: [0, -100, 0], opacity: [0, 1, 0] }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        {badge && (
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {badge}
            </span>
          </motion.div>
        )}

        <motion.h1
          initial={reduceMotion ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight"
        >
          <TextReveal
            text={title}
            className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent"
            delay={0.5}
          />
        </motion.h1>

        {subtitle && (
          <motion.p
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
        )}

        {children && (
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="mt-8"
          >
            {children}
          </motion.div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0b0e17] to-transparent" />
    </section>
  );
}

type CinematicCardProps = {
  children: ReactNode;
  className?: string;
  glow?: boolean;
};

export function CinematicCard({
  children,
  className,
  glow = true,
}: CinematicCardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={
        reduceMotion
          ? undefined
          : { y: -4, transition: { duration: 0.2 } }
      }
      className={cn(
        "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden",
        "transition-shadow duration-300",
        glow && "hover:shadow-[0_0_30px_rgba(0,230,118,0.08)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

type GlowBadgeProps = {
  children: ReactNode;
  className?: string;
  color?: "emerald" | "sky" | "purple" | "amber";
};

const GLOW_COLORS = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

export function GlowBadge({
  children,
  className,
  color = "emerald",
}: GlowBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        GLOW_COLORS[color],
        className
      )}
    >
      {children}
    </span>
  );
}
