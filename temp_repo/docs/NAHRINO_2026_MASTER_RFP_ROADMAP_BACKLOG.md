# Nashrino 2026 Master PRD, RFP, Roadmap, Phases, and Backlog

Last updated: 2026-06-18  
Product direction: Persian-first multi-channel SocialOps platform  
Canonical status: This file is the product source of truth for PRD, RFP, roadmap, backlog, and phase sequencing.  
Companion spec: [Instagram Comment-to-DM Automation PRD](INSTAGRAM_COMMENT_TO_DM_AUTOMATION_PRD.md)

## 1. Executive Summary

Nashrino must move from a Rubika publisher MVP into a professional Persian-first SocialOps platform for small businesses, creators, commerce teams, and agencies. The product should help users plan, create, schedule, publish, monitor, automate, and report content across Rubika, Instagram, and future channels.

The product should compete on workflow clarity, not visual noise. The strongest benchmark products separate creation, planning, engagement, analytics, and channel administration into clear workspaces. Nashrino's advantage is Persian-first UX, RTL-native layout, Jalali-first planning, Rubika support, Instagram professional-account workflows, and practical automation for commerce use cases.

The current app has useful raw capability: authentication, store profile, Rubika publishing, Instagram account modeling, multi-channel composer, Jalali planner, campaign manager, content library, media/image editor, queue/logs, notifications, reports, and channel settings. The main gap is product coherence: too many pages still feel like feature prototypes, actions repeat across surfaces, some navigation routes are operational internals rather than user-facing jobs, and several pages need mobile-first redesign.

The next product target is:

- One identity: `نشرینو`.
- One positioning: Persian-first multi-channel SocialOps.
- One navigation model: dashboard, create, planner, campaigns, content, media, inbox, reports, channels, settings.
- One visual system: compact glass workspace, 8px standard radius, readable Persian typography, subtle motion, clear hierarchy, and real previews.
- One workflow principle: overview first, detail on demand, edit in drawer/modal, never duplicate primary actions.
- One Instagram strategy: professional account API path for auto-publish/engagement; personal account reminder/manual mode only.

## 2. Benchmark Research Summary

Reviewed signals on 2026-06-18:

- Buffer emphasizes simple content creation, organization, repurposing, AI assistance, scheduling, analytics, and a calm unified inbox. Source: https://buffer.com/
- Buffer's 2026 tool guides call out content batching, social automation, AI assistance, unified comments, and workflow simplicity. Source: https://buffer.com/resources/best-social-media-management-tools/
- Hootsuite positions around scheduling, content creation, analytics, social listening, AI, integrations, unified inbox, message automation, and enterprise readiness. Sources: https://www.hootsuite.com/ and https://www.hootsuite.com/plans
- Sprout Social positions around publishing, engagement, reporting, customer care, social intelligence, and AI-driven business insights. Sources: https://sproutsocial.com/ and https://sproutsocial.com/features/
- Later positions around visual planning, influencer/creator campaigns, Instagram-heavy workflows, link-in-bio, media planning, and AI-powered insights. Source: https://later.com/
- Meta documentation confirms Instagram private replies, webhooks, messaging API, content publishing, comment moderation, and rate/policy boundaries for professional accounts. Sources: https://developers.facebook.com/docs/instagram-platform/private-replies/ and https://developers.facebook.com/docs/instagram-platform/webhooks/

## 3. Product Diagnosis

### 3.1 Current Strengths

- Persian-first foundation and RTL app shell.
- Jalali calendar and Jalali mini-pickers.
- Multi-channel data model for Rubika and Instagram.
- Rubika publishing worker, attempts, retry, and health checks.
- Composer with title, caption, hashtags, media, campaign, channel, schedule, readiness, and preview.
- Campaign page with portfolio and campaign workbench foundations.
- Media library and image editor with Persian font direction.
- Inbox/notifications foundation.
- Reports and operational analytics foundation.
- Docker Compose local runtime on port `3100`.

### 3.2 Current Product Risks

