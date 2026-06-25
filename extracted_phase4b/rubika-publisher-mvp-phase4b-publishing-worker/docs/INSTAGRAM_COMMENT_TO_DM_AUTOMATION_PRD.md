# Instagram Comment-to-DM Automation PRD

Last updated: 2026-06-21  
Feature name: Instagram Comment-to-DM Automation  
Persian product label: تعامل خودکار اینستاگرام  
Status: In Progress (Foundations Complete)  
Parent roadmap: [Nashrino 2026 Master PRD, RFP, Roadmap, Phases, and Backlog](Nashrino_2026_MASTER_RFP_ROADMAP_BACKLOG.md)

## 1. Summary

Nashrino should let a user attach an automation rule to an Instagram post or campaign:

> If a user comments a keyword such as `5`, Nashrino automatically sends that commenter a selected private reply/DM message and optionally posts a public reply.

This turns Instagram comments into lead capture, coupon delivery, catalog delivery, event registration, and customer support workflows.

This feature must use official Meta APIs only. It must not use password login, scraping, unofficial bots, or cold outbound DMs.

## 2. Meta Capability Research

Verified on 2026-06-18:

- Meta's Instagram Platform documents Private Replies for sending a private reply to a person who commented on an app user's Instagram professional content. Source: https://developers.facebook.com/docs/instagram-platform/private-replies/
- Meta's Instagram Platform Webhooks document receiving webhook notifications and subscribing to Instagram webhook fields. Source: https://developers.facebook.com/docs/instagram-platform/webhooks/
- Meta's Instagram Messaging API documents sending messages from an Instagram professional account. Source: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/
- Meta's Send API reference documents `recipient.comment_id` for Private Replies and standard 24-hour messaging-window concepts. Source: https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags
- Meta's Instagram comment moderation docs cover webhook notifications for comments and comment IDs. Source: https://developers.facebook.com/docs/instagram-platform/comment-moderation/
- Meta's rate limit docs mention private reply rate limits for comments on Instagram posts/reels. Source: https://developers.facebook.com/docs/graph-api/overview/rate-limiting/

Product interpretation:

- This is possible for Instagram professional accounts when the app has the required Meta permissions, webhooks, and app review state.
- This should not be offered for normal/personal Instagram accounts except as a manual reminder workflow.
- A comment trigger can open a compliant reply path, but the app must enforce Meta rules, message relevance, rate limits, idempotency, and auditability.

## 3. User Problem

Persian commerce teams often use Instagram comments as lead triggers:

- "عدد 5 را کامنت کن تا لینک تخفیف را بفرستم."
- "کلمه قیمت را بنویس تا لیست قیمت را دایرکت کنم."
- "برای دریافت کاتالوگ بنویس کاتالوگ."

Without automation, the operator must manually find every comment, send DMs, track who received the message, and avoid missing leads.

## 4. Goals

- Let a user create a keyword-based Instagram automation rule in under 2 minutes.
- Automatically detect matching comments.
- Send the selected private reply/DM message compliantly.
- Optionally send a public comment reply.
- Log every match and delivery state.
- Show failures in Inbox and Reports.
- Prevent duplicate replies to the same comment.
- Protect the account from spammy automation mistakes.

## 5. Non-Goals

- No unofficial Instagram login.
- No auto-DM to users who did not comment/message/interact.
- No scraping public posts.
- No automation for other people's posts.
- No bypass of Meta permissions or app review.
- No unlimited blasting.
- No hidden automation without logs.

## 6. Personas

### Store Owner

Wants: "If someone comments 5, send coupon code and product link."

### Social Media Operator

Wants: "Attach an automation to this post before publishing and monitor delivery."

### Campaign Manager

Wants: "Run a campaign where comment keywords segment leads and produce a report."

### Support Agent

Wants: "See which DMs were automated and take over if the user replies."

## 7. Core UX Flow

### Flow A: Attach Automation From Composer

1. User creates an Instagram post in `/compose`.
2. In the publish inspector, user opens `تعامل خودکار`.
3. User selects trigger type:
   - exact keyword
   - contains keyword
   - number/code
   - multiple keywords
