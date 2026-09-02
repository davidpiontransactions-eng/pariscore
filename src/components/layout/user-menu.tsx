"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  User,
  Settings,
  LogOut,
  Moon,
  Sun,
  Languages,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";

/** Menu déroulant profil utilisateur — avatar circulaire + popover */
export function UserMenu() {
  const t = useTranslations("UserMenu");
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useState<string>("fr");

  // Lecture du cookie NEXT_LOCALE au montage
  useEffect(() => {
    const match = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
    if (match) setLocale(match[1]);
  }, []);

  /** Basculer entre FR et EN, mettre à jour le cookie puis rafraîchir */
  const toggleLocale = () => {
    const next = locale === "fr" ? "en" : "fr";
    setLocale(next);
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  /** Basculer thème clair/sombre */
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("openMenu")}
          className="relative h-8 w-8 rounded-full bg-muted p-0"
        >
          {/* Avatar circulaire — icône User par défaut, ou initiales */}
          <span className="flex h-full w-full items-center justify-center rounded-full text-xs font-medium">
            <User className="h-4 w-4" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-0">
        {/* En-tête : info utilisateur */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">Utilisateur</span>
            <span className="text-xs text-muted-foreground">
              utilisateur@email.com
            </span>
          </div>
        </div>

        <Separator />

        {/* Navigation du menu */}
        <nav className="p-1">
          {/* Profil */}
          <MenuItem
            icon={<User className="h-4 w-4" />}
            label={t("profile")}
            onClick={() => setOpen(false)}
          />

          {/* Paramètres */}
          <MenuItem
            icon={<Settings className="h-4 w-4" />}
            label={t("settings")}
            onClick={() => {
              router.push("/settings");
              setOpen(false);
            }}
          />

          <Separator className="my-1" />

          {/* Toggle langue */}
          <MenuItem
            icon={<Languages className="h-4 w-4" />}
            label={`${t("language")} (${locale.toUpperCase()})`}
            active
            onClick={toggleLocale}
          />

          {/* Toggle thème */}
          <MenuItem
            icon={
              theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )
            }
            label={
              theme === "dark" ? t("lightMode") : t("darkMode")
            }
            active
            onClick={toggleTheme}
          />

          <Separator className="my-1" />

          {/* Déconnexion */}
          <MenuItem
            icon={<LogOut className="h-4 w-4" />}
            label={t("logout")}
            variant="destructive"
            onClick={() => setOpen(false)}
          />
        </nav>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Item de menu réutilisable                                          */
/* ------------------------------------------------------------------ */

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  variant?: "default" | "destructive";
}

function MenuItem({
  icon,
  label,
  onClick,
  active,
  variant = "default",
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
        "hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        variant === "destructive" && "text-red-500 hover:text-red-600",
        active && "bg-muted font-medium"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
