# Session: Same Page Filter — Sidebar → Central Content (2026-08-29)

**Scope**: Clic sur un sport/pays/ligue dans la sidebar → filtrage du contenu central (Football/Tennis tab) sur la même page, avec breadcrumb contextuel. Modèle 1xBet/Bet365.

## Compétitive Analysis (10 sources académiques + 5 sites)

- **1xBet**: sidebar sport → pays → ligue → match, contenu central filtré sur même page, breadcrumb "← Retour > Football > England > Premier League"
- **Bet365**: même pattern, navigation hiérarchique sidebar→central
- **Sofascore/Flashscore/Forebet**: sidebar + contenu central filtré
- **Kingsburg 2003**: left-top-top fastest navigation (-17s)
- **Neuhaus 2021** (N=462): sidebar recall 37.5% vs 0% top nav
- **NN/g 2021**: labels textuels obligatoires pour accessibilité
- **Zaphiris 2002**: depth ≤3 idéal pour navigation hiérarchique

## Changes

### Store (`use-sports-sidebar-store.ts`)
- Added `selectedCountryId: string | null` field
- Added `selectCountry(id)` action — sets country, clears league, sets sport
- Updated `clearFilters()` to reset `selectedCountryId`
- Updated `selectSport()` to clear `selectedCountryId`
- Updated `syncStoreToUrl()` + `hydrateStoreFromUrl()` for `country` URL param

### Sidebar (`sports-sidebar.tsx`)
- `CountryBlock`: added `handleCountryClick` calling `toggleCountry` + `selectCountry`; emerald background when `selectedCountryId === country.id`
- `SportBlock`: `active` check now includes `sport.countries.some(c => c.id === selectedCountryId)` — highlights sport when its country is selected
- `SportsSidebarContent`: reads `selectedCountryId` from store, passes to `SportBlock`

### Football tab (`football-tab-content.tsx`)
- Added `selectedCountryId` + `clearCountry` reads from store
- `liveMatches`: filters by `m.league.country` matching `selectedCountryId` (slug format)
- `prematchMatches`: same filter
- Added breadcrumb: `← Retour > Football > [Country] > [League]` with clear actions
- Imported `ChevronRight` from lucide-react

### Tennis tab (`tennis-tab-content.tsx`)
- Added `selectedCountryId` read from store
- `matchesWithScoped`: filters by `m.tournamentCategory` matching `selectedCountryId`
- Added breadcrumb: `← Retour > Tennis > [Category]` with clear action
- Imported `X`, `ChevronRight` from lucide-react

## Data Model Note

- **Football**: `FootballMatch.league.country` = country name ("England"), `selectedCountryId` = slug("England") = "england"
- **Tennis**: `TennisMatch.tournamentCategory` = "Grand Slam"/"ATP Masters 1000"/etc., `selectedCountryId` = slug of category
- **Tree**: `CountryNode.id` = `${sportId}:${slug(countryName)}` — stored as `selectedCountryId`
- **Filtering**: compares slug of match field against `selectedCountryId` directly

## Files Modified
- `src/stores/use-sports-sidebar-store.ts` — store additions
- `src/components/layout/sports-sidebar.tsx` — CountryBlock click, SportBlock highlight, SportsSidebarContent reads
- `src/components/football/football-tab-content.tsx` — country filter + breadcrumb
- `src/components/football/tennis-tab-content.tsx` — country filter + breadcrumb

## Quality Gates
- Lint: 3 pre-existing errors (basketball require imports), 0 new
- TypeCheck: 0 new errors in modified files
- Build: pending

## Commits
- TBD
