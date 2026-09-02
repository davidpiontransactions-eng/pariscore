"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Search, X, Trophy, Users, MapPin } from "lucide-react"
import { useTranslations } from "next-intl"
import { AnimatePresence, motion } from "framer-motion"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchResult {
  id: string
  name: string
  subtitle?: string
  icon: "match" | "team" | "league"
}

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: React.ReactNode
}

/* ------------------------------------------------------------------ */
/*  Données de démonstration                                           */
/* ------------------------------------------------------------------ */

const DEMO_RESULTS: SearchResult[] = [
  { id: "m1", name: "PSG vs Olympique Lyonnais", subtitle: "Ligue 1 — Aujourd'hui", icon: "match" },
  { id: "m2", name: "Real Madrid vs FC Barcelone", subtitle: "La Liga — Demain", icon: "match" },
  { id: "m3", name: "Manchester City vs Liverpool", subtitle: "Premier League — 14h00", icon: "match" },
  { id: "t1", name: "Paris Saint-Germain", subtitle: "France", icon: "team" },
  { id: "t2", name: "Manchester City", subtitle: "Angleterre", icon: "team" },
  { id: "t3", name: "Real Madrid", subtitle: "Espagne", icon: "team" },
  { id: "l1", name: "Ligue 1", subtitle: "France", icon: "league" },
  { id: "l2", name: "Premier League", subtitle: "Angleterre", icon: "league" },
  { id: "l3", name: "La Liga", subtitle: "Espagne", icon: "league" },
  { id: "l4", name: "Serie A", subtitle: "Italie", icon: "league" },
]

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
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(-1)

  /* Résultats filtrés */
  const filtered = DEMO_RESULTS.filter((r) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      r.name.toLowerCase().includes(q) ||
      (r.subtitle && r.subtitle.toLowerCase().includes(q))
    )
  })

  const grouped = groupResults(filtered)

  /* Résultat plat pour la navigation clavier */
  const flatResults = CATEGORY_ORDER.flatMap((cat) => grouped[cat])

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
          // TODO: naviguer vers le détail du résultat
          console.log("Sélection :", selected)
          onOpenChange(false)
        }
      }
    },
    [activeIdx, flatResults, onOpenChange],
  )

  /* Index global pour la navigation clavier */
  let globalIdx = -1

  return (
    <>
      {/* Bouton déclencheur optionnel */}
      {trigger && (
        <button
          onClick={() => onOpenChange(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-[#1a1d2e] px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          {trigger}
        </button>
      )}

      <AnimatePresence>
        {open && (
          /* Overlay */
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[15vh] backdrop-blur-sm"
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
                "w-full max-w-lg overflow-hidden rounded-xl border border-border/60 bg-[#1a1d2e] shadow-2xl",
              )}
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
            >
              {/* Champ de recherche */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("search.placeholder", {
                    defaultValue: "Rechercher un match, équipe, ligue…",
                  })}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                <kbd className="pointer-events-none hidden rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                  Esc
                </kbd>
              </div>

              {/* Résultats */}
              <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
                {flatResults.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("search.noResults", { defaultValue: "Aucun résultat trouvé." })}
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
                              "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                              isActive
                                ? "bg-accent text-foreground"
                                : "text-foreground/80 hover:bg-accent/50",
                            )}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => {
                              console.log("Sélection :", item)
                              onOpenChange(false)
                            }}
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
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
                <span>
                  {flatResults.length} résultat{flatResults.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px]">↑</kbd>
                    <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px]">↓</kbd>
                    naviguer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/60 bg-muted px-1 py-0.5 text-[10px]">↵</kbd>
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