4. User enters trigger, e.g. `5`.
5. User writes DM/private reply text.
6. User optionally writes public reply text, e.g. `پیام ارسال شد. لطفاً دایرکت را بررسی کنید.`
7. User tests the rule with sample comments.
8. User publishes/schedules the post.
9. Rule becomes active when the Instagram media ID is known.

### Flow B: Create Rule From Campaign

1. User opens a campaign.
2. User opens `Automation` tab.
3. User creates rule for all Instagram posts in the campaign or selected posts.
4. User monitors matches, sends, failures, and conversion.

### Flow C: Monitor In Inbox

1. A follower comments `5`.
2. Meta sends comment webhook.
3. Nashrino matches the rule.
4. Worker sends private reply/DM.
5. Inbox receives an event:
   - matched
   - sent
   - skipped
   - failed
6. Operator can open the event and take over manually if needed.

## 8. Rule Requirements

### Trigger Scope

- Specific Instagram post.
- Campaign posts.
- All future posts from a channel, later.

### Trigger Matching & Suggestions

- Exact match: `5`.
- Contains: comment includes `قیمت`.
- Multiple keywords: `قیمت`, `price`, `۵`.
- Persian/Arabic digit normalization: `5`, `۵`, `٥`.
- Trim spaces and case-insensitive Latin matching.
- **Caption-Based Suggestions:** When composing a post, the system automatically parses the caption text for common Persian call-to-action phrases (e.g. `عدد 5 را کامنت کنید`, `بنویسید قیمت`, `کامنت کاتالوگ`) and suggests relevant trigger keywords (`5`, `قیمت`, `کاتالوگ`) to the user.
- **Template Library:** Users can save rules to a "Template Library" (کتابخانه الگوها) to easily load pre-configured trigger-and-reply combinations in the Composer without rewriting them.

### Actions

- Send private reply/DM message.
- Optional public comment reply.
- Add lead/contact record later.
- Add tag to automation event.
- Notify Inbox on failure or high-value match.

### Customer Reply & Operator Hand-off (loops prevention)

- **Operator Takeover Flag:** If a customer replies to the automated private message (DM) in direct, the thread is flagged as `در انتظار پاسخ اپراتور` (Waiting for operator response).
- **Automation Pausing:** The system temporarily pauses automated matching or messages for this user/comment thread to avoid infinite auto-reply loops.
- **Waiting Response Options:** The user can configure what happens when a customer replies:
  1. *Silence / Hand-off:* Do not send anything, just flag the thread and wait for the operator.
  2. *Auto-Response:* Send a custom "waiting message" (e.g., "پیام شما دریافت شد؛ به زودی اپراتور به شما پاسخ خواهد داد.") and then freeze automation for the thread.

### Guardrails

- Rule must be paused by default until Instagram capability is verified.
- Rule must show estimated risk if message looks spammy.
- Rule must prevent duplicate private reply to the same comment.
- Rule must enforce one active rule per exact same post+trigger unless explicitly ordered.
- Rule must include pause/resume and test mode.

## 9. Data Model Proposal

### `instagram_automation_rules`

- `id`
- `store_id`
- `instagram_account_id`
- `campaign_id` nullable
- `post_id` nullable
- `ig_media_id` nullable
- `name`
- `status`: draft, active, paused, archived
- `trigger_type`: exact, contains, code, any_of
- `trigger_keywords_json`
- `normalized_keywords_json`
- `private_reply_message`
- `public_reply_enabled`
- `public_reply_message`
- `is_template` boolean (default false, to indicate if stored in the rule/message template library)
- `on_customer_reply` string (default `hand_off`, can be `hand_off` or `send_waiting_message`)
- `waiting_reply_message` text (nullable, custom reply sent to customer before operator takes over)
- `match_limit_per_hour`
- `match_limit_total`
- `starts_at`
- `ends_at`
- `created_by`
- `created_at`
- `updated_at`

### `instagram_automation_events`

