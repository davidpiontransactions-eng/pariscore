"use client";

import { useState, useCallback, useMemo } from "react";

/**
 * Hook notifications récentes — feed avec priorités.
 * Stocke les notifications en mémoire (session).
 * Types : LIVE (rouge), VALUE (vert), ALERT (ambre), INFO (gris)
 */

export type NotificationPriority = "live" | "value" | "alert" | "info";

export type NotificationItem = {
  id: string;
  priority: NotificationPriority;
  title: string;
  body?: string;
  timestamp: number;
  read: boolean;
  href?: string;
};

const PRIORITY_CONFIG: Record<
  NotificationPriority,
  { color: string; bgColor: string; label: string }
> = {
  live: {
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    label: "LIVE",
  },
  value: {
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    label: "VALUE",
  },
  alert: {
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    label: "ALERT",
  },
  info: {
    color: "text-muted-foreground",
    bgColor: "bg-muted/30 border-border",
    label: "INFO",
  },
};

export function useNotifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const add = useCallback(
    (item: Omit<NotificationItem, "id" | "timestamp" | "read">) => {
      const newItem: NotificationItem = {
        ...item,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        read: false,
      };
      setItems((prev) => [newItem, ...prev].slice(0, 50)); // max 50
    },
    []
  );

  const markRead = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const { unread, unreadCount, byPriority } = useMemo(() => {
    const u = items.filter((n) => !n.read);
    return {
      unread: u,
      unreadCount: u.length,
      byPriority: {
        live: items.filter((n) => n.priority === "live"),
        value: items.filter((n) => n.priority === "value"),
        alert: items.filter((n) => n.priority === "alert"),
        info: items.filter((n) => n.priority === "info"),
      },
    };
  }, [items]);

  return {
    items,
    unread,
    unreadCount,
    byPriority,
    add,
    markRead,
    markAllRead,
    clear,
    config: PRIORITY_CONFIG,
  };
}
