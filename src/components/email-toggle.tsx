"use client";

import { useState } from "react";
import { Mail, MailCheck, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { cn } from "@/lib/utils";

// Basic client-side email format check (mirrors the server-side validator).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Header toggle for email value-bet alerts — sits next to <PushToggle />.
 *
 * - Not subscribed: clicking opens a Popover with an email input + "Activer"
 *   button. Tooltip reads "Activer les alertes email".
 * - Subscribed: shows a filled emerald mail icon. Tooltip reads
 *   "Alertes email activées sur {email}". Clicking unsubscribes directly
 *   (no popover).
 *
 * SMTP credentials are never touched here — this component only talks to
 * `/api/email/*` via relative URLs.
 */
export function EmailToggle() {
  const t = useTranslations("email");
  const { mounted, subscribed, email, state, subscribe, unsubscribe } =
    useEmailAlerts();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Avoid hydration mismatch — render nothing until mounted on the client.
  if (!mounted) return null;

  const isBusy = state === "subscribing" || state === "unsubscribing";

  const handleSubscribe = async () => {
    setError(null);
    const trimmed = value.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t("invalid"));
      return;
    }
    const ok = await subscribe(trimmed);
    if (ok) {
      setValue("");
      setOpen(false);
    } else {
      setError(t("invalid"));
    }
  };

  const handleTriggerClick = () => {
    if (subscribed) {
      unsubscribe();
    } else {
      setOpen((v) => !v);
    }
  };

  const tooltipText = subscribed
    ? t("subscribed", { email: email ?? "" })
    : t("tooltip");

  return (
    <TooltipProvider delayDuration={300}>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleTriggerClick}
                aria-label={
                  subscribed ? t("unsubscribe") : t("subscribe")
                }
                aria-pressed={subscribed}
                className={cn(
                  "relative",
                  subscribed &&
                    "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                )}
              >
                {subscribed ? (
                  <MailCheck className="h-4 w-4" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {subscribed && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{tooltipText}</TooltipContent>
        </Tooltip>

        <PopoverContent
          align="end"
          className="w-72"
          // Keep focus inside the popover for keyboard users.
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold">{t("tooltip")}</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubscribe();
              }}
              className="flex flex-col gap-2"
            >
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("placeholder")}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(null);
                }}
                aria-label={t("placeholder")}
                aria-invalid={Boolean(error)}
                disabled={isBusy}
                className="h-9"
              />
              {error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={isBusy || value.trim().length === 0}
                className="h-9 w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {state === "subscribing" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {t("subscribe")}
              </Button>
            </form>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