- `id`
- `store_id`
- `rule_id`
- `instagram_account_id`
- `post_id` nullable
- `ig_media_id`
- `ig_comment_id`
- `commenter_ig_scoped_id` nullable
- `commenter_username` nullable
- `comment_text`
- `normalized_comment_text`
- `event_status`: received, matched, queued, sent, skipped, failed, manual_required
- `conversation_status` string (nullable, e.g. `automated`, `waiting_operator`, `responded_by_operator` to track hand-off status)
- `automation_paused_until` datetime (nullable, timestamp indicating until when automated replies are frozen for this user/thread to prevent loops)
- `skip_reason`
- `failure_reason`
- `private_reply_message_id` nullable
- `public_reply_comment_id` nullable
- `webhook_payload_json`
- `attempt_count`
- `last_attempt_at`
- `created_at`
- `updated_at`

### `instagram_webhook_events`

- `id`
- `store_id` nullable until resolved
- `meta_object`
- `meta_field`
- `external_event_id`
- `payload_json`
- `signature_valid`
- `processed_at`
- `created_at`

### Future `social_contacts`

- `id`
- `store_id`
- `channel`
- `external_user_id`
- `username`
- `first_seen_at`
- `last_interaction_at`
- `tags_json`
- `notes`

## 10. Backend API Proposal

### Rule APIs

- `GET /instagram/automation/rules`
- `POST /instagram/automation/rules`
- `GET /instagram/automation/rules/{id}`
- `PUT /instagram/automation/rules/{id}`
- `POST /instagram/automation/rules/{id}/pause`
- `POST /instagram/automation/rules/{id}/resume`
- `POST /instagram/automation/rules/{id}/test`
- `DELETE /instagram/automation/rules/{id}` or archive

### Event APIs

- `GET /instagram/automation/events`
- `GET /instagram/automation/events/{id}`
- `POST /instagram/automation/events/{id}/retry`
- `POST /instagram/automation/events/{id}/mark-manual`

### Webhook APIs

- `GET /webhooks/meta/instagram`
  - Meta verification challenge.
- `POST /webhooks/meta/instagram`
  - Signature validation.
  - Payload persistence.
  - Idempotent processing.
  - Queue match/send worker.

## 11. Worker Design

### Jobs

- `ingest_instagram_comment_webhook`
- `match_instagram_automation_rules`
- `send_instagram_private_reply`
- `send_instagram_public_reply`
- `retry_failed_automation_event`
- `sync_instagram_media_ids_after_publish`

### Idempotency

Use unique key:

```text
store_id + ig_comment_id + rule_id + action_type
```

This prevents duplicate replies if Meta retries a webhook or the worker retries a job.

### Rate Limits

- Track sends per account per hour.
- Track failures per account per hour.
- Pause automation if repeated permission/rate errors occur.
- Surface rate limit warning in Inbox and Channels.

## 12. Frontend UX Proposal

### Composer

Add compact section in publish inspector:

- **Toggle Option:** `فعال‌سازی پاسخ خودکار کامنت` (Enable auto comment reply).
- **Caption Suggestions:** Real-time analysis of caption text. If it detects key strings (e.g. `عدد 5 را کامنت کنید` or `قیمت`), shows a banner: `💡 پیشنهاد کلیدواژه: ۵` or `💡 پیشنهاد کلیدواژه: قیمت`. Clicking it auto-fills the trigger field.
- **Template Library Selector:** Button `📋 انتخاب از کتابخانه` to view pre-saved rule templates, allowing operators to choose standard replies instantly.
- **Rule Fields:** Keyword trigger, private DM message, and optional public comment reply.
- Once scheduled or published, the system automatically hooks this post ID to the rule.

### Campaigns

Add campaign tab:

- `Automation`
- Rule cards.
- Event count.
- Conversion count later.
- Pause/resume.

### Inbox

Add filters:

- Instagram comments.
- Instagram DMs.
- Automation matched.
- Automation failed.
- Manual required.
- **Takeover Status Indicator:** Show badge `در انتظار پاسخ اپراتور` (Waiting for operator response) on threads where the customer replied.
- **Control Banner:** Display a alert box: `اتوماسیون برای این گفتگو متوقف شده است` (Automation paused for this thread) with a button `🔄 فعال‌سازی مجدد اتوماسیون` (Resume automation) to allow clearing the hand-off flag and resuming auto-replies.
- Show automated messages with a `🤖 ارسال خودکار` tag in the message history.

### Reports