- Navigation still exposes operational internals (`queue`, `logs`) as top-level product destinations. These should become views inside Planner/Reports unless power-user mode is enabled.
- Some pages still use dense two-column layouts with nested scrolling, especially planner/campaign/report surfaces.
- Dashboard and redesigned pages are improving, but visual language is not fully applied everywhere.
- Composer is now cleaner but still needs stronger channel-specific previews, mobile step flow, and automation hooks.
- Inbox is currently operational notifications, not a real social inbox for comments, DMs, assignments, and saved replies.
- Instagram is modeled but not yet a production OAuth/webhook/messaging integration.
- Reports need better chart behavior, no horizontal/vertical double scroll, and more useful insight cards.
- Tracked/ignored build artifacts and cache folders should be audited periodically so repo hygiene stays professional.

## 4. Product Vision

Nashrino should become the most practical Persian-first social operations app for teams that sell, publish, and support customers on Persian-language social channels.

The app should feel:

- Professional enough for agencies.
- Simple enough for store owners.
- Fast enough for daily operators.
- Trustworthy enough for real publishing.
- Native to Persian and Jalali workflows.

## 5. Target Users

### Store Owner

Needs a simple way to create posts, schedule promotions, receive comment leads, and understand what needs attention without learning a complex enterprise tool.

### Social Media Operator

Needs a fast daily workspace for posts, media, captions, calendar, queue, comment handling, and error recovery.

### Campaign Manager

Needs campaign-level planning, post coverage, media assets, automation rules, performance, and exportable reporting.

### Agency / Team Lead

Needs workspaces, roles, approvals, audit trails, client reporting, channel health, and operational accountability.

## 6. Product Principles

- Persian-first: Persian language, RTL, Jalali, local commerce patterns.
- Honest channel capability: do not promise Instagram personal auto-publish.
- Mobile-first: every core workflow must be usable on a phone.
- One primary action per screen.
- Details on demand, not permanent large forms.
- Real previews instead of decorative placeholders.
- Operational safety: retries, audit logs, idempotency, rate limits, permission checks.
- Design consistency before feature depth.
- Human override for automation.
- Compliance-first Instagram automation.

## 7. Information Architecture

### 7.1 Target Primary Navigation

1. داشبورد
2. ساخت
3. برنامه‌ریز
4. کمپین‌ها
5. محتوا
6. رسانه
7. پیام‌ها
8. گزارش‌ها
9. کانال‌ها
10. تنظیمات

### 7.2 Route Ownership

Dashboard owns:

- Today state.
- Publishing health.
- Next scheduled post.
- Active campaign summary.
- Channel readiness.
- Alerts requiring action.
- Compact performance/throughput insight.

Dashboard must not own:

- Full onboarding progress after setup is complete.
- Full calendar.
- Full campaign report.
- Duplicate content lists.

Create owns:

- Caption/text creation.
- Media selection and editor entry.
- Channel selection.
- Campaign assignment.
- Schedule selection.
- Platform previews.
- Readiness validation.
- Draft/ready/schedule action.

Planner owns:

- Month/week/list planning.
- Day/post selection.
- Calendar preview modal/drawer.
- Reschedule actions.
- Gap detection.
- Filter by channel/campaign/status.

Campaigns owns:

- Campaign portfolio.
- Campaign detail workbench.
- Campaign posts/media/report/calendar tabs.
- Campaign automation rules.
- Create/edit campaign in drawer.

Content owns:

- Unified content library.
- Saved views.
- One filter system.
- Bulk status/campaign/actions.
- Open in composer.

Media owns:

- Asset library.
- Persian image editor.
- Brand kit assets.
- Templates.
- Export variants.
- Attach to post/campaign.

Inbox owns:

- Comments.
- DMs.
- Operational notifications.
- Assignments.
- Saved replies.
- Automation event review.
- Read/unread/priority.

Reports owns:

- Performance analytics.
- Publishing health.
- Campaign reports.
- Automation reports.
- Exportable reports.

Channels owns:

- Rubika connection.
- Instagram professional OAuth.
- Instagram personal reminder/manual mode.
- Webhook status.
- Permission/capability matrix.
- Channel health tests.

Settings owns:

- Workspace/store profile.
- Brand kit.
- Team and roles.
- Security.
- Billing later.
- API/webhook settings later.

## 8. PRD

### 8.1 Product Goals

- Reduce time from idea to scheduled post.
- Make channel state obvious before publishing.
- Make Instagram automation a lead-generation feature, not a risky bot.
- Make every page mobile-friendly and lower-scroll.
- Give teams a clear operational cockpit.
- Support future channels without rebuilding the product shell.

### 8.2 Success Metrics

- First scheduled post completed in under 5 minutes after setup.
- 0 horizontal overflow on core pages at 390px, 820px, and 1440px.
- 90% of publishing failures show actionable recovery hints.
- Composer save/schedule error rate under 2% in local smoke tests.
- Instagram automation rule can be created in under 2 minutes.
- Automation events show delivery state, failure reason, and retryability.
- Reports page loads without nested chart scroll.

### 8.3 Non-Goals

- No unofficial Instagram password login.
- No auto-publishing for Instagram personal accounts.
- No scraping, spam automation, or cold DM automation.
- No decorative redesign that does not improve task completion.
- No new routes unless they have clear ownership.

## 9. RFP

### 9.1 Scope

Design and build a production-ready Persian-first SocialOps web app with:

- Unified navigation and app shell.
- Professional design system.
- Composer Pro.
- Planner Pro.
- Campaign Command Center.
- Media Studio Pro.
- Inbox and notifications.
- Reports Pro.
- Channel Center.
- Instagram professional OAuth and webhook architecture.
- Instagram comment-to-DM automation.
- Production-grade backend, worker, audit, and observability.

### 9.2 Deliverables

- PRD and UX flows.
- Design system and component library.
- Frontend implementation.
- Backend APIs and migrations.
- Worker jobs.
- Webhook handlers.
- QA checklist.
- Docker local environment.
- Admin/operator documentation.
- Security and compliance notes.

### 9.3 Acceptance Criteria

- All pages work on desktop, tablet, and phone.
- All primary actions have loading, success, and failure states.
- No duplicate primary CTA on any page.
- All routes use consistent Button, Tag, Panel, Metric, Input, and DataView systems.
- Instagram automation is only available when account capability allows it.
- Webhook events are idempotent.
- Automation sends at most one private reply per comment.
- Automation failures are visible in Inbox and Reports.
- `docker compose exec frontend npm run check` passes.
- `docker compose exec backend python -m compileall app` passes.
- Backend tests run when pytest is installed in the backend image.

## 10. Roadmap

### Phase 0: Product Reset and Documentation

Status: ✅ COMPLETE (June 2026)

Outcomes:

- Update PRD, RFP, roadmap, backlog, and phase plan to reflect current Persian-first SocialOps positioning.
- Define Instagram comment-to-DM automation spec.
- Synchronize README with actual product scope and layout.
- Map out route ownership and clean up architectural draft elements.

### Phase 1: Navigation and App Shell Finalization

Status: ✅ COMPLETE (June 2026)

Goal: one clear, consolidated product shell.

Work:

- Moved Queue and Logs from primary navigation into Planner and Reports views as secondary top tab-bars.
- Kept workspace settings reachable and clean.
- Streamlined mobile-first layouts so that only major jobs-to-be-done occupy key actions.
- Eliminated duplicate global navigation tabs.

Acceptance:

- Users have a clean, intuitive RTL sidebar with 10 primary workspace destinations.
- Secondary workflows like Queue and Logs are contextually nested.

### Phase 2: Design System Rollout

Goal: every page feels like one product.

Work:

- Standardize Button, Tag, StatusToken, Input, Select, Textarea, Panel, MetricTile, DataView, Tabs, Drawer, Modal.
- Radius standard: 8px for controls/cards unless a specialized component needs otherwise.
- Glass theme tokens: surface, muted, border, blur, shadow, hover.
- Motion rules: hover lift, focus ring, selected state, skeletons, no noisy background animation.
- Audit hardcoded colors and arbitrary Tailwind usage.

