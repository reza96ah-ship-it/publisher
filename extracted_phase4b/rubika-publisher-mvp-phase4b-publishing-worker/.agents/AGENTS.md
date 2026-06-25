# Nashrino SocialOps — Workspace Agent Rules

## Project Identity
- Product name: **نشرینو** (Nashrino)
- Root path (WSL): `/home/reza/projects/rubika-publisher-mvp`
- Windows WSL path: `\\wsl.localhost\Ubuntu\home\reza\projects\rubika-publisher-mvp`
- Frontend runs on: `http://localhost:3100`
- Backend runs on: `http://localhost:8000`

## Stack
- **Frontend**: Next.js 15 App Router + Tailwind CSS (RTL, Persian-first)
- **Backend**: FastAPI + SQLAlchemy + Alembic (migrations)
- **Queue**: Redis + Celery (worker + beat)
- **DB**: PostgreSQL 16
- **Runtime**: Docker Compose (`docker compose up -d --build` from WSL)

## Key Files
- Master roadmap: `docs/Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md`
- Instagram automation PRD: `docs/INSTAGRAM_COMMENT_TO_DM_AUTOMATION_PRD.md`
- Sidebar nav: `frontend/components/sidebar.tsx`
- App shell: `frontend/components/app-shell.tsx`
- Backend routes: `backend/app/routes/`
- Backend services: `backend/app/services/`
- DB models: `backend/app/models.py`
- Celery worker: `backend/app/worker.py`

## Navigation Model (Phase 1 — Finalized)
Primary sidebar nav (10 items):
1. داشبورد `/`
2. ساخت `/compose`
3. برنامه‌ریز `/calendar` — Queue `/queue` is a secondary sub-view via tab bar
4. کمپین‌ها `/campaigns`
5. محتوا `/content`
6. رسانه `/media`
7. پیام‌ها `/inbox`
8. گزارش‌ها `/analytics` — Logs `/logs` is a secondary sub-view via tab bar
9. کانال‌ها `/channels`
10. تنظیمات `/store`

Queue and Logs are **NOT** in the primary sidebar. They are reachable via secondary tab bars
inside `/calendar` (برنامه‌ریز section) and `/analytics` (گزارش‌ها section).

## Development Workflow
- Always validate with: `docker compose exec frontend npm run check`
- Always validate backend with: `docker compose exec backend pytest`
- **E2E Testing Workflow:** For each development phase, after the core feature code is complete:
  1. Document a detailed E2E Test Case Scenario in the walkthrough/PRD.
  2. Write E2E browser test specs in `frontend/tests/e2e/` using Playwright.
  3. Verify the browser E2E flows and ensure E2E checks pass successfully before completing the phase.
- Do NOT add new primary nav items without updating this AGENTS.md
- Design system tokens are in `frontend/design-tokens/` and `frontend/app/globals.css`
- Persian digit normalization utility is in `backend/app/services/instagram_automation.py`

## Conventions
- RTL layout: all pages use RTL, Persian text, Jalali dates
- Tailwind class design tokens: use `app-*` and `Nashrino-*` classes from globals.css
- No hardcoded inline colors unless inside `media-image-editor.tsx` (allowed exception)
- All new backend routes must be registered in `backend/app/main.py`
- All new DB models must have an Alembic migration
- Instagram automation only works for professional accounts; personal = reminder mode only