Add automation metrics:

- Matches.
- Private replies sent.
- Failures.
- Public replies.
- Top triggers.
- Campaign automation performance.

### Channels

Instagram account should show:

- OAuth connected.
- Webhook verified.
- Required permissions present/missing.
- Private replies available/unavailable.
- Messaging API available/unavailable.

## 13. Permission and Compliance Checklist

Before enabling this feature for a real account:

- Instagram account is Professional.
- Account is linked through official Meta OAuth.
- App has required permissions approved.
- Webhook callback is verified.
- Webhook subscription includes comment events.
- Messaging/private reply capability is available.
- User accepts automation compliance notice.
- Rule has a relevant trigger and message.
- No cold outreach.
- No duplicate private replies.

## 14. Error States

- Account is personal: show manual reminder mode only.
- OAuth missing: route to Instagram connection.
- Permission missing: show exact missing permission.
- Webhook not verified: show setup status.
- Comment too old or not eligible: skip with reason.
- Private reply already sent: skip as duplicate.
- Rate limited: queue retry or pause rule.
- Meta API error: show failure in Inbox.
- Message too long: block before saving rule.

## 15. Acceptance Criteria

MVP is accepted when:

- User can create a rule tied to a post: trigger `5`, DM message text.
- User can test a sample comment against the rule.
- Webhook endpoint stores incoming comment payloads.
- Matching worker marks event as matched or skipped.
- Sending worker attempts private reply only when capability allows it.
- Duplicate comment/rule events do not send duplicate DMs.
- Event log shows received, matched, sent, skipped, failed.
- Inbox shows failed automation events.
- Rule can pause/resume.
- Frontend blocks feature for personal Instagram accounts.

## 16. Phase Plan

### IG-A1: Product and Data Foundation (✅ COMPLETE)

- Add docs.
- Add models/migration.
- Add APIs for rules/events.
- Add UI skeleton.

### IG-A2: Webhook Foundation (✅ COMPLETE)

- Add Meta webhook verification endpoint.
- Persist webhook payloads.
- Add signature validation placeholder and production task.
- Add comment event parser.

### IG-A3: Matching Engine (✅ COMPLETE)

- Normalize Persian/Arabic digits (e.g. `۵` or `٥` to `5`).
- Match exact/contains/code triggers.
- Create automation event records.
- Add test endpoint.

### IG-A4: Private Reply Sender (✅ COMPLETE)

- Implement API client for private replies (`send_private_reply` via Meta Messaging API).
- Add rate-limit bookkeeping.
- Enforce idempotency (prevent duplicate replies to same comment).
- Add worker retries.

### IG-A5: Inbox and Reports (🚧 IN PROGRESS)

- Show automation events in Inbox (in progress).
- Add automation report cards.
- Add campaign automation summary.
- **New Task**: Integrate comment automation setup directly inside Composer Pro so rules can be attached to posts during creation.

### IG-A6: Meta App Review Readiness (🚧 NOT STARTED)

- Document permission use.
- Add demo mode.
- Add compliance screens.
- Add logs and export for review.

## 17. Open Questions & Resolutions

- **Which Meta app and Business Manager will own the production OAuth app?**
  - *Resolution:* To be determined by the client during staging/production deployment. Dev keys are currently used in the local environment.
- **Which Instagram account type will be used for first live testing?**
  - *Resolution:* Instagram Professional Creator or Business accounts (personal accounts are restricted to manual reminder mode).
- **Should automation be allowed only after a post is published, or can it be scheduled with the post?**
  - *Resolution:* Yes, it must be scheduled *with* the post. The Composer UI must have an expandable panel letting users configure keyword triggers (e.g. "5") and the DM reply text at the time of composing. When published, the system binds the media ID to this rule automatically.
- **Should public reply be enabled in MVP or delayed until private replies are stable?**
  - *Resolution:* It is already fully supported in the backend client (`send_public_comment_reply`) and database model. It should be presented as an optional checkbox in the user interface (both on the Instagram Automation tab and inside Composer).
- **Should contacts/leads be part of MVP or Phase 2?**
  - *Resolution:* Leads data model is ready, but CRM integration and lead scoring are deferred to Phase 2.


