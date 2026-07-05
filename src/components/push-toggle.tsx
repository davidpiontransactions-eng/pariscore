"use client";

import { Bell, BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PushToggle() {
  const t = useTranslations("push");
  const { supported, subscribed, subscribe, unsubscribe } = usePushNotifications();

  if (!supported) return null;

  const handleClick = () => {
    if (subscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            aria-label={subscribed ? t("unsubscribe") : t("subscribe")}
            className={cn(
              "relative",
              subscribed && "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            )}
          >
            {subscribed ? (
              <BellRing className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {subscribed && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {subscribed ? t("subscribed") : t("tooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
