# Sidebar Redesign — Project Filter + Time-Grouped Session List

## Summary

Redesign the desktop app sidebar to match the original Claude Code desktop app:
- Replace project-grouped session list with a **flat, time-grouped list** (Today / Yesterday / Last 7 days / Last 30 days / Older)
- Add a **ProjectFilter dropdown** at the top for multi-select project filtering
- Keep existing features: search, right-click menu (rename + delete), active session indicator, missing dir warning

## Approach

**Plan A: Frontend-only refactor** — modify `Sidebar.tsx`, add `ProjectFilter.tsx`, update `sessionStore.ts`. No backend API changes.

## Components

### 1. ProjectFilter (`desktop/src/components/layout/ProjectFilter.tsx`)

New component providing a multi-select project dropdown.

**UI structure:**
- **Trigger button**: displays current filter state
  - All selected → "All projects"
  - N selected → "N projects"
  - Dropdown arrow (chevron) on the right
- **Dropdown panel** (absolute positioned, below trigger):
  - "All projects" option (toggles select-all / deselect-all)
  - Separator line
  - Per-project items: folder icon + project name + checkmark when selected
  - Project name extracted from sanitized projectPath (last segment)

**Behavior:**
- Default state: "All projects" (empty `selectedProjects` array = show all)
- Click a project → toggle its selection
- Click "All projects" → select all (clear the filter)
- If all projects are individually selected → treat as "All projects"
- Clicking outside the dropdown closes it

**Data source:** Extract unique `projectPath` values from the full session list (`sessions.map(s => s.projectPath)`), deduplicated and sorted alphabetically.

### 2. Sidebar Layout (`desktop/src/components/layout/Sidebar.tsx`)

**Layout (top to bottom):**
1. **+ New session** button (existing)
2. **Scheduled** button (existing)
3. **ProjectFilter** dropdown + settings icon (right side)
4. **Search sessions** input (existing)
5. **Time-grouped session list** (scrollable, main content area)
6. **Settings** button (bottom, existing)

**Time grouping logic — `groupByTime(sessions)`:**

```typescript
type TimeGroup = 'Today' | 'Yesterday' | 'Last 7 days' | 'Last 30 days' | 'Older'

function groupByTime(sessions: SessionListItem[]): Map<TimeGroup, SessionListItem[]> {
  const now = new Date()
  const startOfToday = startOfDay(now)
  const startOfYesterday = startOfDay(subDays(now, 1))
  const sevenDaysAgo = startOfDay(subDays(now, 7))
  const thirtyDaysAgo = startOfDay(subDays(now, 30))

  // Classify each session by modifiedAt into time buckets
  // Within each bucket, sessions are already sorted by modifiedAt desc (from API)
}
```

No external date library needed — use native `Date` arithmetic.

**Removed logic:**
- `getProjectDisplayName()` function
- `groupedSessions` useMemo that groups by projectPath
- Per-project group headers and collapsible groups

**Preserved logic:**
- Search filtering (by title, case-insensitive)
- Active session highlighting (background color)
- Status dot (left side of each session item)
- Right-click context menu (rename + delete)
- "missing dir" warning badge
- Relative timestamp on hover

### 3. Session Store Changes (`desktop/src/stores/sessionStore.ts`)

**New state fields:**
```typescript
selectedProjects: string[]        // empty = all projects (no filter)
availableProjects: string[]       // unique project paths from all sessions
```

**New actions:**
```typescript
setSelectedProjects: (projects: string[]) => void
```

**Modified behavior:**
- `fetchSessions()` called without `project` parameter (fetch all sessions)
- `availableProjects` computed after fetching: `[...new Set(sessions.map(s => s.projectPath))]`
- Filtering by selectedProjects happens in `Sidebar.tsx` via useMemo, not in the store

### 4. Session List Item Rendering

Each session item renders as:

```
[status dot] Session title text...                    [4h]
```

- **Status dot**: small circle, brand color when active (connected), tertiary when inactive
- **Title**: single line, text-ellipsis overflow
- **Timestamp**: relative format (now / 5m / 2h / 3d / 1mo), shown on hover (matching current behavior)
- **Selected state**: `surface-selected` background color
- **Hover state**: `surface-hover` background color
- **Missing dir**: orange "missing dir" badge after title

## What Does NOT Change

- Backend API (`/api/sessions`, `/api/sessions/recent-projects`) — no changes
- Session CRUD operations (create, delete, rename, activate)
- WebSocket connection logic
- Right-click context menu items
- Search functionality (filter by title)
- Settings button at bottom
- Overall sidebar width and theme variables

## File Change Summary

| File | Change Type | Description |
|------|------------|-------------|
| `desktop/src/components/layout/ProjectFilter.tsx` | **New** | Multi-select project dropdown |
| `desktop/src/components/layout/Sidebar.tsx` | **Modify** | Replace project grouping with time grouping, integrate ProjectFilter |
| `desktop/src/stores/sessionStore.ts` | **Modify** | Add selectedProjects/availableProjects state |

## Error Handling

- Empty state: if no sessions match filter + search, show "No sessions found" message
- API failure: existing error handling in sessionStore remains unchanged
- Missing projects: if a session's projectPath doesn't match any known project, it still appears in "All projects" view

## Testing

- Verify time grouping correctly classifies sessions into Today/Yesterday/Last 7 days/Last 30 days/Older
- Verify ProjectFilter multi-select toggles work correctly
- Verify search + project filter work together (intersection)
- Verify right-click menu still works
- Verify active session highlighting persists across filter changes