Acceptance:

- No page-specific button systems.
- Labels/tags/buttons have consistent size families.
- Mobile and desktop spacing match the design system.

### Phase 3: Composer Pro Completion

Goal: make creation the best workflow in the product.

Work:

- Complete current composer rebuild.
- Add platform preview switch: Rubika, Instagram feed, Instagram reel/story placeholder later.
- Add mobile guided composer stepper.
- Add schedule and campaign drawers.
- Add channel-specific validation.
- Add automation hook: "attach Instagram comment automation after publish" to schedule comment-to-DM keyword triggers directly at post composition time.
- Add smarter draft recovery and conflict handling.

Acceptance:

- Composer has one intelligent primary action.
- Mobile composer avoids long uncontrolled scroll.
- User can see exactly what prevents scheduling.

### Phase 4: Instagram Professional Connect

Status: ✅ COMPLETE (June 2026)

Goal: build a production-ready Meta authorization foundation.

Work:

- Developed full Meta OAuth link-up (`/instagram/oauth/start` and `/instagram/oauth/callback`).
- Securely retrieve and store long-lived tokens in PostgreSQL.
- Automatically resolve the linked Facebook Page and corresponding Instagram Professional Creator/Business accounts.
- Added a connection status testing endpoint to report missing scopes or token expiry.

Acceptance:

- Users can connect their Instagram Professional account securely using standard Facebook Login.
- Personal accounts are detected and directed to Manual Reminder Mode.

### Phase 5: Instagram Comment-to-DM Automation MVP

Status: 🚧 IN PROGRESS (Foundations Complete, UI Integration Pending)

Goal: turn comments into compliant lead conversations.

Work:

- Created database models and migrations for automation rules and events.
- Built a robust Meta Webhook endpoint supporting challenge verification and comment event ingestion.
- Implemented the matching engine with Persian/Arabic digit normalization (`۵`/`٥` to `5`) and trigger keywords matching.
- Set up a Celery worker queue to dispatch private messages (`/<PAGE_ID>/messages`) and public comment replies (`/<COMMENT_ID>/replies`) asynchronously.
- Enforced strict idempotency constraints to prevent duplicate sends.
- Built a simulator on the `/instagram` panel for local webhook testing.
- **Remaining Task:** Integrate rules configuration into Composer Pro (Phase 3) and event streams into Inbox (Phase 6) and Reports (Phase 9).

Acceptance:

- System receives comment webhook payloads and triggers instant, idempotent direct messages to matching commenters.
- Rule creation and local comment matching tests work successfully.

### Phase 6: Inbox Pro

Goal: make messages/comments operational.

Work:

- Combine operational notifications, comments, DMs, automation events.
- Filters: channel, type, campaign, assigned, unread, failed automation.
- Saved replies.
- Internal notes.
- Assignments.
- Manual takeover from automation.

Acceptance:

- A team can process social engagement without leaving Nashrino.

### Phase 7: Planner Pro

Goal: no nested-scroll calendar chaos.

Work:

- Month/week/list modes.
- Mobile agenda mode.
- Post preview drawer/modal centered in viewport.
- Drag/reschedule or quick reschedule.
- Calendar density tuning.
- Gap and overload detection.

Acceptance:

- Phone users can find a day, see posts, preview one, and create a new one without long scroll.

### Phase 8: Campaign Command Center

Goal: campaign page becomes a professional control room.

Work:

- Campaign portfolio cards using shared KPI system.
- Selected campaign summary.
- Workbench tabs: overview, calendar, posts, media, automation, report.
- Create/edit campaign drawer only.
- Automation rules per campaign.
- Exportable campaign summary.

Acceptance:

- Campaign page has no permanent two-column scroll trap.
- KPI cards match dashboard/planner design.

### Phase 9: Reports Pro

