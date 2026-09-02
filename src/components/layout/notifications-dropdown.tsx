"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellRing,
  Mail,
  MailCheck,
  Calendar,
  CalendarCheck,
  Loader2,
} from "lucide-react";
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
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useEmailAlerts } from "@/hooks/use-email-alerts";
import { useValueBetScanner } from "@/hooks/use-value-bet-scanner";
import {
  useDigestScheduler,
  setDigestEnabled,
} from "@/hooks/use-digest-scheduler";

/**
 * Dropdown unifié de notifications regroupant Push, Email, Digest
 * et indicateurs ValueBetScanner pour PariScore.
 */
export function NotificationsDropdown() {
  const t = useTranslations("Notifications");

  // Hooks d'état
  const push = usePushNotifications();
  const email = useEmailAlerts();
  const valueBet = useValueBetScanner();
  const digest = useDigestScheduler();

  // Popover ouvert/fermé
  const [open, setOpen] = useState(false);

  // Nombre total d'alertes value bet
  const totalAlerts = valueBet.alertsSent;

  // État des canaux
  const pushActive = push.subscribed;
  const emailActive = email.subscribed;
  const digestActive = digest.enabled;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={t("ariaLabel", { count: totalAlerts })}
        >
          {totalAlerts > 0 ? (
            <BellRing className="h-5 w-5 text-emerald-400" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {totalAlerts > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
              {totalAlerts > 99 ? "99+" : totalAlerts}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* En-tête */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <BellRing className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold">{t("title")}</span>
        </div>

        <div className="space-y-1 p-2">
          {/* Section 1 — Value Bets */}
          <CardSection
            icon={<BellRing className="h-4 w-4" />}
            title={t("valueBets")}
            active={totalAlerts > 0}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {t("alertsCount", { count: totalAlerts })}
              </span>
              {valueBet.lastScanAt && (
                <span className="text-muted-foreground">
                  {new Date(valueBet.lastScanAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-emerald-400"
              asChild
            >
              <a href="/settings#value-bets">{t("configure")}</a>
            </Button>
          </CardSection>

          {/* Section 2 — Push */}
          <CardSection
            icon={
              pushActive ? (
                <BellRing className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )
            }
            title={t("push")}
            active={pushActive}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {pushActive ? t("pushEnabled") : t("pushDisabled")}
              </span>
              <ToggleSwitch
                checked={pushActive}
                ariaLabel={t("pushToggle")}
                onToggle={() =>
                  pushActive ? push.unsubscribe() : push.subscribe()
                }
              />
            </div>
            {!push.supported && (
              <p className="text-xs text-destructive">{t("pushUnsupported")}</p>
            )}
            {push.state === "denied" && (
              <p className="text-xs text-destructive">{t("pushDenied")}</p>
            )}
          </CardSection>

          {/* Section 3 — Email */}
          <CardSection
            icon={
              emailActive ? (
                <MailCheck className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )
            }
            title={t("email")}
            active={emailActive}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {emailActive ? t("emailSubscribed") : t("emailUnsubscribed")}
              </span>
              {emailActive && (
                <ToggleSwitch
                  checked={emailActive}
                  ariaLabel={t("emailToggle")}
                  onToggle={() => email.unsubscribe()}
                />
              )}
            </div>
            {!emailActive && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  const addr = form.get("email") as string;
                  if (addr) email.subscribe(addr);
                }}
                className="flex gap-1.5"
              >
                <Input
                  name="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  className="h-8 text-xs"
                  required
                />
                <Button type="submit" size="sm" className="h-8 text-xs">
                  {t("subscribe")}
                </Button>
              </form>
            )}
            {email.state === "subscribing" && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t("emailSubscribing")}
                </span>
              </div>
            )}
          </CardSection>

          {/* Section 4 — Digest quotidien */}
          <CardSection
            icon={
              digestActive ? (
                <CalendarCheck className="h-4 w-4" />
              ) : (
                <Calendar className="h-4 w-4" />
              )
            }
            title={t("digest")}
            active={digestActive}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {digestActive ? t("digestEnabled") : t("digestDisabled")}
              </span>
              <ToggleSwitch
                checked={digestActive}
                ariaLabel={t("digestToggle")}
                onToggle={() => setDigestEnabled(!digestActive)}
              />
            </div>
          </CardSection>
        </div>

        {/* Pied de page */}
        <div className="border-t px-4 py-2.5">
          <Button
            variant="link"
            size="sm"
            className="h-auto w-full p-0 text-xs"
            asChild
          >
            <a href="/settings">{t("fullSettings")}</a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Composants internes
// ---------------------------------------------------------------------------

/** Section carte avec bordure, icône et état actif/inactif */
function CardSection({
  icon,
  title,
  active,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        active
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border bg-muted/30"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={active ? "text-emerald-400" : "text-muted-foreground"}>
          {icon}
        </span>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/** Interrupteur on/off accessible */
function ToggleSwitch({
  checked,
  ariaLabel,
  onToggle,
}: {
  checked: boolean;
  ariaLabel: string;
  onToggle: () => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={onToggle}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              checked ? "bg-emerald-500" : "bg-input"
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
                checked ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-xs">{checked ? "Désactiver" : "Activer"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
