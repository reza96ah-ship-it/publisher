# Component System Migration Guide

## Phase 2a: Foundation (✅ COMPLETE)
- [x] Created unified Button component
- [x] Created unified StatusToken component
- [x] Created unified MetricTile component
- [x] Created unified Panel component
- [x] Created unified DataRow/DataTable components
- [x] Created ButtonLink for Next.js Link integration
- [x] Documented component system

## Phase 2b: Adoption (🚧 IN PROGRESS)
Gradual migration of existing pages to use new components.

### Migration Steps

#### Step 1: Replace Generic Buttons
**File:** components that use raw `<button>` tags

```tsx
// Before
<button className="rounded-md bg-blue-600 text-white hover:bg-blue-700">
  Save
</button>

// After
import { Button } from "@/components/ui/button";

<Button variant="primary">
  Save
</Button>
```

#### Step 2: Replace Link Buttons
**Files:** Pages using `<Link>` as buttons

```tsx
// Before
<Link href="/campaigns" className="rounded-md bg-blue-600 text-white">
  Create Campaign
</Link>

// After
import { ButtonLink } from "@/components/ui/button-link";

<ButtonLink href="/campaigns" variant="primary">
  Create Campaign
</ButtonLink>
```

#### Step 3: Replace Status Badges
**Files:** dashboard, campaigns, logs, etc.

```tsx
// Before
<span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
  ✓
</span>

// After
import { StatusToken } from "@/components/ui/status-token";

<StatusToken status="success" size="sm">
  ✓
</StatusToken>
```

#### Step 4: Replace KPI Cards
**Files:** dashboard, campaigns, analytics, reports

```tsx
// Before
<div className="rounded-lg p-4 bg-white/30 backdrop-blur-xl border border-white/20">
  <p className="text-xs text-app-muted">Posts Published</p>
  <p className="text-2xl font-black text-app-text">42</p>
</div>

// After
import { MetricTile } from "@/components/ui/metric-tile";
import { Share2 } from "lucide-react";

<MetricTile
  label="Posts Published"
  value={42}
  change={{ value: 12, direction: "up" }}
  icon={Share2}
/>
```

#### Step 5: Replace Panels
**Files:** All components using `.app-studio-panel`

```tsx
// Before
<div className="rounded-lg p-4 bg-white/30 backdrop-blur-xl border border-white/20">
  {content}
</div>

// After
import { Panel } from "@/components/ui/panel";

<Panel variant="glass">
  {content}
</Panel>
```

#### Step 6: Replace Table/List Rows
**Files:** tables in campaigns, content, queue, logs

```tsx
// Before
<div className="flex items-center gap-3 px-3 py-2.5 rounded-md border hover:bg-app-soft">
  <span>{content}</span>
</div>

// After
import { DataRow } from "@/components/ui/data-row";

<DataRow selectable selected={isSelected}>
  <span>{content}</span>
</DataRow>
```

### Files to Migrate (Priority Order)

**High Priority** (many duplicates):
- [ ] app/dashboard/page.tsx (KPI cards)
- [ ] app/campaigns/page.tsx (buttons + panels)
- [ ] app/analytics/page.tsx (KPI cards + charts)
- [ ] components/dashboard-command-center.tsx (buttons + panels)

**Medium Priority**:
- [ ] app/compose/page.tsx (buttons)
- [ ] app/queue/page.tsx (rows + buttons)
- [ ] app/logs/page.tsx (rows + buttons)
- [ ] app/media/page.tsx (buttons)

**Lower Priority** (specialized):
- [ ] components/media-image-editor.tsx (internal buttons)
- [ ] components/composer-schedule-panel.tsx (internal buttons)

### Benefits of Migration

✅ **Consistency** - Same button sizes, colors, radius across app
✅ **Maintainability** - Change design in one place, affects everywhere
✅ **Accessibility** - Unified ARIA labels and focus states
✅ **Performance** - Shared component code reduces bundle size
✅ **Velocity** - Faster to build new features with pre-built components

### No Breaking Changes

- New components are opt-in
- Existing code continues to work
- Gradual adoption over time
- Can migrate page-by-page

## Adoption Metrics

Track migration progress:
- [ ] 25% of buttons migrated
- [ ] 50% of buttons migrated
- [ ] 75% of buttons migrated
- [ ] 100% of buttons migrated
- [ ] All status tokens migrated
- [ ] All KPI cards migrated
- [ ] All panels migrated
- [ ] All table rows migrated

