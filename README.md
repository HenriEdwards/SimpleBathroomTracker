# BathroomCounter — Codex Build Guide (Expo + TypeScript)

Goal: Build an Expo (Expo Router) mobile app MVP for logging bathroom events with two big buttons, local storage, filters, export (locked behind Pro flag), themes (preset placeholders), and a Pro flag system with a temporary dev unlock toggle (removed before launch). No widget in MVP; widget comes later as a native extension.

---

## 0) Constraints + Decisions (lock these)
- Platform: Expo + Expo Router + TypeScript (already scaffolded).
- Storage: local on-device (no server).
- MVP = App only. Widget is Phase 2.
- Monetization: One-time Pro unlock (Google Play Billing / Apple IAP) **later**.
- For now: implement `isPro` feature flag + dev toggle to simulate Pro.
- Exports: PDF + Plain Text + optional CSV (all Pro-locked).
- UI: Two big actions (#1 / #2), show today counts, show last event time for each.
- Event list: flat list, newest first.
- Filters: date range (Today / This week / This month / This year / All) + type (All / Pee / Poop).
- Settings: icon override per type, theme preset, time format 12/24.
- Theming: implement 5 presets with placeholder colors; easy to tweak later.

---

## 1) Project Structure (create/ensure)
Using Expo Router, use this structure:

- `app/index.tsx`             → Home screen (buttons + counts + recent times + list + filters)
- `app/settings.tsx`          → Settings screen
- `app/export.tsx`            → Export screen (Pro-locked actions)
- `app/_layout.tsx`           → Router layout (stack)
- `src/` (new folder)
  - `src/lib/storage.ts`      → storage read/write helpers
  - `src/lib/time.ts`         → time formatting helpers
  - `src/lib/export.ts`       → PDF/text/CSV generation helpers
  - `src/lib/theme.ts`        → theme presets + helper
  - `src/lib/pro.ts`          → pro flag + dev toggle (temporary)
  - `src/types.ts`            → types

If you prefer fewer files, keep it tidy but keep responsibilities separated.

---

## 2) Dependencies (install)
From project root:

- Storage:
  - `@react-native-async-storage/async-storage`

- Export:
  - `expo-print` (PDF generation)
  - `expo-sharing` (share sheet)
  - `expo-file-system` (temporary files)
  - (Optional) `expo-clipboard` (copy plain text quickly)

- UI convenience (optional):
  - none required; keep RN core.

Codex: install the minimal needed.

---

## 3) Data Model (types)
Create `src/types.ts`:

### Event Types
- `EventType = "pee" | "poop"`

### Event Record
- `BathroomEvent`
  - `id: string` (uuid-like; can be `${Date.now()}-${Math.random()}`)
  - `type: EventType`
  - `ts: number` (unix ms timestamp)

### Settings
- `AppSettings`
  - `timeFormat: "24h" | "12h"`
  - `themeId: "t1" | "t2" | "t3" | "t4" | "t5"`
  - `iconPee: string` (emoji/string)
  - `iconPoop: string` (emoji/string)

### Pro State
- `ProState`
  - `isPro: boolean`
  - `devProOverride: boolean` (temporary)

---

## 4) Storage Keys + Storage Layer
Create `src/lib/storage.ts` and centralize all storage IO.

### Keys
- `BC_EVENTS` → array of `BathroomEvent`
- `BC_SETTINGS` → `AppSettings`
- `BC_PRO` → `ProState`

### Functions
- `loadEvents(): Promise<BathroomEvent[]>`
- `saveEvents(events: BathroomEvent[]): Promise<void>`
- `appendEvent(type: EventType): Promise<BathroomEvent>`:
  - loads events
  - creates new event with id + ts
  - unshift to keep newest first
  - save
- `clearAllEvents(): Promise<void>`

- `loadSettings(): Promise<AppSettings>`
  - If none, return defaults:
    - timeFormat: "24h"
    - themeId: "t1"
    - iconPee: "🚽"
    - iconPoop: "💩"
- `saveSettings(settings: AppSettings): Promise<void>`

- `loadProState(): Promise<ProState>`
  - defaults: `{ isPro:false, devProOverride:false }`
- `saveProState(state: ProState): Promise<void>`

Make sure all functions are resilient to missing/corrupt JSON.

---

## 5) Pro Flag System (stub now, real billing later)
Create `src/lib/pro.ts`.

### Rules
- Effective Pro = `isPro || devProOverride`
- In MVP dev builds, provide a toggle to enable Pro temporarily.
- Before store release, remove dev toggle UI and set dev override unreachable.

### Functions
- `getEffectivePro(state: ProState): boolean`
- `setDevProOverride(on: boolean): Promise<void>`
- `setProPurchased(on: boolean): Promise<void>` (for future billing integration)

### UI
- In Settings screen, add a **Developer** section:
  - Switch: “Enable Pro (dev)”
  - Only show if `__DEV__` is true (Expo has `__DEV__` global).
- Pro features check effective Pro and show lock + upgrade CTA.

---

## 6) Time Formatting Helper
Create `src/lib/time.ts`.

- `formatTime(ts:number, mode:"24h"|"12h"): string`
- `formatDate(ts:number): string` like `YYYY-MM-DD`
- `formatDateTime(ts:number, mode): string`

Use device locale cautiously; prefer deterministic formatting.

---

## 7) Theme Presets (placeholders)
Create `src/lib/theme.ts`.

Define 5 theme presets:
- Each theme has:
  - `id: "t1"...`
  - `name: string`
  - colors:
    - `bg`
    - `card`
    - `text`
    - `muted`
    - `primary`
    - `primaryText`
    - `border`

Pick any sane defaults (Codex can choose).
Keep it easy to change later.

Create:
- `getTheme(themeId)` returns theme
- optionally `ThemeContext` for app-wide theme

MVP approach: theme applied at screen level with a `useTheme(settings.themeId)` helper.

---

## 8) Navigation (Expo Router)
Update `app/_layout.tsx`:
- Use a Stack with:
  - Home (`index`)
  - Export (`export`)
  - Settings (`settings`)

Add header buttons on Home:
- Right: “Export”
- Left or Right: “Settings”
(Or two icons; keep simple.)

---

## 9) Home Screen (MVP UI)
File: `app/index.tsx`

### Home UI Layout
Top section:
- Title: “BathroomCounter”
- Two big action cards/buttons side-by-side or stacked (depending on screen width)
  - Pee:
    - Icon (from settings)
    - Label (optional)
    - Today count
    - Last time (small)
    - Big tap area logs event
  - Poop:
    - same pattern

Under buttons:
- Filters row:
  - Date range: Today / Week / Month / Year / All (segmented buttons or picker)
  - Type: All / Pee / Poop

Then:
- Flat list of events (newest first):
  - each row: `[date] [time] [icon/type]`
  - Minimal separators

Footer (optional):
- “Clear data” should live in Settings, not here.

### Behavior
On mount:
- Load settings
- Load events
- Recompute derived stats

When user taps Pee/Poop:
- Append event
- Update list immediately
- Update counts and last times
- Optional micro-haptic (if you want later; not required)

### Derived values
Compute:
- Today counts per type
- Last event time per type (most recent event of that type, regardless of range)
- Filtered events array based on filters

Filter logic:
- Date range should be computed by comparing timestamps to start-of-day/week/month/year.
- Type filter: include only events matching selected type (unless “All”).

Keep all computations in-memory; store only raw events.

---

## 10) Settings Screen
File: `app/settings.tsx`

### Settings UI
Sections:

1) Appearance
- Theme preset selector (list of 5)
- Time format toggle (12h / 24h)