Goal: make analytics actionable.

Work:

- Replace chart scroll with responsive charts.
- Monthly labels readable.
- Post/channel/campaign/automation reports.
- Export PDF/CSV later.
- Insights: best time, top content, failed publish reasons, automation conversion.

Acceptance:

- Reports explain what to do next, not just show numbers.

### Phase 10: Productionization

Goal: reliable, secure, maintainable product.

Work:

- Role-based permissions.
- Audit logs.
- Error monitoring.
- Backup and restore.
- Webhook signature verification.
- Rate limit monitoring.
- App review readiness for Meta.
- CI checks and container health.

Acceptance:

- Product can be demoed and operated as a real SaaS-style app.

## 11. Updated Backlog

### P0: Must Do Next

1. Finalize master docs and Instagram automation PRD. **(✅ COMPLETE)**
2. Remove README drift. **(✅ COMPLETE)**
3. Move Queue/Logs out of primary nav or mark them as secondary operations. **(✅ COMPLETE - Implemented as nested tabs)**
4. Composer Pro phase 2: platform preview, mobile stepper, schedule/campaign drawers. **(🚧 IN PROGRESS)**
5. Instagram professional OAuth/webhook architecture. **(✅ COMPLETE - Facebook Login OAuth and Challenge verify working)**
6. Instagram comment-to-DM automation data model. **(✅ COMPLETE - Rules and Events tables migrated)**
7. Webhook comment ingestion, digit normalization, and idempotency. **(✅ COMPLETE - Webhook parser, Celery worker queue, and digit mapping working)**
8. Inbox Pro structure to display comment-to-DM automation events/failures. **(🚧 IN PROGRESS)**
9. Reports chart horizontal/vertical double scroll fix. **(🚧 NOT STARTED)**
10. Mobile QA for all primary screens (Dashboard, Compose, Calendar, Campaigns, Content, Media, Inbox, Reports). **(🚧 IN PROGRESS)**

### P1: Important

1. Saved replies.
2. Automation rule testing sandbox.
3. Campaign automation tab.
4. Channel capability matrix UI refresh.
5. Brand kit consolidation.
6. Media editor template QA.
7. Content library saved views.
8. Planner agenda mobile mode.
9. Exportable campaign report.
10. Permission-based team roles.

### P2: Later

1. AI caption assistant.
2. AI reply suggestions.
3. Best-time recommendations.
4. Link-in-bio page for Instagram.
5. Competitor monitoring.
6. Multi-workspace client management.
7. White-label reports.
8. CRM/contact list from Instagram automation.
9. Advanced segmentation and lead scoring.
10. Paid plan and billing.

## 12. Module-Level Requirements

### Dashboard

- Compact one-screen command center on laptop.
- Top KPI cards: scheduled, failed/needs action, active campaign, channel readiness.
- One useful visualization, not many repeated charts.
- Alert rail for problems.
- Click KPI to route to the owning module.

### Composer

- Primary canvas plus publish inspector.
- Platform preview tabs.
- Mobile step flow.
- Schedule drawer.
- Campaign drawer.
- Automation attachment after Instagram publish (toggle auto-reply, keyword trigger, and DM text).
- **Caption parsing suggestions:** Suggest trigger keywords automatically based on parsed caption call-to-actions (e.g. suggesting `۵` or `قیمت`).
- **Templates selection:** Load pre-saved automation rules from a central library.

### Planner

- Calendar must not have horizontal scroll.
- Post click opens modal/drawer in current viewport.
- Today and selected day use different visual states.
- Month controls clearly mean month navigation.

### Campaigns

- Portfolio first, edit on demand.
- Campaign detail tabs.
- Automation rules per campaign.
- KPI card system shared with dashboard.

### Content

- One filter system.
- Saved views.
- Bulk actions.
- Open in composer.
- Avoid duplicate status chips and duplicate filter rows.

### Media

- Image editor must feel like a real workspace.
- Color selection must be smooth and undoable.
- Persian font kits must visually differ.
- Templates must be reliable, not random decorative presets.

