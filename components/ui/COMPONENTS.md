# Nashrino Unified Component System

This directory contains the canonical, hardened components used across Nashrino. All pages must use these components instead of page-specific styling.

## Core Components

### Button
Unified button system with consistent radius (8px), height scale, and states.

**Variants:**
- `primary` - Main action (app-primary color)
- `secondary` - Alternative action (border + surface)
- `tertiary` - Subtle action (text only)
- `destructive` - Danger action (red)
- `ghost` - Minimal action (hover only)

**Sizes:**
- `sm` (8px height)
- `md` (9px height) - default
- `lg` (10px height)
- `icon` (9x9px)
- `icon-sm` (8x8px)

**Usage:**
```tsx
import { Button } from "@/components/ui/button";

<Button variant="primary" size="md">
  ذخیره
</Button>
```

### StatusToken
Unified status indicator with consistent sizing and colors.

**Status Options:**
- `success` (emerald) - Successful action
- `warning` (amber) - Warning state
- `alert` (rose) - Error/alert state
- `info` (blue) - Informational
- `neutral` (slate) - Neutral state

**Sizes:**
- `sm` (6x6px)
- `md` (8x8px) - default
- `lg` (10x10px)

**Usage:**
```tsx
import { StatusToken } from "@/components/ui/status-token";

<StatusToken status="success" size="md">
  ✓
</StatusToken>
```

### MetricTile
KPI/metric card used everywhere: dashboard, campaigns, analytics, reports.

**Props:**
- `label` - Label text (e.g., "Posts Published")
- `value` - Numeric/text value to display
- `change` - Optional trend indicator (up/down/neutral + value)
- `icon` - Optional Lucide icon
- `variant` - `"glass"` (default) or `"solid"`

**Usage:**
```tsx
import { MetricTile } from "@/components/ui/metric-tile";

<MetricTile
  label="Posts Published"
  value={42}
  change={{ value: 12, direction: "up", label: "this week" }}
  icon={Share2}
/>
```

### Panel
Unified workspace/command area with glass or solid variant.

**Variants:**
- `glass` - Translucent, subtle depth (default)
- `solid` - Opaque white background
- `muted` - Muted surface background

**Usage:**
```tsx
import { Panel } from "@/components/ui/panel";

<Panel variant="glass">
  <h3>Command Center</h3>
  {/* content */}
</Panel>
```

### DataRow / DataTable
Unified list/table component with consistent hover/select states.

**Usage:**
```tsx
import { DataTable, DataRow } from "@/components/ui/data-row";

<DataTable>
  <DataRow selectable selected={selected} onClick={() => setSelected(!selected)}>
    <span>Campaign Name</span>
    <span className="ml-auto">12 posts</span>
  </DataRow>
  <DataRow>
    <span>Another Campaign</span>
    <span className="ml-auto">8 posts</span>
  </DataRow>
</DataTable>
```

## Design System Rules

### Radius Scale
- **8px** - Buttons, tags, small controls
- **8-10px** - Compact rows, cards
- **10-12px** - KPI cards, workbench panels
- **12-16px** - Modals, drawers
- **Pills only** for: dots, avatars, progress ends, true pill statuses

**Rule:** No page should mix sharp 2px controls with huge 24px cards.

### Color System
- **Status Success** - `emerald` (trees/nature)
- **Status Warning** - `amber` (caution)
- **Status Alert** - `rose` (danger)
- **Status Info** - `blue` (neutral info)
- **Neutral** - `slate` (backgrounds)

### Height Scale
- **sm** - 8px (packed controls)
- **md** - 9-10px (default buttons)
- **lg** - 10-11px (prominent actions)
- **icon** - Fixed square 9x9px

## Enforced Patterns

✅ **DO:**
- Use these components everywhere
- Extend components with `className` if needed
- Create new components here if discovering page-specific patterns

❌ **DON'T:**
- Page-specific button styling
- Hardcoded radius values
- Duplicate status token CSS
- Multiple KPI card implementations
- Inconsistent panel backgrounds

## Component Inventory

| Component | Files | Status |
|-----------|-------|--------|
| Button | `button.tsx` | ✅ |
| StatusToken | `status-token.tsx` | ✅ |
| MetricTile | `metric-tile.tsx` | ✅ |
| Panel | `panel.tsx` | ✅ |
| DataRow | `data-row.tsx` | ✅ |

## Adoption Checklist

- [ ] Replace all page buttons with `<Button>`
- [ ] Replace all status badges with `<StatusToken>`
- [ ] Replace all KPI cards with `<MetricTile>`
- [ ] Replace all panels with `<Panel>`
- [ ] Replace all table/list rows with `<DataRow>`
- [ ] Remove all page-specific button CSS
- [ ] Remove all page-specific status CSS

