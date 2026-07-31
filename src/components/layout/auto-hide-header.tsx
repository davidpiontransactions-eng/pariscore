"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AutoHideHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Wraps header content and auto-hides it when the user scrolls down,
 * revealing it again on scroll up — a common mobile-app pattern.
 *
 * Threshold: 50 px of downward scroll triggers the hide; any upward
 * scroll immediately reveals the header.
 */
export function AutoHideHeader({ children, className }: AutoHideHeaderProps) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // Initialise so we don't immediately hide on mount when scrollY > 50
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      if (delta > 50) {
        // Scrolled down more than 50 px → hide
        setHidden(true);
      } else if (delta < 0) {
        // Scrolled up at all → show
        setHidden(false);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      className={cn(
        "sticky top-0 z-50 w-full",
        className,
      )}
      animate={{
        y: hidden ? "-100%" : "0%",
      }}
      transition={{
        type: "tween",
        ease: "easeInOut",
        duration: 0.25,
      }}
    >
      {children}
    </motion.header>
  );
}
