"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, Play, RefreshCw, ShieldAlert } from "lucide-react";
import { apiUrl, authHeaders } from "../lib/posts";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/form";
import { NoticeBanner, StatusToken, WorkspacePanel } from "./workspace-ui";

type AutomationRule = {
  id: number;
  name: string;
  status: string;
  trigger_keywords: string[];
  private_reply_message: string;
};

type AutomationEvent = {
  id: number;
  rule_id: number | null;
  ig_comment_id: string;
  commenter_username: string;
  comment_text: string;
  event_status: string;
  skip_reason: string;
  failure_reason: string;
  attempt_count: number;
  created_at: string;
};

type RuleListResponse = { rules: AutomationRule[]; total: number };
type RuleTestResponse = { matched: boolean; normalized_comment_text: string; reason: string };
type EventListResponse = { events: AutomationEvent[]; total: number };
type SimulationResponse = { received: number; created: number; duplicates: number; matched: number; queued: number; skipped: number; events: AutomationEvent[] };

type InstagramAutomationPanelProps = {
  accountType: "personal" | "creator" | "business";
  channelStatus: string;
};

const copy = {
  title: "\u062a\u0639\u0627\u0645\u0644 \u062e\u0648\u062f\u06a9\u0627\u0631 \u0627\u06cc\u0646\u0633\u062a\u0627\u06af\u0631\u0627\u0645",
  description: "\u0627\u06af\u0631 \u06a9\u0627\u0631\u0628\u0631 \u0632\u06cc\u0631 \u067e\u0633\u062a \u06a9\u0644\u06cc\u062f\u0648\u0627\u0698\u0647 \u0645\u062b\u0644 5 \u0646\u0648\u0634\u062a\u060c \u0642\u0627\u0646\u0648\u0646 \u067e\u06cc\u0627\u0645 \u062f\u0627\u06cc\u0631\u06a9\u062a \u0631\u0627 \u0622\u0645\u0627\u062f\u0647 \u0645\u06cc\u200c\u06a9\u0646\u062f.",
  draftNotice: "\u062a\u0627 \u0642\u0628\u0644 \u0627\u0632 Meta OAuth \u0642\u0627\u0646\u0648\u0646\u200c\u0647\u0627 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0645\u06cc\u200c\u0645\u0627\u0646\u0646\u062f \u0648 \u0627\u0631\u0633\u0627\u0644 \u0648\u0627\u0642\u0639\u06cc \u0646\u062f\u0627\u0631\u0646\u062f.",
  personalNotice: "\u0627\u06a9\u0627\u0646\u062a \u0645\u0639\u0645\u0648\u0644\u06cc \u0627\u062a\u0648\u0645\u06cc\u0634\u0646 \u062f\u0627\u06cc\u0631\u06a9\u062a \u0646\u0645\u06cc\u200c\u06af\u06cc\u0631\u062f\u061b \u0641\u0642\u0637 \u06cc\u0627\u062f\u0622\u0648\u0631\u06cc \u062f\u0633\u062a\u06cc \u0627\u0645\u0646 \u0627\u0633\u062a.",
  keyword: "\u06a9\u0644\u06cc\u062f\u0648\u0627\u0698\u0647",
  message: "\u067e\u06cc\u0627\u0645 \u062f\u0627\u06cc\u0631\u06a9\u062a",
  save: "\u0630\u062e\u06cc\u0631\u0647 \u0642\u0627\u0646\u0648\u0646",
  simulate: "\u0634\u0628\u06cc\u0647\u200c\u0633\u0627\u0632\u06cc \u06a9\u0627\u0645\u0646\u062a",
  empty: "\u0647\u0646\u0648\u0632 \u0642\u0627\u0646\u0648\u0646\u06cc \u0633\u0627\u062e\u062a\u0647 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
  eventsEmpty: "\u0647\u0646\u0648\u0632 \u0631\u0648\u06cc\u062f\u0627\u062f\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.",
  matched: "\u062a\u0637\u0628\u06cc\u0642 \u062f\u0627\u0631\u062f",
  notMatched: "\u062a\u0637\u0628\u06cc\u0642 \u0646\u062f\u0627\u0631\u062f"
};