### Inbox

- Combined operational notifications and social direct messages.
- Automation events, matched triggers, and failures visible.
- Saved replies and templates.
- **Operator takeover and loops prevention:** Flag threads as `در انتظار پاسخ اپراتور` when a customer replies to an automated DM. Temporarily pause automated responses for that thread. Allow operators to send pre-configured waiting messages or resume automation with a single button click.
- **Visual marking:** Tag automated messages in chat logs as `ارسال خودکار`.

### Reports

- No chart double scroll.
- Insight cards with recommended action.
- Campaign, channel, publishing, automation reports.

### Channels

- Capability matrix.
- Real connection state.
- OAuth/webhook state.
- Test connection.
- Clear personal-vs-professional Instagram explanation.

## 13. Instagram Automation Product Direction

Instagram automation should be introduced as `تعامل خودکار اینستاگرام`, not as a generic bot.

Core MVP:

- User selects an Instagram professional account.
- User selects a post/campaign or all future campaign posts.
- User defines a trigger keyword, for example `5`.
- User writes a DM/private reply message.
- Optional public reply text can be enabled.
- System listens for comments via Meta webhook.
- If a comment matches, the system sends one compliant private reply/DM.
- Event appears in Inbox and Reports.

Safety:

- Only official Meta API.
- No password login.
- No cold outbound DM.
- One private reply per comment.
- Rate limits and retry rules.
- User can pause/disable rules.
- All automation actions are logged.

See [Instagram Comment-to-DM Automation PRD](INSTAGRAM_COMMENT_TO_DM_AUTOMATION_PRD.md).

## 14. Technical Architecture Direction

Frontend:

- Next.js app routes.
- Shared component system.
- Feature-owned pages.
- Drawer/modal primitives.
- Responsive/mobile-first QA.

Backend:

- FastAPI routers by domain.
- SQLAlchemy models and migrations.
- Celery workers for publishing and automation.
- Webhook ingestion endpoint.
- Idempotency keys for external events.
- Audit tables for automation and publishing.

Data:

- `instagram_accounts` should evolve with OAuth/webhook metadata.
- Add automation rules/events/touches.
- Add social conversation/contact entities later.

Ops:

- Docker Compose local runtime.
- Health checks.
- Compile, lint, typecheck, unit tests, and build checks.
- **E2E Automation Testing:** Set up **Playwright** inside the frontend folder to execute headless browser tests against the dev container (port `3100`), ensuring E2E workflows (login, composition, navigation, automation simulation) function correctly.
- Webhook signature validation before production.

## 15. QA Checklist

- Desktop 1440px, laptop 1280px, tablet 820px, mobile 390px.
- No horizontal overflow.
- No nested scroll unless it is an intentional table/list region.
- Keyboard focus visible.
- Persian text does not overflow buttons/cards.
- Empty/loading/error states exist.
- API errors are shown in Persian with recovery hints.
- Compose save/schedule works.
- Calendar post preview opens in current viewport.
- Campaign edit opens on demand.
- Instagram automation rule can be tested without sending a real DM.
- **Automated E2E:** E2E Playwright test suite passes (`npm run test:e2e`).

## 16. Immediate Next Phase Recommendation

Next implementation phase should be:

1. **Composer Pro Phase 2 (Creation & Automation Hook):** Rebuild the Composer workbench (`/compose`) to include platform previews, mobile layout steps, schedule drawers, and the Instagram comment automation rules builder (supporting caption-based auto-suggestions and templates).
2. **Playwright E2E Testing Framework:** Configure Playwright in the Next.js frontend, write E2E browser tests for core flows (auth, navigation, post scheduling, and automation simulator), and run them inside E2E test containers.
3. **Inbox & Reports Integration:** Connect automation event logging to E2E-tested Inbox and Reports modules.

This sequence is best because the Instagram automation feature begins at post creation, depends on Instagram channel capability, and ends in Inbox/Reports. Composer must be clean before automation is added to it.

