"use client";

import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  User,
  Settings,
  LogOut,
  LogIn,
  Moon,
  Sun,
  Monitor,
  Languages,
  BarChart3,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSession, signIn, signOut } from "next-auth/react";
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
  const { data: session, status } = useSession();
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

  /** Basculer thème : light → dark → system → light */
  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const themeIcon =
    theme === "dark" ? <Moon className="h-4 w-4" /> :
    theme === "system" ? <Monitor className="h-4 w-4" /> :
    <Sun className="h-4 w-4" />;

  const themeLabel =
    theme === "dark" ? t("darkMode") :
    theme === "system" ? t("autoMode", { defaultValue: "Auto" }) :
    t("lightMode");

  const isLoggedIn = status === "authenticated";
  const userName = session?.user?.name ?? session?.user?.email?.split("@")[0] ?? null;
  const userEmail = session?.user?.email ?? null;
  const userRole = (session?.user as { role?: string })?.role ?? "freemium";
  const userInitial = (userName ?? userEmail ?? "U").charAt(0).toUpperCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("openMenu")}
          className="relative h-10 w-10 sm:h-8 sm:w-8 rounded-full bg-muted p-0"
        >
          {/* Avatar circulaire — initiales si connecté, icône User sinon */}
          <span className="flex h-full w-full items-center justify-center rounded-full text-xs font-medium">
            {isLoggedIn ? userInitial : <User className="h-4 w-4" />}
          </span>
          {/* Badge vert si connecté */}
          {isLoggedIn && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-0">
        {/* En-tête : info utilisateur */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {isLoggedIn ? userInitial : <User className="h-4 w-4" />}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium">
              {isLoggedIn
                ? (userName ?? "Utilisateur")
                : t("guest", { defaultValue: "Invité" })}
            </span>
            <span className="text-xs text-muted-foreground">
              {isLoggedIn
                ? (userEmail ?? userRole)
                : t("notConnected", { defaultValue: "Non connecté" })}
            </span>
          </div>
        </div>

        <Separator />

        {/* Navigation du menu */}
        <nav className="p-1">
          {isLoggedIn ? (
            <>
              {/* Dashboard */}
              <MenuItem
                icon={<BarChart3 className="h-4 w-4" />}
                label="Dashboard"
                onClick={() => {
                  router.push("/dashboard");
                  setOpen(false);
                }}
              />

              {/* Profil */}
              <MenuItem
                icon={<User className="h-4 w-4" />}
                label={t("profile")}
                onClick={() => {
                  router.push("/settings");
                  setOpen(false);
                }}
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

              {/* Toggle thème (3-mode : Light/Dark/Auto) */}
              <MenuItem
                icon={themeIcon}
                label={themeLabel}
                active
                onClick={cycleTheme}
              />

              <Separator className="my-1" />

              {/* Déconnexion */}
              <MenuItem
                icon={<LogOut className="h-4 w-4" />}
                label={t("logout")}
                variant="destructive"
                onClick={() => {
                  signOut({ callbackUrl: "/" });
                  setOpen(false);
                }}
              />
            </>
          ) : (
            <>
              {/* Connexion */}
              <MenuItem
                icon={<LogIn className="h-4 w-4" />}
                label={t("login", { defaultValue: "Se connecter" })}
                onClick={() => {
                  signIn();
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

              {/* Toggle thème (3-mode : Light/Dark/Auto) */}
              <MenuItem
                icon={themeIcon}
                label={themeLabel}
                active
                onClick={cycleTheme}
              />
            </>
          )}
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