export function InstagramAutomationPanel({ accountType, channelStatus }: InstagramAutomationPanelProps) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [keyword, setKeyword] = useState("5");
  const [message, setMessage] = useState("");
  const [sampleComment, setSampleComment] = useState("5");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [simulationMessage, setSimulationMessage] = useState("");
  const [testResult, setTestResult] = useState<Record<number, RuleTestResponse>>({});

  const professionalMode = accountType !== "personal";
  const canActivate = professionalMode && channelStatus === "connected";
  const keywords = useMemo(() => keyword.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean), [keyword]);

  async function loadRules() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/instagram/automation/rules`, { headers: authHeaders() });
      if (!response.ok) throw new Error("Automation rules failed to load");
      const data = (await response.json()) as RuleListResponse;
      setRules(data.rules);
      const eventsResponse = await fetch(`${apiUrl}/instagram/automation/events`, { headers: authHeaders() });
      if (eventsResponse.ok) {
        const eventData = (await eventsResponse.json()) as EventListResponse;
        setEvents(eventData.events);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Automation rules failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!keywords.length || !message.trim()) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/instagram/automation/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: `Instagram trigger: ${keywords[0]}`,
          status: canActivate ? "active" : "draft",
          trigger_type: keywords.length > 1 ? "any_of" : "exact",
          trigger_keywords: keywords,
          private_reply_message: message.trim()
        })
      });
      if (!response.ok) throw new Error("Automation rule failed to save");
      const created = (await response.json()) as AutomationRule;
      setRules((current) => [created, ...current]);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Automation rule failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function testRule(rule: AutomationRule) {
    const response = await fetch(`${apiUrl}/instagram/automation/rules/${rule.id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ comment_text: sampleComment })
    });
    if (!response.ok) return;
    const result = (await response.json()) as RuleTestResponse;
    setTestResult((current) => ({ ...current, [rule.id]: result }));
  }

  async function simulateComment() {
    setError("");
    setSimulationMessage("");
    const response = await fetch(`${apiUrl}/instagram/automation/simulate-comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ comment_text: sampleComment })
    });
    if (!response.ok) {
      setError("Comment simulation failed");
      return;
    }
    const result = (await response.json()) as SimulationResponse;
    setEvents((current) => [...result.events, ...current].slice(0, 20));
    setSimulationMessage(`${result.created} created / ${result.matched} matched / ${result.duplicates} duplicate`);
    await loadRules();
  }

  return (
    <WorkspacePanel title={copy.title} description={copy.description} action={<StatusToken tone={canActivate ? "success" : "warning"}>{canActivate ? "Ready" : "Draft"}</StatusToken>}>
      <div className="grid gap-4">
        <NoticeBanner tone={professionalMode ? "info" : "warning"} title={professionalMode ? "Meta API" : "Personal mode"}>
          {professionalMode ? copy.draftNotice : copy.personalNotice}
        </NoticeBanner>
        {error ? <NoticeBanner tone="warning" title="Automation">{error}</NoticeBanner> : null}

        <form onSubmit={createRule} className="grid gap-3 rounded-md border border-app-border bg-app-surfaceMuted/70 p-3">
          <Field label={copy.keyword} hint="Example: 5, price, catalog">
            <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="5" />
          </Field>
          <Field label={copy.message} required>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-24" placeholder="Message text..." required />
          </Field>
          <Button type="submit" disabled={saving || !keywords.length || !message.trim()}>
            <Bot className="ml-2 h-4 w-4" aria-hidden="true" />
            {saving ? "Saving..." : copy.save}
          </Button>
        </form>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-black text-app-text">{rules.length} rules</p>
          <div className="flex flex-wrap gap-2">
            <Input value={sampleComment} onChange={(event) => setSampleComment(event.target.value)} className="max-w-32" />
            <Button type="button" variant="secondary" size="sm" onClick={simulateComment}>
              <Bot className="ml-1.5 h-4 w-4" aria-hidden="true" />
              {copy.simulate}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={loadRules} disabled={loading}>
              <RefreshCw className={`ml-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              Reload
            </Button>
          </div>
        </div>
        {simulationMessage ? <NoticeBanner tone="success" title="Simulation">{simulationMessage}</NoticeBanner> : null}

        {rules.length ? (
          <div className="grid gap-2">
            {rules.map((rule) => {
              const result = testResult[rule.id];
              return (
                <article key={rule.id} className="rounded-md border border-app-border bg-white/75 p-3 shadow-hairline backdrop-blur">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-app-text">{rule.name}</p>
                      <p className="mt-1 text-xs leading-5 text-app-muted">{rule.trigger_keywords.join(" / ")}{" | "}{rule.private_reply_message}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusToken tone="neutral">{rule.status}</StatusToken>
                      <Button type="button" variant="secondary" size="sm" onClick={() => testRule(rule)}>
                        <Play className="ml-1.5 h-4 w-4" aria-hidden="true" />
                        Test
                      </Button>
                    </div>
                  </div>
                  {result ? (
                    <div className={`mt-3 rounded-md px-3 py-2 text-xs font-bold ${result.matched ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"}`}>
                      {result.matched ? copy.matched : copy.notMatched}: {result.normalized_comment_text}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md border border-dashed border-app-borderStrong bg-white/60 p-4 text-sm text-app-muted">
            <ShieldAlert className="h-5 w-5 text-app-primary" aria-hidden="true" />
            {copy.empty}
          </div>
        )}

        <div className="rounded-md border border-app-border bg-white/70 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-black text-app-text">Recent automation events</p>
            <StatusToken tone="neutral">{events.length}</StatusToken>
          </div>
          {events.length ? (
            <div className="grid gap-2">
              {events.slice(0, 5).map((event) => (
                <div key={event.id} className="rounded-md border border-app-border bg-app-surfaceMuted/60 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-app-text">{event.comment_text}</p>
                      <p className="mt-1 text-[11px] text-app-muted">{event.commenter_username || "instagram_user"} · {event.ig_comment_id}</p>
                    </div>
                    <StatusToken tone={event.event_status === "sent" || event.event_status === "dry_run" || event.event_status === "queued" ? "success" : event.event_status === "failed" || event.event_status === "blocked" ? "alert" : "neutral"}>{event.event_status}</StatusToken>
                  </div>
                  {event.failure_reason || event.skip_reason ? <p className="mt-2 text-[11px] leading-5 text-app-muted">{event.failure_reason || event.skip_reason}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-app-muted">{copy.eventsEmpty}</p>
          )}
        </div>
      </div>
    </WorkspacePanel>
  );
}

