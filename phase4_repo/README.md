# Nashrino SocialOps Studio

Persian-first, RTL-native, Jalali-native social operations platform for planning, creating, scheduling, publishing, monitoring, and reporting content across Rubika, Instagram, and future channels.

The project started as a Rubika publisher MVP, but the product direction is now a multi-channel SocialOps web app inspired by the workflow maturity of Buffer, Hootsuite, Sprout Social, and Later, while staying focused on Persian commerce and content teams.

## Current Product Scope

- Admin authentication and workspace/store profile.
- Rubika publishing setup, health checks, worker delivery, retries, and publish attempts.
- Instagram channel foundation with professional-account API path and personal-account reminder/manual mode.
- Instagram automation roadmap for compliant comment-to-DM/private-reply workflows on professional accounts.
- Multi-channel composer with campaign, schedule, readiness, media, and preview flows.
- Jalali planner/calendar.
- Campaign command center with portfolio, overview, calendar, posts, media, and report views.
- Content library, media library, Persian-first image editor, queue, logs, inbox, notifications, and analytics foundations.

## Canonical Product Plan

The PRD, RFP, roadmap, design direction, backlog, architecture notes, and phase plan live in one source of truth:

[docs/Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md](docs/Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md)

The Instagram comment-to-DM automation feature has a dedicated product spec:

[docs/INSTAGRAM_COMMENT_TO_DM_AUTOMATION_PRD.md](docs/INSTAGRAM_COMMENT_TO_DM_AUTOMATION_PRD.md)

## Stack

- Frontend: Next.js + Tailwind CSS
- Backend: FastAPI
- Database: PostgreSQL
- Queue: Redis
- Worker: Celery
- Local runtime: Docker Compose on Windows WSL2 Ubuntu

## Run Locally

From WSL Ubuntu:

```bash
cd /home/reza/projects/rubika-publisher-mvp
cp .env.example .env
docker compose up -d --build
```

Frontend:

```text
http://localhost:3100
```

The frontend container listens on `3000` internally, but Docker Compose exposes it on host port `3100` by default through `FRONTEND_PORT=3100`, so it does not conflict with local tools that use port `3000`.

Backend:

```text
http://localhost:8000/health
http://localhost:8000/health/db
```

## Useful Commands

```bash
docker compose ps
docker compose logs --tail=120 frontend
docker compose logs --tail=120 backend
docker compose exec backend python -m compileall app
docker compose exec frontend npm run check
```

## Canonical Navigation Structure

The navigation follows the single-source-of-truth design documented in [docs/Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md](docs/Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md).

### Target Primary Navigation
1. **داشبورد** (`/`) - Dashboard overview
2. **ساخت** (`/compose`) - Content creation studio
3. **برنامه‌ریزی** (`/calendar`) - Jalali calendar planner
4. **کمپین‌ها** (`/campaigns`) - Campaign management
5. **محتوا** (`/content`) - Content library
6. **رسانه** (`/media`) - Media library & editor
7. **پیام‌ها** (`/inbox`) - Notifications, comments, DMs, and automation events
8. **گزارش‌ها** (`/analytics`) - Performance and operations reports
9. **کانال‌ها** (`/channels`) - Channel management hub
10. **تنظیمات** (`/store`) - Workspace settings

Operational routes such as `/queue` and `/logs` still exist, but the target product model treats them as secondary views inside Planner/Reports rather than permanent primary navigation items.

### Navigation Consolidation Status
✅ Quick Create FAB removed (eliminated 4th redundant entry point)
✅ Queue & Logs as direct nav items (no hidden multiplexing)
✅ Channel pages show breadcrumbs (کانال‌ها > Rubika/Instagram)
✅ Single entry point per major feature
✅ Mobile-first responsive navigation

## Current Phase

Phase 5: Instagram Comment-to-DM Automation MVP (🚧 In Progress - Foundations Complete).

- **Latest Completed Work:** Navigation Finalization (Phase 1), Meta OAuth & linked accounts discovery (Phase 4), and Instagram Webhook & Celery automation worker (Phase 5 - Backend logic, Persian/Arabic digit normalization, idempotency, and local test simulator).
- **Next Steps:**
  1. **Composer Pro Phase 2:** Integrate comment automation settings directly inside the creation workbench so rules can be configured and attached when scheduling/publishing posts.
  2. **Instagram Publishing Adapter:** Support automatic direct publishing of scheduled media/carousels to connected professional Instagram accounts.
  3. **Inbox & Reports Pro:** Stream automation matched events/errors to the inbox and display analytics widgets in reports.

