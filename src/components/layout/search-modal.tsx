"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, X, Trophy, Users, MapPin, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"
import { useSearchApi, type SearchResult } from "@/hooks/use-search-api"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  Icône par catégorie                                                */
/* ------------------------------------------------------------------ */

function ResultIcon({ type }: { type: SearchResult["icon"] }) {
  switch (type) {
    case "match":
      return <Trophy className="h-4 w-4 text-emerald-400" />
    case "team":
      return <Users className="h-4 w-4 text-sky-400" />
    case "league":
      return <MapPin className="h-4 w-4 text-amber-400" />
  }
}

/* ------------------------------------------------------------------ */
/*  Catégorisation                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<SearchResult["icon"], string> = {
  match: "Matchs",
  team: "Équipes",
  league: "Ligues",
}

const CATEGORY_ORDER: SearchResult["icon"][] = ["match", "team", "league"]

function groupResults(results: SearchResult[]) {
  const groups: Record<SearchResult["icon"], SearchResult[]> = {
    match: [],
    team: [],
    league: [],
  }
  for (const r of results) {
    groups[r.icon].push(r)
  }
  return groups
}

/* ------------------------------------------------------------------ */
/*  Hook : raccourci clavier + état                                     */
/* ------------------------------------------------------------------ */

export function useSearchModal() {
  const [open, setOpen] = useState(false)

  const toggle = useCallback(() => setOpen((o) => !o), [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [toggle])

  return { open, onOpenChange: setOpen, toggle }
}

/* ------------------------------------------------------------------ */
/*  Composant principal                                                */
/* ------------------------------------------------------------------ */

export default function SearchModal({ open, onOpenChange, trigger }: SearchModalProps) {
  const t = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const { results, loading, query, setQuery } = useSearchApi(12)

  const grouped = groupResults(results)

  /* Résultat plat pour la navigation clavier */
  const flatResults = CATEGORY_ORDER.flatMap((cat) => grouped[cat])

  /* Navigation vers résultat sélectionné */
  const navigateTo = useCallback(
    (item: SearchResult) => {
      onOpenChange(false)
      if (item.href) {
        window.location.href = item.href
      }
    },
    [onOpenChange],
  )

  /* Réinitialiser l'index actif à chaque changement de requête */
  useEffect(() => {
    setActiveIdx(-1)
  }, [query])

  /* Focus automatique à l'ouverture */
  useEffect(() => {
    if (open) {
      // Petit délai pour laisser framer-motion monter l'élément
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
    setQuery("")
    setActiveIdx(-1)
  }, [open])

  /* Scroll de l'élément actif dans la vue */
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll("[data-search-item]")
    items[activeIdx]?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  /* Fermeture sur Esc */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % flatResults.length)
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + flatResults.length) % flatResults.length)
      }
      if (e.key === "Enter" && activeIdx >= 0) {
        const selected = flatResults[activeIdx]
        if (selected) {
          navigateTo(selected)
        }
      }
    },
    [activeIdx, flatResults, navigateTo],
  )

  /* Index global pour la navigation clavier */
  let globalIdx = -1

  return (
    <>
      {/* Bouton déclencheur optionnel */}
      {trigger && (
        <button
          onClick={() => onOpenChange(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          {trigger}
        </button>
      )}

      <AnimatePresence>
        {open && (
          /* Overlay */
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center liquid-glass--clear pt-[15vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onOpenChange(false)}
            role="dialog"
            aria-label="Recherche"
            aria-modal="true"
          >
            {/* Modale */}
            <motion.div
              className={cn(
                "w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-card via-popover to-card shadow-2xl shadow-black/40",
              )}
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              {/* Champ de recherche */}
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-emerald-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("search.placeholder", {
                    defaultValue: "Rechercher un match, équipe, ligue…",
                  })}
                  aria-label={t("search.placeholder", {
                    defaultValue: "Rechercher un match, équipe, ligue…",
                  })}
                  className="flex-1 bg-transparent text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label="Effacer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <kbd className="pointer-events-none hidden rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 sm:inline">
                  Esc
                </kbd>
              </div>

              {/* Résultats */}
              <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("search.loading", { defaultValue: "Recherche…" })}
                  </div>
                )}

                {!loading && flatResults.length === 0 && query.trim().length >= 2 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("search.noResults", { defaultValue: "Aucun résultat trouvé." })}
                  </p>
                )}

                {!loading && flatResults.length === 0 && query.trim().length < 2 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("search.hint", { defaultValue: "Tapez au moins 2 caractères…" })}
                  </p>
                )}

                {CATEGORY_ORDER.map((cat) => {
                  const items = grouped[cat]
                  if (items.length === 0) return null
                  return (
                    <div key={cat} className="mb-2">
                      <p className="mb-1 px-2 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      {items.map((item) => {
                        globalIdx++
                        const idx = globalIdx
                        const isActive = idx === activeIdx
                        return (
                          <button
                            key={item.id}
                            data-search-item
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                              isActive
                                ? "bg-emerald-500/10 text-foreground shadow-sm"
                                : "text-foreground/80 hover:bg-white/[0.04]",
                            )}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => navigateTo(item)}
                          >
                            <ResultIcon type={item.icon} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{item.name}</p>
                              {item.subtitle && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Barre de statut */}
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2 text-[11px] text-zinc-400">
                <span>
                  {loading
                    ? t("search.loading", { defaultValue: "Recherche…" })
                    : `${flatResults.length} résultat${flatResults.length !== 1 ? "s" : ""}`}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px]">↑</kbd>
                    <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px]">↓</kbd>
                    naviguer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded-md border border-white/[0.08] bg-white/[0.04] px-1 py-0.5 text-[10px]">↵</kbd>
                    ouvrir
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
