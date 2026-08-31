"use client";

import { useState, useEffect } from "react";
import { cn } from "@//lib/utils";
import { useTranslations } from "next-intl";
import {
  Bell,
  Calendar,
  Filter,
  AlertTriangle,
  CheckCircle,
  X,
} from "lucide-react";

type AlertType = 
  | "valueBet" 
  | "liveShift" 
  | "weeklySummary" 
  | "sportFilter";

type ToggleState = {
  [ key in AlertType ]: boolean;
};

type AlertPreferencesState = {
  preferences: ToggleState;
  setPreferences: (prefs: ToggleState) => void;
};

const ALERT_KEYS = {
  valueBet: "alert:valueBet",
  liveShift: "alert:liveShift",
  weeklySummary: "alert:weeklySummary",
  sportFilter: "alert:sportFilter",
};

const INITIAL_PREFS: ToggleState = {
  valueBet: true,
  liveShift: true,
  weeklySummary: true,
  sportFilter: true,
};

function getStoredPreferences(): ToggleState {
  if (typeof window === "undefined") return INITIAL_PREFS;
  try {
    const stored = localStorage.getItem(ALERT_KEYS.valueBet);
    // In a real implementation, we'd read all 4 prefs from localStorage
    // For now, use a simple approach
    return INITIAL_PREFS;
  } catch {
    return INITIAL_PREFS;
  }
}

export function useAlertPreferences() {
  const [preferences, setPreferences] = useState<ToggleState>(getStoredPreferences);
  const t = useTranslations("alerts");

  // Save to localStorage when preferences change
  useEffect(() => {
    try {
      localStorage.setItem(ALERT_KEYS.valueBet, preferences.valueBet.toString());
      localStorage.setItem(ALERT_KEYS.liveShift, preferences.liveShift.toString());
      localStorage.setItem(ALERT_KEYS.weeklySummary, preferences.weeklySummary.toString());
      localStorage.setItem(ALERT_KEYS.sportFilter, preferences.sportFilter.toString());
    } catch {
      // Ign localStorage errors
    }
  }, [ preferences ]);

  return { preferences, setPreferences, t };
}

export function AlertPreferencesModal() {
  const { preferences, setPreferences, t } = useAlertPreferences();

  const toggleHandler = (type: AlertType) => {
    setPreferences((prev) => ({
      ... prev,
      [ type ]: ! prev[ type ],
    }));
  };

  return (
    <div
      className="fixed inset-0 bg-gray-600/80 backdrop-blur z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title-1"
    >
      <div
        className="bg-card/90 rounded--xl p-6 sm:p-8 max-w-sm w-full outline-none shadow--xl"
        id="modal-title-1"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{t("modal-title")}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("close-button-aria-label")}
            onClick={() => setPreferences(INITIAL_PREFS)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Value bet alert toggle */}
          <div>
            <Bell className="h-5 w-5 mr-3 text-emerald-500 " />
            <Label className="font-medium text-base">
              <span className="flex items-center gap-2">
                <Bell className="h-3 w-3 text-emerald-500 " />
                {t("valueBet.label")}
              </span>
            </Label>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {t("valueBet.description")}
            </div>
          </div>

          {/* Live shift alert toggle */}
          <div>
            <AlertTriangle className="h-5 w-5 mr-3 text-amber-500 " />
            <Label className="font-medium text-base">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-amber-500 " />
                {t("liveShift.label")}
              </span>
            </Label>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {t("liveShift.description")}
            </div>
          </div>

          {/* Weekly summary toggle */}
          <div>
            <Calendar className="h-5 w-5 mr-3 text-emerald-500 " />
            <Label className="font-medium text-base">
              <span className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-emerald-500 " />
                {t("weeklySummary.label")}
              </span>
            </Label>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {t("weeklySummary.description")}
            </div>
          </div>

          {/* Sport-specific filter toggle */}
          <div>
            <Filter className="h-5 w-5 mr-3 text-emerald-500 " />
            <Label className="font-medium text-base">
              <span className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-emerald-500 " />
                {t("sportFilter.label")}
              </span>
            </Label>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {t("sportFilter.description")}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => {
              // Save preferences (already saved via useEffect)
              // Close modal
              // You could trigger a close event here
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t("save.button")}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setPreferences(INITIAL_PREFS)}
            className="text-muted-foreground hover:bg-muted/10"
          >
            {t("cancel.button")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const Label = ({ className, children }: { className: string; children: React.ReactNode }) => (
  <span className={className}>{children}</span>
);

const Button = ({
  className,
  variant,
  onClick,
  ...props
}: {
  className: string;
  variant?: "default" | "outline" | "ghost";
  onClick: () => void;
  [key: string]: any;
}) => (
  <button
    className={className}
    onClick={onClick}
    {...props}
  />
);

export { AlertPreferencesModal as AlertPreferences };