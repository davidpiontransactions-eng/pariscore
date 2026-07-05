"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Check, X, Send } from "lucide-react";
import { useAnalytics } from "@/components/analytics-provider";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "data" | "ux" | "other";

export function FeedbackWidget() {
  const t = useTranslations("errors.feedback");
  const { track } = useAnalytics();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("bug");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setDescription("");
        setType("bug");
        setSubmitted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleSubmit = () => {
    const feedbackEvent = {
      type,
      description: description.trim(),
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    // Capture in Sentry as a feedback event (with user context)
    Sentry.captureMessage(`[Feedback] ${type}: ${description.slice(0, 80)}`, {
      level: type === "bug" ? "error" : "info",
      tags: {
        feedback_type: type,
        feedback_source: "user_widget",
      },
      extra: feedbackEvent,
    });

    // Also track in PostHog (gated by consent)
    track("feedback_submitted", feedbackEvent);

    setSubmitted(true);
    // Auto-close after 2s
    setTimeout(() => setOpen(false), 2000);
  };

  return (
    <>
      {/* Floating trigger button — bottom-right, above consent banner */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("trigger")}
        className={cn(
          "fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full",
          "bg-card border border-border/70 shadow-lg backdrop-blur-md",
          "text-muted-foreground transition-all hover:scale-105 hover:text-foreground",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <Bug className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-md p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bug className="h-4 w-4 text-emerald-600" />
              {t("title")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("subtitle")}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">{t("success")}</p>
            </div>
          ) : (
            <div className="space-y-4 px-5 py-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("type")}
                </label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as FeedbackType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">{t("types.bug")}</SelectItem>
                    <SelectItem value="data">{t("types.data")}</SelectItem>
                    <SelectItem value="ux">{t("types.ux")}</SelectItem>
                    <SelectItem value="other">{t("types.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("description")}
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("placeholder")}
                  rows={4}
                  maxLength={500}
                  className="resize-none"
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {description.length}/500
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  {t("cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  className="bg-emerald-600 text-xs hover:bg-emerald-700"
                >
                  <Send className="mr-1.5 h-3 w-3" />
                  {t("submit")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