2) Icons / Privacy
- Icon for Pee (text input or simple picker of emojis)
- Icon for Poop (text input or emoji picker-lite)
  - Keep it simple: allow any string up to ~2 chars.

3) Pro
- Show Pro status:
  - If Pro: “Pro unlocked”
  - If not: “Pro locked”
- Button: “Unlock Pro” (stub CTA for now)
  - Should navigate to a placeholder screen/modal explaining “Coming soon” ONLY in dev.
  - For production, replace with billing flow.

4) Developer (DEV only)
- Switch: “Enable Pro (dev)”
  - Only visible when `__DEV__`

5) Data
- Button: “Clear all events”
  - confirm dialog
  - clears events
- Button: “Reset settings”
  - optional

Save settings instantly on change.

---

## 11) Export Screen (Pro-locked)
File: `app/export.tsx`

### Export UX
Single screen with:
- Range selector (same as home)
- Type selector (All / Pee / Poop)
- Preview summary:
  - date range label
  - total counts for selection
- Buttons:
  - “Share PDF” (Pro)
  - “Share Text” (Pro)
  - “Share CSV” (Pro optional)

If not Pro:
- Buttons are disabled or show a lock
- Pressing shows upgrade modal:
  - “Pro unlocks Export + Widget + Themes + Incognito icons”
  - In dev: allow enabling Pro via Settings dev toggle

### Export Content Expectations
- PDF: simple report with:
  - Title + date range
  - totals
  - table of events (date, time, type)
- Text: lines:
  - `YYYY-MM-DD HH:MM – Pee`
- CSV: header `date,time,type,timestamp`

---

## 12) Implement Exports (local)
Create `src/lib/export.ts`.

### Plain text
- Function: `buildPlainText(events, settings): string`
- Use icons OR words (“Pee/Poop”) consistently.
- For doctors, words are clearer; include icon optionally.

### CSV
- Function: `buildCSV(events, settings): string`

### PDF
Using `expo-print`:
- Build a minimal HTML string with inline styles.
- Function: `buildPdfHtml(events, settings, summary): string`
- Then:
  - `printToFileAsync({ html })` -> returns uri
  - `shareAsync(uri)` (or `Sharing.shareAsync`)
  - Use `expo-sharing` and `expo-file-system` as needed

Make sure it works offline and doesn’t require permissions.

---

## 13) Upgrade CTA (stub)
Implement a small component/modal:
- Shows Pro benefits:
  - Export (PDF/Text/CSV)
  - Home Widget (coming later)
  - Theme presets
  - Incognito icons
- In dev:
  - button “Enable Pro (dev)” that flips dev override
- In prod:
  - replace with real purchase flow later

---

## 14) QA Checklist (must pass)
### Core
- Log pee/poop rapidly; counts update correctly.
- Today counts match events whose ts is within today.
- Last time updates per type correctly.
- Events persist after closing app (storage works).
- Filters work: Today/Week/Month/Year/All and type filter.
- Flat list newest first.

### Settings
- Changing icons immediately updates buttons and list.
- Theme changes apply without restart.
- 12/24h format correct.

### Export
- When Pro OFF:
  - Export buttons locked and show upgrade modal.
- When Pro ON (dev):
  - PDF generates and shares
  - Text shares
  - CSV shares
- Export uses filtered selection.

### Stability
- No crashes on empty state (no events).
- No crashes on corrupt storage (handle parse failures by resetting).
- Reasonable performance with 5k+ events (optional: cap list render and keep list virtualized).

---

## 15) Release Prep (later, but note now)
Before launch:
- Remove dev Pro toggle UI (or ensure `__DEV__` gate works).
- Integrate Google Play Billing (one-time IAP) and Apple IAP.
- Replace Pro state with purchase restore flow.
- Update upgrade modal CTA to purchase.
- Add basic privacy policy text (even if offline-only).

NOTE: Do NOT use Stripe for digital unlocks in mobile stores.

---

## 16) Widget Phase 2 (not now; keep as TODO)
- After app MVP ships, prebuild/eject and add native widget extension.
- Widget:
  - Two tappable actions
  - Shows today counts
  - Reads settings (icons/theme)
  - Writes events to same storage
- Android first, iOS later.

---

## 17) Implementation Order (Codex execution plan)
1) Add dependencies.
2) Implement types + storage layer + defaults.
3) Implement Pro layer (effective pro + dev override).
4) Implement theme presets + helper.
5) Build navigation layout.
6) Build Home screen:
   - load settings/events
   - log buttons
   - derived stats
   - filters
   - list
7) Build Settings screen:
   - theme/time/icon settings
   - clear data
   - dev pro toggle (DEV only)
8) Build Export screen:
   - range/type selection
   - Pro-locked export actions
9) Implement export helpers:
   - text, csv, pdf via expo-print
10) QA against checklist.

---

## 18) Notes for Codex (keep it pragmatic)
- Prefer simple React state + `useEffect` for load/save.
- Keep storage writes debounced only if needed; otherwise direct is fine.
- Use `FlatList` for events list.
- Avoid heavy UI libraries.
- Keep styles minimal and readable.
- Keep all "Pro checks" in one helper (`getEffectivePro`) to avoid mistakes.

---

## Done Definition
MVP is done when:
- App logs and persists events
- Displays today counts + last times
- Filters + list work
- Settings work (icons/theme/time format)
- Exports generate/share correctly when Pro enabled (dev)
- Pro-locked UI behaves correctly when Pro disabled

---

END
