"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AtSign, CalendarClock, CheckCircle2, ChevronDown, Clock3, Cloud, Eye, FileText, ImagePlus, Images, LayoutTemplate, Megaphone, PencilLine, Plus, Send, ShieldCheck, SlidersHorizontal, WandSparkles } from "lucide-react";
import { AuthGate } from "../../components/auth-gate";
import { AppShell } from "../../components/app-shell";
import { ApprovalBadge } from "../../components/approval-badge";
import { ChannelBadges } from "../../components/channel-badges";
import { ComposerActionFooter } from "../../components/composer-action-footer";
import { ComposerReadinessChecks } from "../../components/composer-readiness-checks";
import { RubikaPostPreview } from "../../components/rubika-post-preview";
import { MediaGalleryPicker } from "../../components/media-gallery-picker";
import { MediaImageEditor } from "../../components/media-image-editor";
import { ComposerSchedulePanel } from "../../components/composer-schedule-panel";
import { ComposerStepRail, type ComposerStep } from "../../components/composer-step-rail";
import { InstagramPostPreview } from "../../components/instagram-post-preview";
import { NInspectorDrawer } from "../../components/nashrino-ui";
import { StatusBadge } from "../../components/status-badge";
import { useToast } from "../../components/toast-provider";
import { Button } from "../../components/ui/button";
import { Field, Input, Select, Textarea } from "../../components/ui/form";
import { Tag } from "../../components/ui/tag";
import { NoticeBanner, StatusToken, WorkspacePage, WorkspacePanel } from "../../components/workspace-ui";
import { createCampaign, loadCampaigns, type Campaign } from "../../lib/campaigns";
import { channelCanAutoPublish, channelCanManualPublish, channelIsReady, channelStatusLabel, findChannelAccount, loadChannelAccounts, type ChannelAccount } from "../../lib/channel-accounts";
import { channelOptions, hasChannel, normalizeChannels, serializeChannels, type PublishingChannel } from "../../lib/channels";
import { approvalBlocksPublishing, approvalConfig } from "../../lib/posts";
import { loadWorkspaceOverview, type StoreProfile } from "../../lib/workspace";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const scheduleTimezone = "Asia/Tehran";
const localDraftKey = "rubika_publisher_compose_draft";

type MediaAsset = {
  id: number;
  post_id: number | null;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  folder: string;
  tags: string;
};

type SaveAction = "draft" | "ready" | "schedule";
type AutosaveState = "idle" | "dirty" | "saved" | "restored";
type StudioPanel = "preview" | "schedule" | "review";
type WorkspaceMode = "content" | "media" | "workflow";
type ComposerImageEditSource = {
  imageUrl: string;
  filename: string;
  folder: string;
  tags: string;
};

type Post = {
  id: number;
  title: string;
  caption: string;
  hashtags: string;
  platform: string;
  status: string;
  timezone: string;
  campaign_id: number | null;
  campaign: string;
  internal_note: string;
  scheduled_at: string | null;
  approval_status: string;
  approval_note: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string;
};

type InstagramAutomationRule = {
  id: number;
  name: string;
  post_id: number | null;
  is_template: boolean;
  status: string;
  trigger_keywords: string[];
  trigger_type: string;
  private_reply_message: string;
  public_reply_enabled: boolean;
  public_reply_message: string;
  on_customer_reply: string;
  waiting_reply_message: string | null;
};

const emptyForm = {
  title: "",
  caption: "",
  hashtags: "",
  platform: "rubika",
  timezone: scheduleTimezone,
  campaign_id: null as number | null,
  campaign: "",
  internal_note: "",
  scheduled_at: null as string | null
};

function ComposePageContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const editingPostId = searchParams.get("postId");
  const presetScheduledAt = searchParams.get("scheduledAt");
  const presetCampaignId = searchParams.get("campaignId");
  const isEditing = Boolean(editingPostId);

  const [store, setStore] = useState<StoreProfile | null>(null);
  const [channelAccounts, setChannelAccounts] = useState<ChannelAccount[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<Record<number, string>>({});
  const [form, setForm] = useState(emptyForm);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState("");
  const [editingImageSource, setEditingImageSource] = useState<ComposerImageEditSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
  const [composerReady, setComposerReady] = useState(false);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>("idle");
  const [autosaveAt, setAutosaveAt] = useState("");
  const [studioPanel, setStudioPanel] = useState<StudioPanel>("preview");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("content");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [previewChannel, setPreviewChannel] = useState<PublishingChannel>("rubika");
  const [instagramPreviewMode, setInstagramPreviewMode] = useState<"feed" | "story" | "reel">("feed");
  const [isCampaignDrawerOpen, setIsCampaignDrawerOpen] = useState(false);
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);

  const handleStepClick = useCallback((index: number) => {
    setActiveStepIndex(index);
    if (index === 0) {
      setWorkspaceMode("content");
      setStudioPanel("preview");
    } else if (index === 1) {
      setWorkspaceMode("media");
      setStudioPanel("preview");
    } else if (index === 2) {
      setWorkspaceMode("workflow");
      setStudioPanel("schedule");
    } else if (index === 3) {
      setWorkspaceMode("workflow");
      setStudioPanel("review");
    }
  }, []);

  const [quickCampaignName, setQuickCampaignName] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [savingEditedImage, setSavingEditedImage] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Instagram Comment Automation Rule Builder State
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [automationRuleId, setAutomationRuleId] = useState<number | null>(null);
  const [triggerKeywords, setTriggerKeywords] = useState("");
  const [triggerType, setTriggerType] = useState("exact");
  const [privateReplyMessage, setPrivateReplyMessage] = useState("");
  const [publicReplyEnabled, setPublicReplyEnabled] = useState(false);
  const [publicReplyMessage, setPublicReplyMessage] = useState("");
  const [onCustomerReply, setOnCustomerReply] = useState("hand_off");
  const [waitingReplyMessage, setWaitingReplyMessage] = useState("");
  const [templates, setTemplates] = useState<InstagramAutomationRule[]>([]);

  const selectedMedia = useMemo(() => {
    if (!selectedMediaId) return null;
    return mediaAssets.find((asset) => String(asset.id) === selectedMediaId) ?? null;
  }, [mediaAssets, selectedMediaId]);

  const previewImageUrl = selectedFilePreviewUrl || (selectedMedia ? mediaPreviewUrls[selectedMedia.id] : "");
  const brandAvatarUrl = store?.avatar_asset_id ? mediaPreviewUrls[store.avatar_asset_id] : store?.logo_asset_id ? mediaPreviewUrls[store.logo_asset_id] : "";
  const selectedCampaign = useMemo(() => {
    if (form.campaign_id === null) return null;
    return campaigns.find((campaign) => campaign.id === form.campaign_id) ?? null;
  }, [campaigns, form.campaign_id]);

  const finalPreview = useMemo(() => {
    const hasVisiblePostContent = Boolean(form.caption.trim() || previewImageUrl);
    return [form.caption, hasVisiblePostContent ? store?.default_cta : "", hasVisiblePostContent ? store?.caption_footer : "", form.hashtags]
      .filter(Boolean)
      .join("\n\n");
  }, [form.caption, form.hashtags, previewImageUrl, store?.caption_footer, store?.default_cta]);

  const captionSuggestions = useMemo(() => {
    if (!form.caption) return [];
    const suggestions: string[] = [];
    const numberMatches = form.caption.match(/(?:عدد|کلمه)\s*([0-9\u06f0-\u06f9]+)/i);
    if (numberMatches && numberMatches[1]) {
      suggestions.push(numberMatches[1]);
    }
    if (form.caption.includes("قیمت") || form.caption.includes("price")) {
      suggestions.push("قیمت");
    }
    if (form.caption.includes("کاتالوگ") || form.caption.includes("catalog")) {
      suggestions.push("کاتالوگ");
    }
    if (form.caption.includes("لینک") || form.caption.includes("link")) {
      suggestions.push("لینک");
    }
    const digits = form.caption.match(/\b([0-9\u06f0-\u06f9]+)\b/);
    if (digits && digits[1] && !suggestions.includes(digits[1])) {
      suggestions.push(digits[1]);
    }
    return suggestions;
  }, [form.caption]);

  const captionLength = form.caption.length;
  const hashtagCount = form.hashtags.split(/\s+/).filter((item) => item.startsWith("#")).length;
  const timezone = scheduleTimezone;
  const hasSchedule = Boolean(form.scheduled_at);
  const hasTitle = Boolean(form.title.trim());
  const hasPostBody = Boolean(form.caption.trim() || previewImageUrl);
  const hasLocalDraftContent = Boolean(form.title.trim() || form.caption.trim() || form.hashtags.trim() || form.campaign_id || form.campaign.trim() || form.internal_note.trim() || form.scheduled_at || selectedMediaId);
  const selectedChannels = useMemo(() => normalizeChannels(form.platform), [form.platform]);
  const instagramSelected = hasChannel(form.platform, "instagram");
  const rubikaSelected = hasChannel(form.platform, "rubika");
  const rubikaChannel = findChannelAccount(channelAccounts, "rubika");
  const instagramChannel = findChannelAccount(channelAccounts, "instagram");
  const rubikaReady = channelIsReady(rubikaChannel);
  const instagramReady = channelIsReady(instagramChannel);
  const instagramManualReady = channelCanManualPublish(instagramChannel);
  const selectedReadyChannels = selectedChannels.filter((channel) => channelIsReady(findChannelAccount(channelAccounts, channel)));
  const hasReadyPublishingChannel = selectedReadyChannels.length > 0;
  const canMoveToReady = !editingPost || ["draft", "failed", "cancelled"].includes(editingPost.status);
  const reviewBlocksSchedule = editingPost ? approvalBlocksPublishing(editingPost) : false;
  const canSaveDraft = hasTitle;
  const canMarkReady = hasTitle && hasPostBody && canMoveToReady;
  const canSchedule = canMarkReady && hasSchedule && hasReadyPublishingChannel && !reviewBlocksSchedule;
  const channelNotes = selectedChannels.map((channel) => {
    const account = findChannelAccount(channelAccounts, channel);
    if (!account) return `${channel === "rubika" ? "روبیکا" : "اینستاگرام"} هنوز در مرکز کانال‌ها ثبت نشده است.`;
    if (channelCanAutoPublish(account)) return `${channel === "rubika" ? "روبیکا" : "اینستاگرام"} برای انتشار خودکار آماده است.`;
    if (channelCanManualPublish(account)) return `${channel === "rubika" ? "روبیکا" : "اینستاگرام"} در حالت انتشار دستی/یادآوری آماده است.`;
    return `${channel === "rubika" ? "روبیکا" : "اینستاگرام"}: ${channelStatusLabel(account)}. ${account.limitations[0] ?? "برای ادامه، مرکز کانال‌ها را بررسی کنید."}`;
  });
  const rubikaLengthValid = !rubikaSelected || captionLength <= 4000;
  const instagramLengthValid = !instagramSelected || captionLength <= 2200;
  const instagramMediaValid = !instagramSelected || Boolean(previewImageUrl);
  const instagramAutomationValid = !autoReplyEnabled || (Boolean(triggerKeywords.trim()) && Boolean(privateReplyMessage.trim()));

  const readinessItems = [
    {
      label: "عنوان داخلی",
      detail: hasTitle ? "عنوان برای مدیریت محتوا ثبت شده است." : "برای ذخیره پست، عنوان داخلی لازم است.",
      done: hasTitle,
      required: true
    },
    {
      label: "متن یا رسانه",
      detail: hasPostBody ? "پست محتوای قابل انتشار دارد." : "حداقل کپشن یا تصویر برای آماده‌سازی پیشنهاد می‌شود.",
      done: hasPostBody,
      required: true
    },
    {
      label: "طول متن روبیکا",
      detail: rubikaLengthValid ? "طول متن در محدوده مجاز روبیکا است (کمتر از ۴۰۰۰ حرف)." : "متن برای روبیکا بسیار طولانی است (باید کمتر از ۴۰۰۰ حرف باشد).",
      done: rubikaLengthValid,
      required: rubikaSelected
    },
    {
      label: "طول متن اینستاگرام",
      detail: instagramLengthValid ? "طول متن در محدوده مجاز اینستاگرام است (کمتر از ۲۲۰۰ حرف)." : "متن برای اینستاگرام بسیار طولانی است (باید کمتر از ۲۲۰۰ حرف باشد).",
      done: instagramLengthValid,
      required: instagramSelected
    },
    {
      label: "رسانه اینستاگرام",
      detail: instagramMediaValid ? "تصویر برای پست اینستاگرام انتخاب شده است." : "پست اینستاگرام نیاز به حداقل یک تصویر دارد.",
      done: instagramMediaValid,
      required: instagramSelected
    },
    {
      label: "تنظیمات تعامل خودکار",
      detail: instagramAutomationValid ? "تنظیمات کلمات کلیدی و پاسخ دایرکت معتبر است." : "در صورت فعال بودن تعامل خودکار، کلمات کلیدی و پاسخ دایرکت الزامی است.",
      done: instagramAutomationValid,
      required: autoReplyEnabled
    },
    {
      label: "کانال روبیکا",
      detail: rubikaReady ? "روبیکا آماده انتشار خودکار است." : `روبیکا: ${channelStatusLabel(rubikaChannel)}`,
      done: !rubikaSelected || rubikaReady,
      required: rubikaSelected
    },
    {
      label: "کانال انتشار",
      detail: instagramSelected && instagramManualReady ? "اینستاگرام در حالت انتشار دستی/یادآوری آماده است." : instagramSelected && instagramReady ? "اینستاگرام برای مسیر انتخاب‌شده آماده است." : instagramSelected && rubikaReady ? "روبیکا آماده است؛ اینستاگرام هنوز نیازمند اقدام کانالی است." : instagramSelected ? `اینستاگرام: ${channelStatusLabel(instagramChannel)}` : "کانال انتخاب‌شده برای worker فعال است.",
      done: selectedChannels.every((channel) => channelIsReady(findChannelAccount(channelAccounts, channel))),
      required: instagramSelected && !hasReadyPublishingChannel
    },
    {
      label: "زمان انتشار",
      detail: hasSchedule ? "پست می‌تواند وارد صف زمان‌بندی شود." : "بدون زمان انتشار، پست به عنوان پیش‌نویس یا آماده ذخیره می‌شود.",
      done: hasSchedule
    },
    {
      label: "کیت برند",
      detail: store?.brand_voice || store?.default_cta ? "لحن یا CTA برند برای خروجی آماده است." : "در تنظیمات فروشگاه، لحن و CTA برند را کامل کنید.",
      done: Boolean(store?.brand_voice || store?.default_cta)
    }
  ];
  const readinessDoneCount = readinessItems.filter((item) => item.done).length;
  const readinessScore = Math.round((readinessDoneCount / readinessItems.length) * 100);
  const publishTone = canSchedule ? "success" : canMarkReady ? "primary" : "warning";
  const publishStateLabel = canSchedule ? "آماده زمان‌بندی" : canMarkReady ? "آماده بازبینی" : "در حال تولید";
  const autosaveLabel = autosaveState === "dirty"
    ? "در حال ذخیره محلی..."
    : autosaveAt
      ? `ذخیره خودکار ${new Date(autosaveAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`
      : "ذخیره خودکار فعال";
  const scheduleLabel = form.scheduled_at
    ? new Date(form.scheduled_at).toLocaleString("fa-IR", { dateStyle: "medium", hour: "2-digit", minute: "2-digit", timeZone: scheduleTimezone })
    : "انتخاب نشده";
  const campaignLabel = selectedCampaign?.name || form.campaign || "بدون کمپین";
  const selectedChannelLabel = selectedChannels.length === 2
    ? "روبیکا و اینستاگرام"
    : selectedChannels.includes("instagram")
      ? "اینستاگرام"
      : "روبیکا";
  const workspaceModes: Array<{ label: string; value: WorkspaceMode; icon: typeof FileText; done: boolean; detail: string }> = [
    { label: "متن", value: "content", icon: FileText, done: hasTitle && hasPostBody, detail: `${captionLength} کاراکتر` },
    { label: "رسانه", value: "media", icon: Images, done: Boolean(previewImageUrl), detail: previewImageUrl ? "تصویر انتخاب شد" : "اختیاری" },
    { label: "انتشار", value: "workflow", icon: LayoutTemplate, done: Boolean(form.campaign_id || form.scheduled_at || selectedChannels.length), detail: `${selectedChannelLabel} · ${campaignLabel}` }
  ];
  const workflowCards = [
    { label: "کانال", value: selectedChannelLabel, detail: hasReadyPublishingChannel ? "آماده انتشار" : "نیازمند تکمیل", tone: hasReadyPublishingChannel ? "success" : "warning", icon: AtSign },
    { label: "کمپین", value: campaignLabel, detail: selectedCampaign?.goal || "برای گزارش‌گیری قابل اتصال است", tone: selectedCampaign ? "primary" : "neutral", icon: Megaphone },
    { label: "زمان", value: scheduleLabel, detail: hasSchedule ? "وارد صف می‌شود" : "پیش‌نویس باقی می‌ماند", tone: hasSchedule ? "success" : "warning", icon: Clock3 }
  ] as const;
  const composerSteps: ComposerStep[] = [
    {
      label: "محتوا",
      helper: hasTitle && hasPostBody ? "عنوان و محتوای اصلی آماده است." : "عنوان داخلی و کپشن یا رسانه را کامل کنید.",
      icon: FileText,
      state: activeStepIndex === 0 ? "active" : (hasTitle && hasPostBody ? "done" : "pending")
    },
    {
      label: "رسانه",
      helper: previewImageUrl ? "تصویر خروجی انتخاب شده است." : "رسانه اختیاری است؛ برای پست تصویری انتخاب کنید.",
      icon: Images,
      state: activeStepIndex === 1 ? "active" : (previewImageUrl ? "done" : "pending")
    },
    {
      label: "زمان انتشار",
      helper: hasSchedule ? "تاریخ و ساعت ورود به صف مشخص است." : "برای انتشار خودکار، تاریخ و ساعت را انتخاب کنید.",
      icon: CalendarClock,
      state: activeStepIndex === 2 ? "active" : (hasSchedule ? "done" : "pending")
    },
    {
      label: "بازبینی نهایی",
      helper: !hasReadyPublishingChannel ? "حداقل یک کانال آماده برای زمان‌بندی لازم است." : instagramSelected && !instagramReady ? "اینستاگرام هنوز نیازمند اقدام است؛ کانال آماده دیگر می‌تواند ادامه دهد." : reviewBlocksSchedule ? "این پست قبل از زمان‌بندی باید تایید شود." : canSchedule ? "پست آماده ورود به صف انتشار است." : "پیش‌نمایش و الزام‌های انتشار را بررسی کنید.",
      icon: ShieldCheck,
      state: activeStepIndex === 3 ? "active" : (canSchedule ? "done" : "pending")
    }
  ];
  const studioPanels: Array<{ label: string; value: StudioPanel; icon: typeof Eye; ready?: boolean }> = [
    { label: "پیش‌نمایش", value: "preview", icon: Eye, ready: hasPostBody },
    { label: "زمان انتشار", value: "schedule", icon: CalendarClock, ready: hasSchedule },
    { label: "بازبینی", value: "review", icon: ShieldCheck, ready: canSchedule }
  ];

  function token() {
    return window.localStorage.getItem("rubika_publisher_access") ?? "";
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    setComposerReady(false);
    const headers = { Authorization: `Bearer ${token()}` };
    const [overview, loadedCampaigns, channelData, mediaResponse, postsResponse, postResponse] = await Promise.all([
      loadWorkspaceOverview(),
      loadCampaigns(),
      loadChannelAccounts(),
      fetch(`${apiUrl}/media`, { headers }),
      fetch(`${apiUrl}/posts`, { headers }),
      editingPostId ? fetch(`${apiUrl}/posts/${editingPostId}`, { headers }) : Promise.resolve(null)
    ]);

    setStore(overview.store);
    setChannelAccounts(channelData.accounts);
    setCampaigns(loadedCampaigns);
    if (postsResponse.ok) setPosts(await postsResponse.json());

    let loadedMediaAssets: MediaAsset[] = [];
    if (mediaResponse.ok) {
      loadedMediaAssets = await mediaResponse.json();
      setMediaAssets(loadedMediaAssets);
    }

    if (editingPostId) {
      if (!postResponse?.ok) {
        throw new Error("دریافت پست برای ویرایش ناموفق بود");
      }

      const post = (await postResponse.json()) as Post;
      setEditingPost(post);
      setForm({
        title: post.title,
        caption: post.caption,
        hashtags: post.hashtags,
        platform: post.platform || "rubika",
        timezone: scheduleTimezone,
        campaign_id: post.campaign_id ?? null,
        campaign: post.campaign || "",
        internal_note: post.internal_note || "",
        scheduled_at: post.scheduled_at
      });
      setShowOptionalDetails(Boolean(post.campaign_id || post.campaign || post.internal_note));

      const attachedAsset = loadedMediaAssets.find((asset) => asset.post_id === post.id);
      setSelectedMediaId(attachedAsset ? String(attachedAsset.id) : "");

      // Load automation rules and templates
      try {
        const rulesResponse = await fetch(`${apiUrl}/instagram/automation/rules`, { headers });
        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json();
          const loadedTemplates = rulesData.rules?.filter((r: InstagramAutomationRule) => r.is_template) ?? [];
          setTemplates(loadedTemplates);
          
          const existingRule = rulesData.rules?.find((r: InstagramAutomationRule) => String(r.post_id) === editingPostId) ?? null;
          if (existingRule) {
            setAutoReplyEnabled(existingRule.status === "active");
            setAutomationRuleId(existingRule.id);
            setTriggerKeywords(existingRule.trigger_keywords.join(", "));
            setTriggerType(existingRule.trigger_type);
            setPrivateReplyMessage(existingRule.private_reply_message);
            setPublicReplyEnabled(existingRule.public_reply_enabled);
            setPublicReplyMessage(existingRule.public_reply_message);
            setOnCustomerReply(existingRule.on_customer_reply);
            setWaitingReplyMessage(existingRule.waiting_reply_message ?? "");
          } else {
            setAutoReplyEnabled(false);
            setAutomationRuleId(null);
            setTriggerKeywords("");
            setTriggerType("exact");
            setPrivateReplyMessage("");
            setPublicReplyEnabled(false);
            setPublicReplyMessage("");
            setOnCustomerReply("hand_off");
            setWaitingReplyMessage("");
          }
        }
      } catch (e) {
        console.error("Failed to load automation rule", e);
      }
    } else {
      const presetCampaign = presetCampaignId ? loadedCampaigns.find((campaign) => String(campaign.id) === presetCampaignId) ?? null : null;
      let restoredDraft: { form: typeof emptyForm; selectedMediaId: string; savedAt: string } | null = null;
      try {
        const savedDraft = window.localStorage.getItem(localDraftKey);
        restoredDraft = savedDraft ? JSON.parse(savedDraft) : null;
      } catch {
        window.localStorage.removeItem(localDraftKey);
      }
      setEditingPost(null);
      const nextForm = restoredDraft?.form
        ? { ...emptyForm, ...restoredDraft.form, scheduled_at: presetScheduledAt || restoredDraft.form.scheduled_at }
        : { ...emptyForm, scheduled_at: presetScheduledAt };
      if (presetCampaign) {
        nextForm.campaign_id = presetCampaign.id;
        nextForm.campaign = presetCampaign.name;
      }
      setForm(nextForm);
      const restoredMediaId = restoredDraft?.selectedMediaId ?? "";
      setSelectedMediaId(loadedMediaAssets.some((asset) => String(asset.id) === restoredMediaId) ? restoredMediaId : "");
      setShowOptionalDetails(Boolean(presetCampaign || restoredDraft?.form?.campaign_id || restoredDraft?.form?.campaign || restoredDraft?.form?.internal_note));
      if (restoredDraft?.savedAt) {
        setAutosaveState("restored");
        setAutosaveAt(restoredDraft.savedAt);
      }

      // Reset automation fields for new post, but load templates
      setAutoReplyEnabled(false);
      setAutomationRuleId(null);
      setTriggerKeywords("");
      setTriggerType("exact");
      setPrivateReplyMessage("");
      setPublicReplyEnabled(false);
      setPublicReplyMessage("");
      setOnCustomerReply("hand_off");
      setWaitingReplyMessage("");

      try {
        const rulesResponse = await fetch(`${apiUrl}/instagram/automation/rules`, { headers });
        if (rulesResponse.ok) {
          const rulesData = await rulesResponse.json();
          const loadedTemplates = rulesData.rules?.filter((r: InstagramAutomationRule) => r.is_template) ?? [];
          setTemplates(loadedTemplates);
        }
      } catch (e) {
        console.error("Failed to load automation templates", e);
      }
    }

    setComposerReady(true);
    setLoading(false);
  }, [editingPostId, presetCampaignId, presetScheduledAt]);

  useEffect(() => {
    loadData().catch((err) => {
      setError(err instanceof Error ? err.message : isEditing ? "خطا در دریافت اطلاعات پست برای ویرایش" : "خطا در دریافت اطلاعات اولیه composer");
      setLoading(false);
    });
  }, [isEditing, loadData]);

  useEffect(() => {
    if (instagramSelected && !rubikaSelected) {
      setPreviewChannel("instagram");
    } else if (rubikaSelected && !instagramSelected) {
      setPreviewChannel("rubika");
    }
  }, [instagramSelected, rubikaSelected]);

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (mediaAssets.length === 0) {
      setMediaPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const imageAssets = mediaAssets.filter((asset) => asset.content_type.startsWith("image/"));
      const entries = await Promise.all(
        imageAssets.map(async (asset) => {
          try {
            const response = await fetch(`${apiUrl}/media/${asset.id}/file`, {
              headers: { Authorization: `Bearer ${token()}` }
            });
            if (!response.ok) return null;
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return [asset.id, url] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setMediaPreviewUrls(Object.fromEntries(entries.filter(Boolean) as Array<[number, string]>));
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaAssets]);

  useEffect(() => {
    if (!composerReady || isEditing) return;
    if (!hasLocalDraftContent) {
      window.localStorage.removeItem(localDraftKey);
      setAutosaveAt("");
      setAutosaveState("idle");
      return;
    }
    setAutosaveState("dirty");
    const timeout = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(localDraftKey, JSON.stringify({ form, selectedMediaId, savedAt }));
      setAutosaveAt(savedAt);
      setAutosaveState("saved");
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [composerReady, form, hasLocalDraftContent, isEditing, selectedMediaId]);

  function clearAutosavedDraft() {
    window.localStorage.removeItem(localDraftKey);
    setAutosaveAt("");
    setAutosaveState("idle");
  }

  function updateField(field: keyof typeof emptyForm, value: typeof emptyForm[keyof typeof emptyForm]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (message) setMessage("");
  }

  function toggleChannel(channel: PublishingChannel) {
    const active = selectedChannels.includes(channel);
    const nextChannels = active ? selectedChannels.filter((item) => item !== channel) : [...selectedChannels, channel];
    updateField("platform", serializeChannels(nextChannels));
  }

  function selectCampaign(campaignId: string) {
    if (!campaignId) {
      setForm((current) => ({ ...current, campaign_id: null, campaign: "" }));
      return;
    }
    const campaign = campaigns.find((item) => String(item.id) === campaignId);
    setForm((current) => ({ ...current, campaign_id: campaign?.id ?? null, campaign: campaign?.name ?? "" }));
    if (message) setMessage("");
  }

  async function quickCreateCampaign() {
    const name = quickCampaignName.trim() || form.campaign.trim();
    if (!name) {
      showToast({ title: "نام کمپین لازم است", description: "برای ساخت کمپین، یک نام کوتاه وارد کنید.", tone: "warning" });
      return;
    }
    setCreatingCampaign(true);
    setError("");
    try {
      const createdCampaign = await createCampaign({
        name,
        color: store?.brand_accent_color || store?.brand_primary_color || "#0F766E"
      });
      setCampaigns((current) => [createdCampaign, ...current.filter((campaign) => campaign.id !== createdCampaign.id)]);
      setForm((current) => ({ ...current, campaign_id: createdCampaign.id, campaign: createdCampaign.name }));
      setQuickCampaignName("");
      showToast({ title: "کمپین ساخته شد", description: "پست فعلی به کمپین جدید متصل شد.", tone: "success" });
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "ساخت کمپین ناموفق بود";
      setError(nextError);
      showToast({ title: "ساخت کمپین ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setCreatingCampaign(false);
    }
  }

  function applyDefaults() {
    const defaultCaption = [store?.description, store?.default_cta].filter(Boolean).join("\n\n");
    setForm((current) => ({
      ...current,
      caption: current.caption || defaultCaption,
      hashtags: store?.default_hashtags || current.hashtags,
      timezone: scheduleTimezone
    }));
    if (message) setMessage("");
  }

  function startWithUpload() {
    setWorkspaceMode("media");
    setActiveStepIndex(1);
    window.setTimeout(() => uploadInputRef.current?.click(), 0);
  }

  function startWithDefaults() {
    applyDefaults();
    setWorkspaceMode("content");
    setActiveStepIndex(0);
    window.setTimeout(() => document.getElementById("composer-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function resetComposer(options: { clearStatus?: boolean } = { clearStatus: true }) {
    setActiveStepIndex(0);
    setWorkspaceMode("content");
    setStudioPanel("preview");

    if (editingPost) {
      setForm({
        title: editingPost.title,
        caption: editingPost.caption,
        hashtags: editingPost.hashtags,
        platform: editingPost.platform || "rubika",
        timezone: scheduleTimezone,
        campaign_id: editingPost.campaign_id ?? null,
        campaign: editingPost.campaign || "",
        internal_note: editingPost.internal_note || "",
        scheduled_at: editingPost.scheduled_at
      });
      setShowOptionalDetails(Boolean(editingPost.campaign_id || editingPost.campaign || editingPost.internal_note));
      const attachedAsset = mediaAssets.find((asset) => asset.post_id === editingPost.id);
      setSelectedMediaId(attachedAsset ? String(attachedAsset.id) : "");
    } else {
      setForm({ ...emptyForm, scheduled_at: presetScheduledAt });
      setSelectedMediaId("");
      setShowOptionalDetails(false);
      clearAutosavedDraft();
    }

    setSelectedFile(null);

    if (options.clearStatus) {
      setMessage("");
      setError("");
    }
  }

  async function uploadSelectedFile() {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append("file", selectedFile);
    const response = await fetch(`${apiUrl}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` },
      body: formData
    });

    if (!response.ok) throw new Error("آپلود تصویر ناموفق بود");
    return response.json() as Promise<MediaAsset>;
  }

  function openImageEditor() {
    if (selectedFile && selectedFilePreviewUrl) {
      setEditingImageSource({
        imageUrl: selectedFilePreviewUrl,
        filename: selectedFile.name,
        folder: form.campaign || "",
        tags: "composer"
      });
      return;
    }

    if (selectedMedia && mediaPreviewUrls[selectedMedia.id]) {
      setEditingImageSource({
        imageUrl: mediaPreviewUrls[selectedMedia.id],
        filename: selectedMedia.original_filename,
        folder: selectedMedia.folder,
        tags: selectedMedia.tags
      });
    }
  }

  async function saveEditedComposerImage(file: File) {
    if (!editingImageSource) return;
    setSavingEditedImage(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", editingImageSource.folder);
      formData.append("tags", [editingImageSource.tags, "edited", "composer"].filter(Boolean).join(", "));
      const response = await fetch(`${apiUrl}/media`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });
      if (!response.ok) throw new Error("ذخیره نسخه ویرایش‌شده ناموفق بود");
      const savedAsset = (await response.json()) as MediaAsset;
      setMediaAssets((current) => [savedAsset, ...current.filter((asset) => asset.id !== savedAsset.id)]);
      setSelectedMediaId(String(savedAsset.id));
      setSelectedFile(null);
      setEditingImageSource(null);
      setMessage("نسخه ویرایش‌شده به پست انتخاب شد");
      showToast({ title: "تصویر ویرایش‌شده انتخاب شد", description: savedAsset.original_filename, tone: "success" });
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای ذخیره نسخه ویرایش‌شده";
      setError(nextError);
      showToast({ title: "ذخیره ویرایش تصویر ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setSavingEditedImage(false);
    }
  }

  async function attachMedia(assetId: number, postId: number | null) {
    const response = await fetch(`${apiUrl}/media/${assetId}/attach`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ post_id: postId })
    });

    if (!response.ok) throw new Error("اتصال تصویر به پست ناموفق بود");
  }

  async function syncSelectedMedia(postId: number) {
    const attachedAssets = mediaAssets.filter((asset) => asset.post_id === postId);
    const uploadedAsset = await uploadSelectedFile();

    if (uploadedAsset) {
      await Promise.all(attachedAssets.map((asset) => attachMedia(asset.id, null)));
      await attachMedia(uploadedAsset.id, postId);
      return;
    }

    if (selectedMediaId) {
      await Promise.all(attachedAssets.filter((asset) => String(asset.id) !== selectedMediaId).map((asset) => attachMedia(asset.id, null)));
      await attachMedia(Number(selectedMediaId), postId);
      return;
    }

    await Promise.all(attachedAssets.map((asset) => attachMedia(asset.id, null)));
  }

  async function schedulePost(postId: number, scheduledAt: string) {
    const response = await fetch(`${apiUrl}/posts/${postId}/schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ scheduled_at: scheduledAt, timezone: scheduleTimezone })
    });

    if (!response.ok) throw new Error("زمان‌بندی پست ناموفق بود");
    return response.json() as Promise<Post>;
  }

  async function markReadyPost(postId: number) {
    const response = await fetch(`${apiUrl}/posts/${postId}/ready`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}` }
    });

    if (!response.ok) throw new Error("آماده‌سازی پست ناموفق بود");
    return response.json() as Promise<Post>;
  }

  async function changePostStatus(postId: number, status: string) {
    const response = await fetch(`${apiUrl}/posts/${postId}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) throw new Error("تغییر وضعیت پست ناموفق بود");
    return response.json() as Promise<Post>;
  }

  async function persistPost(action: SaveAction) {
    if (!canSaveDraft) {
      setError("برای ذخیره پست، عنوان داخلی را وارد کنید.");
      showToast({ title: "عنوان داخلی لازم است", description: "قبل از ذخیره، یک عنوان برای مدیریت محتوا وارد کنید.", tone: "warning" });
      return;
    }
    if (action === "ready" && !canMarkReady) {
      setError("برای آماده‌سازی، کپشن یا تصویر پست را کامل کنید.");
      showToast({ title: "محتوای پست کامل نیست", description: "برای آماده‌سازی، کپشن یا تصویر اضافه کنید.", tone: "warning" });
      return;
    }
    if (action === "schedule" && !canSchedule) {
      const scheduleError = !hasReadyPublishingChannel
        ? "برای زمان‌بندی، حداقل یک کانال آماده در مرکز کانال‌ها لازم است."
        : instagramSelected && !instagramReady
          ? "اینستاگرام هنوز آماده نیست؛ حالت دستی یا Meta OAuth را از مرکز کانال‌ها کامل کنید."
        : reviewBlocksSchedule
          ? "این پست برای زمان‌بندی باید تایید بازبینی داشته باشد."
          : hasReadyPublishingChannel
            ? "برای زمان‌بندی، زمان انتشار را انتخاب کنید."
            : "برای زمان‌بندی، ابتدا مرکز کانال‌ها را کامل کنید.";
      setError(scheduleError);
      showToast({ title: "زمان‌بندی هنوز آماده نیست", description: scheduleError, tone: "warning" });
      return;
    }

    setSavingAction(action);
    setMessage("");
    setError("");

    try {
      const endpoint = isEditing ? `${apiUrl}/posts/${editingPostId}` : `${apiUrl}/posts`;
      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`
        },
        body: JSON.stringify({ ...form, timezone: scheduleTimezone })
      });

      if (!response.ok) throw new Error(isEditing ? "به‌روزرسانی پست ناموفق بود" : "ذخیره پیش‌نویس ناموفق بود");
      const savedPost = (await response.json()) as Post;

      await syncSelectedMedia(savedPost.id);

      // Link or unlink Instagram Comment Automation Rule
      if (instagramSelected && autoReplyEnabled) {
        const keywordsArray = triggerKeywords.split(",").map(k => k.trim()).filter(Boolean);
        if (keywordsArray.length === 0) {
          throw new Error("برای فعال‌سازی تعامل خودکار، حداقل یک کلیدواژه لازم است.");
        }
        if (!privateReplyMessage.trim()) {
          throw new Error("برای فعال‌سازی تعامل خودکار، متن پاسخ دایرکت لازم است.");
        }

        const rulePayload = {
          name: `تعامل خودکار پست: ${savedPost.title}`,
          status: "active",
          trigger_type: triggerType,
          trigger_keywords: keywordsArray,
          private_reply_message: privateReplyMessage,
          public_reply_enabled: publicReplyEnabled,
          public_reply_message: publicReplyMessage,
          campaign_id: form.campaign_id,
          post_id: savedPost.id,
          match_limit_per_hour: 60,
          match_limit_total: 0,
          is_template: false,
          on_customer_reply: onCustomerReply,
          waiting_reply_message: onCustomerReply === "send_waiting_message" ? waitingReplyMessage : ""
        };

        const ruleUrl = automationRuleId
          ? `${apiUrl}/instagram/automation/rules/${automationRuleId}`
          : `${apiUrl}/instagram/automation/rules`;

        const ruleResponse = await fetch(ruleUrl, {
          method: automationRuleId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`
          },
          body: JSON.stringify(rulePayload)
        });

        if (!ruleResponse.ok) {
          const errData = await ruleResponse.json();
          throw new Error(errData.detail || "ذخیره قانون تعامل خودکار اینستاگرام ناموفق بود");
        }
      } else if (automationRuleId) {
        const ruleUrl = `${apiUrl}/instagram/automation/rules/${automationRuleId}`;
        await fetch(ruleUrl, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token()}` }
        });
      }

      if (action === "schedule" && form.scheduled_at) {
        await schedulePost(savedPost.id, form.scheduled_at);
      } else if (action === "ready") {
        await markReadyPost(savedPost.id);
      } else if (isEditing && editingPost?.status === "scheduled" && !form.scheduled_at) {
        await changePostStatus(savedPost.id, "draft");
      }

      if (!isEditing) {
        clearAutosavedDraft();
        resetComposer({ clearStatus: false });
      }

      const successMessage = action === "schedule"
        ? "پست ذخیره و وارد صف زمان‌بندی شد"
        : action === "ready"
          ? "پست برای زمان‌بندی آماده شد"
          : isEditing
            ? "تغییرات پست ذخیره شد"
            : "پست به عنوان پیش‌نویس ذخیره شد";

      setMessage(successMessage);
      showToast({ title: successMessage, description: action === "schedule" ? "پست در صف انتشار قرار گرفت." : "نسخه جدید در فضای کاری ثبت شد.", tone: "success" });
      await loadData();
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "خطای ذخیره پست";
      setError(nextError);
      showToast({ title: "ذخیره پست ناموفق بود", description: nextError, tone: "alert" });
    } finally {
      setSavingAction(null);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistPost(hasSchedule ? "schedule" : "draft");
  }

  return (
    <AuthGate>
      <AppShell>
        <WorkspacePage className="space-y-3 sm:space-y-4">
          {editingImageSource ? (
            <MediaImageEditor
              imageUrl={editingImageSource.imageUrl}
              filename={editingImageSource.filename}
              saving={savingEditedImage}
              onClose={() => setEditingImageSource(null)}
              onSave={saveEditedComposerImage}
            />
          ) : null}

          {isCampaignDrawerOpen && (
            <NInspectorDrawer
              open={isCampaignDrawerOpen}
              title="انتخاب کمپین"
              description="اتصال پست به کمپین فعال یا ایجاد کمپین جدید."
              onClose={() => setIsCampaignDrawerOpen(false)}
            >
              <div className="space-y-4">
                <Field label="کمپین" hint={selectedCampaign?.goal || selectedCampaign?.notes || "هدف کمپین هنوز تعریف نشده است."}>
                  <Select value={form.campaign_id ?? ""} onChange={(event) => selectCampaign(event.target.value)}>
                    <option value="">بدون کمپین</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} · {campaign.post_count} پست
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-2">
                  <label className="text-xs font-black text-app-text">ساخت کمپین جدید</label>
                  <div className="flex gap-2">
                    <Input value={quickCampaignName} onChange={(event) => setQuickCampaignName(event.target.value)} placeholder="مثلاً لانچ خرداد" />
                    <Button type="button" variant="secondary" size="sm" onClick={quickCreateCampaign} disabled={creatingCampaign}>
                      <Plus className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {creatingCampaign ? "در حال ساخت" : "ساخت"}
                    </Button>
                  </div>
                </div>
                
                <div className="rounded-md bg-app-surfaceMuted/85 p-2.5 shadow-hairline mt-4">
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-right"
                    aria-expanded={showOptionalDetails}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 shrink-0 text-app-primary" aria-hidden="true" />
                      <span className="text-xs font-black text-app-text">یادداشت داخلی</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showOptionalDetails ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {showOptionalDetails ? (
                    <Textarea
                      value={form.internal_note}
                      onChange={(event) => updateField("internal_note", event.target.value)}
                      className="mt-3 min-h-24"
                      placeholder="نکته برای تیم، تایید مدیر یا دلیل زمان‌بندی..."
                    />
                  ) : null}
                </div>
              </div>
            </NInspectorDrawer>
          )}

          {isScheduleDrawerOpen && (
            <NInspectorDrawer
              open={isScheduleDrawerOpen}
              title="زمان‌بندی انتشار"
              description="تاریخ و ساعت مورد نظر خود برای انتشار خودکار را مشخص کنید."
              onClose={() => setIsScheduleDrawerOpen(false)}
            >
              <div className="p-1">
                <ComposerSchedulePanel
                  scheduledAt={form.scheduled_at}
                  timezone={timezone}
                  onChange={(value) => updateField("scheduled_at", value)}
                />
              </div>
            </NInspectorDrawer>
          )}

          <section className="nahrino-card relative overflow-hidden rounded-lg px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(20,184,166,0.12),transparent_30%),radial-gradient(circle_at_78%_10%,rgba(59,130,246,0.10),transparent_28%)]" aria-hidden="true" />
            <div className="relative">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div>
                <p className="text-[10px] font-black text-app-primary">ساخت محتوا</p>
                <h1 className="mt-1 text-xl font-black text-app-text">{isEditing ? "ویرایش پست" : "پست جدید"}</h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-app-muted">یک مسیر حرفه‌ای برای ساخت، پیش‌نمایش، زمان‌بندی و انتشار چندکاناله؛ هر کنترل فقط در مرحله مرتبط دیده می‌شود.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusToken tone={publishTone} className="gap-1">
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {publishStateLabel}
                </StatusToken>
                <ChannelBadges platform={form.platform} compact />
                <StatusToken tone={hasReadyPublishingChannel ? "success" : "warning"}>{hasReadyPublishingChannel ? `${selectedReadyChannels.length} کانال آماده` : "تکمیل کانال لازم است"}</StatusToken>
                {!isEditing ? <StatusToken tone={autosaveState === "dirty" ? "warning" : "neutral"}><Cloud className="h-3.5 w-3.5" aria-hidden="true" />{autosaveLabel}</StatusToken> : null}
                {editingPost?.status ? <StatusBadge status={editingPost.status} /> : null}
                {editingPost ? <ApprovalBadge status={editingPost.approval_status} compact /> : null}
                <Button type="button" variant="secondary" size="sm" onClick={startWithUpload}>
                  <ImagePlus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  آپلود رسانه
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={startWithDefaults}>
                  <WandSparkles className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  پیش‌فرض برند
                </Button>
                <Button href="/calendar" variant="secondary" size="sm">بازگشت به پلنر</Button>
              </div>
            </div>
            </div>
          </section>

          <form onSubmit={saveDraft} className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="grid min-w-0 gap-3 xl:col-span-2 xl:grid-cols-[minmax(0,1fr)_340px]">
              <ComposerStepRail steps={composerSteps} activeStep={activeStepIndex} onStepClick={handleStepClick} />

              <section className="app-studio-panel rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-app-text">نقشه انتشار</p>
                    <p className="mt-1 text-xs leading-5 text-app-muted">وضعیت‌های مهم بدون باز کردن فرم‌های اضافه.</p>
                  </div>
                  <StatusToken tone={publishTone}>{readinessScore}%</StatusToken>
                </div>
                <div className="mt-3 grid gap-2">
                  {workflowCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <button
                        key={card.label}
                        type="button"
                        onClick={() => {
                          setWorkspaceMode("workflow");
                          if (card.label === "کانال") {
                            setActiveStepIndex(2);
                          } else if (card.label === "کمپین") {
                            setActiveStepIndex(2);
                            if (window.innerWidth < 1024) {
                              setIsCampaignDrawerOpen(true);
                            }
                          } else if (card.label === "زمان") {
                            setActiveStepIndex(2);
                            if (window.innerWidth < 1024) {
                              setIsScheduleDrawerOpen(true);
                            } else {
                              setStudioPanel("schedule");
                            }
                          }
                        }}
                        className="app-interactive group flex items-center gap-3 rounded-md border border-app-border bg-white/72 p-2.5 text-right shadow-hairline backdrop-blur transition hover:border-app-primary/25 hover:bg-white hover:shadow-soft"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-app-soft text-app-primary transition group-hover:bg-app-primary group-hover:text-white">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-black text-app-muted">{card.label}</span>
                          <span className="mt-0.5 block truncate text-sm font-black text-app-text">{card.value}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-app-muted">{card.detail}</span>
                        </span>
                        <StatusToken tone={card.tone} size="sm">{card.tone === "success" ? "آماده" : card.tone === "primary" ? "متصل" : "باز"}</StatusToken>
                      </button>
                    );
                  })}
                </div>
              </section>
            </section>

            <section id="composer-workspace" className="min-w-0 space-y-3">
              <WorkspacePanel
                title="بوم تولید"
                description="متن، رسانه و مسیر انتشار در یک فضای متمرکز؛ بدون کارت‌های تکراری و فرم‌های مزاحم."
                action={(
                  <div className="flex flex-wrap items-center gap-2">
                    <ChannelBadges platform={form.platform} compact />
                    {hasSchedule ? <Tag tone="success">زمان‌بندی شده</Tag> : null}
                  </div>
                )}
                bodyClassName="p-0"
              >
                <div className="grid grid-cols-3 gap-1 border-b border-app-border bg-app-surfaceMuted/80 p-1.5">
                  {workspaceModes.map((mode) => {
                    const Icon = mode.icon;
                    const active = workspaceMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => {
                          setWorkspaceMode(mode.value);
                          if (mode.value === "content") {
                            setActiveStepIndex(0);
                            setStudioPanel("preview");
                          } else if (mode.value === "media") {
                            setActiveStepIndex(1);
                            setStudioPanel("preview");
                          } else if (mode.value === "workflow") {
                            setActiveStepIndex(studioPanel === "review" ? 3 : 2);
                          }
                        }}
                        className={`app-interactive flex min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-right transition ${
                          active ? "bg-white text-app-primary shadow-soft" : "text-app-muted hover:bg-white/75 hover:text-app-text"
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? "bg-app-soft text-app-primary" : "bg-white text-slate-500 shadow-hairline"}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-xs font-black">
                            {mode.done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : null}
                            <span className="truncate">{mode.label}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-app-muted">{mode.detail}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 sm:p-4">
                  {workspaceMode === "content" ? (
                    <div id="composer-content" className={`grid gap-3 lg:grid ${activeStepIndex === 0 ? "grid" : "hidden"}`}>
                      <div className="rounded-md border border-white/70 bg-white/75 p-3 shadow-hairline backdrop-blur-xl">
                        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                          <div>
                            <p className="text-sm font-black text-app-text">متن اصلی پست</p>
                            <p className="mt-1 text-xs leading-5 text-app-muted">عنوان برای تیم است؛ کپشن و هشتگ‌ها وارد خروجی مخاطب می‌شوند.</p>
                          </div>
                          <Button type="button" variant="secondary" size="sm" onClick={applyDefaults}>
                            <WandSparkles className="ml-1.5 h-4 w-4" aria-hidden="true" />
                            پیش‌فرض برند
                          </Button>
                        </div>

                        <div className="grid gap-3">
                          <Field label="عنوان داخلی پست" required hint="فقط برای مدیریت محتوا و صف انتشار؛ مخاطب این عنوان را نمی‌بیند.">
                            <Input
                              value={form.title}
                              onChange={(event) => updateField("title", event.target.value)}
                              placeholder="مثلاً معرفی محصول جدید"
                              required
                            />
                          </Field>

                          <Field label="کپشن" hint={`${captionLength} کاراکتر`}>
                            <Textarea
                              value={form.caption}
                              onChange={(event) => updateField("caption", event.target.value)}
                              className="min-h-[260px] resize-y border-0 bg-app-canvas/95 px-4 py-3 text-[15px] leading-8 shadow-hairline lg:min-h-[340px]"
                              placeholder="متن پست شبکه‌های اجتماعی را وارد کنید..."
                            />
                          </Field>

                          <Field label="هشتگ‌ها" hint={`${hashtagCount} هشتگ شناسایی شد`}>
                            <Input
                              value={form.hashtags}
                              onChange={(event) => updateField("hashtags", event.target.value)}
                              placeholder="#فروشگاه #محصول #پیشنهاد"
                            />
                          </Field>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <button type="button" onClick={() => handleStepClick(1)} className="app-interactive rounded-md border border-app-border bg-white/70 p-3 text-right shadow-hairline hover:bg-white">
                          <Images className="mb-2 h-4 w-4 text-app-primary" aria-hidden="true" />
                          <span className="block text-xs font-black text-app-text">افزودن رسانه</span>
                          <span className="mt-1 block text-[11px] leading-5 text-app-muted">{previewImageUrl ? "تصویر انتخاب شده است." : "از کتابخانه یا آپلود جدید."}</span>
                        </button>
                        <button type="button" onClick={() => handleStepClick(2)} className="app-interactive rounded-md border border-app-border bg-white/70 p-3 text-right shadow-hairline hover:bg-white">
                          <Megaphone className="mb-2 h-4 w-4 text-app-primary" aria-hidden="true" />
                          <span className="block text-xs font-black text-app-text">کمپین و کانال</span>
                          <span className="mt-1 block text-[11px] leading-5 text-app-muted">{campaignLabel}</span>
                        </button>
                        <button type="button" onClick={() => handleStepClick(2)} className="app-interactive rounded-md border border-app-border bg-white/70 p-3 text-right shadow-hairline hover:bg-white">
                          <CalendarClock className="mb-2 h-4 w-4 text-app-primary" aria-hidden="true" />
                          <span className="block text-xs font-black text-app-text">زمان انتشار</span>
                          <span className="mt-1 block text-[11px] leading-5 text-app-muted">{scheduleLabel}</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {workspaceMode === "media" ? (
                    <div id="composer-media" className={`grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)] ${activeStepIndex === 1 ? "grid" : "hidden"}`}>
                      <div className="space-y-3">
                        <label className="app-interactive block cursor-pointer rounded-md border border-dashed border-app-borderStrong bg-app-surfaceMuted p-3 hover:border-blue-300 hover:bg-blue-50">
                          <input
                            ref={uploadInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => {
                              setSelectedFile(event.target.files?.[0] ?? null);
                              if (event.target.files?.[0]) setSelectedMediaId("");
                              if (message) setMessage("");
                            }}
                            className="sr-only"
                          />
                          <span className="flex items-center gap-2 text-sm font-black text-app-text">
                            <ImagePlus className="h-4 w-4" aria-hidden="true" />
                            آپلود تصویر
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-app-muted">JPEG، PNG یا WEBP</span>
                        </label>

                        {previewImageUrl ? (
                          <div className="rounded-md border border-app-border bg-white p-2 shadow-hairline">
                            <img src={previewImageUrl} alt="پیش‌نمایش رسانه انتخاب‌شده" className="aspect-video w-full rounded-md object-cover" />
                            <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={openImageEditor}>
                              <PencilLine className="ml-1.5 h-4 w-4" aria-hidden="true" />
                              ویرایش تصویر
                            </Button>
                          </div>
                        ) : (
                          <div className="rounded-md bg-app-surfaceMuted p-3 text-xs leading-5 text-app-muted shadow-hairline">
                            تصویر اختیاری است، اما برای خروجی حرفه‌ای بهتر است یک رسانه انتخاب شود.
                          </div>
                        )}
                      </div>

                      <MediaGalleryPicker
                        assets={mediaAssets}
                        campaigns={campaigns}
                        posts={posts}
                        previewUrls={mediaPreviewUrls}
                        selectedMediaId={selectedMediaId}
                        activeCampaignId={form.campaign_id}
                        loading={loading}
                        onSelect={(assetId) => {
                          setSelectedMediaId(assetId);
                          setSelectedFile(null);
                          if (message) setMessage("");
                        }}
                      />
                    </div>
                  ) : null}

                  {workspaceMode === "workflow" ? (
                    <div className="grid gap-3">
                      <section className="rounded-md border border-app-border bg-white/72 p-3 shadow-hairline backdrop-blur">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <p className="text-sm font-black text-app-text">کانال انتشار</p>
                            <p className="mt-1 text-xs leading-5 text-app-muted">برای هر کانال، محدودیت انتشار و آمادگی را قبل از زمان‌بندی ببینید.</p>
                          </div>
                          <ChannelBadges platform={form.platform} />
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {channelOptions.map((option) => {
                            const Icon = option.icon;
                            const active = selectedChannels.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleChannel(option.value)}
                                className={`app-interactive rounded-md border px-3 py-3 text-right ${
                                  active ? "border-blue-200 bg-white text-app-primary shadow-soft" : "border-app-border bg-white/70 text-app-text hover:bg-white"
                                }`}
                                aria-pressed={active}
                              >
                                <span className="flex items-center gap-2 text-sm font-black">
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                  {option.label}
                                </span>
                                <span className="mt-1 block text-xs leading-5 text-app-muted">{option.description}</span>
                              </button>
                            );
                          })}
                        </div>
                        {channelNotes.length ? (
                          <div className="mt-3 space-y-1.5">
                            {channelNotes.map((note) => <p key={note} className="text-xs leading-5 text-app-muted">{note}</p>)}
                          </div>
                        ) : null}
                      </section>

                      {/* Mobile Campaign & Schedule Buttons */}
                      <div className="lg:hidden grid gap-2 grid-cols-2">
                        <Button type="button" variant="secondary" onClick={() => setIsCampaignDrawerOpen(true)} className="w-full">
                          <Megaphone className="ml-1.5 h-4 w-4" aria-hidden="true" />
                          کمپین: {campaignLabel}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setIsScheduleDrawerOpen(true)} className="w-full">
                          <CalendarClock className="ml-1.5 h-4 w-4" aria-hidden="true" />
                          زمان: {scheduleLabel}
                        </Button>
                      </div>

                      <section className="hidden lg:block rounded-md border border-app-border bg-white/72 p-3 shadow-hairline backdrop-blur">
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-app-text">کمپین و یادداشت</p>
                            <p className="mt-1 text-xs leading-5 text-app-muted">کمپین فقط برای دسته‌بندی، گزارش و برنامه‌ریزی است؛ فرم بزرگ جداگانه ندارد.</p>
                          </div>
                          {selectedCampaign ? (
                            <span className="mt-0.5 h-4 w-4 shrink-0 rounded shadow-hairline" style={{ backgroundColor: selectedCampaign.color }} aria-hidden="true" />
                          ) : null}
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="grid gap-2">
                            <Select value={form.campaign_id ?? ""} onChange={(event) => selectCampaign(event.target.value)}>
                              <option value="">بدون کمپین</option>
                              {campaigns.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name} · {campaign.post_count} پست
                                </option>
                              ))}
                            </Select>

                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                              <Input value={quickCampaignName} onChange={(event) => setQuickCampaignName(event.target.value)} placeholder="نام کمپین جدید، مثلاً لانچ خرداد" />
                              <Button type="button" variant="secondary" size="sm" onClick={quickCreateCampaign} disabled={creatingCampaign}>
                                <Plus className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {creatingCampaign ? "در حال ساخت" : "ساخت"}
                              </Button>
                            </div>
                            {selectedCampaign ? (
                              <p className="line-clamp-2 text-xs leading-5 text-app-muted">{selectedCampaign.goal || selectedCampaign.notes || "هدف کمپین هنوز تعریف نشده است."}</p>
                            ) : null}
                          </div>

                          <div className="rounded-md bg-app-surfaceMuted/85 p-2.5 shadow-hairline">
                            <button
                              type="button"
                              onClick={() => setShowOptionalDetails((current) => !current)}
                              className="flex w-full items-center justify-between gap-3 text-right"
                              aria-expanded={showOptionalDetails}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <SlidersHorizontal className="h-4 w-4 shrink-0 text-app-primary" aria-hidden="true" />
                                <span>
                                  <span className="block text-sm font-black text-app-text">یادداشت داخلی</span>
                                  <span className="mt-1 block text-xs text-app-muted">{form.internal_note ? "یادداشت ثبت شده است." : "برای تیم و تاییدها اختیاری است."}</span>
                                </span>
                              </span>
                              <ChevronDown className={`h-4 w-4 text-slate-500 transition ${showOptionalDetails ? "rotate-180" : ""}`} aria-hidden="true" />
                            </button>
                            {showOptionalDetails ? (
                              <Textarea
                                value={form.internal_note}
                                onChange={(event) => updateField("internal_note", event.target.value)}
                                className="mt-3 min-h-24"
                                placeholder="نکته برای تیم، تایید مدیر یا دلیل زمان‌بندی..."
                              />
                            ) : null}
                          </div>
                        </div>
                      </section>

                      {instagramSelected ? (
                        <section className="rounded-md border border-app-border bg-white/72 p-3 shadow-hairline backdrop-blur space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-black text-app-text">تعامل خودکار اینستاگرام (کامنت به دایرکت)</p>
                              <p className="mt-1 text-xs leading-5 text-app-muted">ارسال خودکار پیام دایرکت و پاسخ به کامنت در صورت دریافت کلمه کلیدی.</p>
                            </div>
                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                type="checkbox"
                                checked={autoReplyEnabled}
                                onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                                className="peer sr-only"
                              />
                              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-app-primary peer-checked:after:translate-x-full peer-focus:outline-none" />
                            </label>
                          </div>

                          {autoReplyEnabled ? (
                            <div className="mt-3 grid gap-3 border-t border-app-border pt-3">
                              {templates.length > 0 ? (
                                <div className="grid gap-2">
                                  <label className="text-xs font-black text-app-text">انتخاب قالب آماده تعامل خودکار</label>
                                  <select
                                    className="app-input-style rounded-md border border-app-border bg-white px-3 py-2 text-xs"
                                    onChange={async (e) => {
                                      const val = e.target.value;
                                      if (val) {
                                        const rule = templates.find((t) => String(t.id) === val);
                                        if (rule) {
                                          setTriggerKeywords(rule.trigger_keywords.join(", "));
                                          setTriggerType(rule.trigger_type);
                                          setPrivateReplyMessage(rule.private_reply_message);
                                          setPublicReplyEnabled(rule.public_reply_enabled);
                                          setPublicReplyMessage(rule.public_reply_message);
                                          setOnCustomerReply(rule.on_customer_reply);
                                          setWaitingReplyMessage(rule.waiting_reply_message ?? "");
                                        }
                                      }
                                    }}
                                  >
                                    <option value="">-- انتخاب از کتابخانه الگوها --</option>
                                    {templates.map((tpl) => (
                                      <option key={tpl.id} value={tpl.id}>
                                        {tpl.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}

                              <div className="grid gap-3 lg:grid-cols-2">
                                <Field label="کلمه کلیدی (کلیدواژه‌ها با کاما جدا شوند)" required hint="مثلاً: 5, قیمت, راهنمایی">
                                  <Input
                                    value={triggerKeywords}
                                    onChange={(e) => setTriggerKeywords(e.target.value)}
                                    placeholder="۵، قیمت، تخفیف"
                                    required
                                  />
                                  {captionSuggestions.length > 0 ? (
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-app-muted">
                                      <span>💡 پیشنهادها بر اساس کپشن:</span>
                                      {captionSuggestions.map((sug) => (
                                        <button
                                          key={sug}
                                          type="button"
                                          onClick={() => {
                                            const current = triggerKeywords.trim();
                                            const added = current ? `${current}, ${sug}` : sug;
                                            const unique = Array.from(new Set(added.split(",").map(k => k.trim()).filter(Boolean))).join(", ");
                                            setTriggerKeywords(unique);
                                          }}
                                          className="rounded-full bg-app-soft px-2 py-0.5 text-[10px] font-bold text-app-primary hover:bg-app-primary hover:text-white transition"
                                        >
                                          {sug} +
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}
                                </Field>

                                <Field label="نوع تطابق کلیدواژه">
                                  <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
                                    <option value="exact">تطابق دقیق کلمه</option>
                                    <option value="contains">شامل کلمه</option>
                                    <option value="any_of">هر کدام از کلمات</option>
                                  </Select>
                                </Field>
                              </div>

                              <Field label="پیام پاسخ خودکار دایرکت (DM)" required hint="این پیام به صورت خصوصی به دایرکت کاربر فرستاده می‌شود.">
                                <Textarea
                                  value={privateReplyMessage}
                                  onChange={(e) => setPrivateReplyMessage(e.target.value)}
                                  className="min-h-16"
                                  placeholder="سلام! لینک خرید خدمت شما: https://example.com"
                                  required
                                />
                              </Field>

                              <div className="rounded-md border border-app-border bg-app-surfaceMuted/50 p-2.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="publicReplyEnabled"
                                    checked={publicReplyEnabled}
                                    onChange={(e) => setPublicReplyEnabled(e.target.checked)}
                                    className="rounded border-gray-300 text-app-primary focus:ring-app-primary h-4 w-4"
                                  />
                                  <label htmlFor="publicReplyEnabled" className="text-xs font-black text-app-text cursor-pointer">
                                    پاسخ عمومی به کامنت کاربر فعال شود؟
                                  </label>
                                </div>
                                {publicReplyEnabled ? (
                                  <Input
                                    value={publicReplyMessage}
                                    onChange={(e) => setPublicReplyMessage(e.target.value)}
                                    placeholder="ارسال شد؛ لطفاً دایرکت خود را چک کنید 🌹"
                                    className="text-xs"
                                  />
                                ) : null}
                              </div>

                              {/* Takeover Control Settings */}
                              <div className="border-t border-app-border pt-3 space-y-3">
                                <div>
                                  <p className="text-xs font-black text-app-text">رفتار در صورت پاسخ مشتری (Operator Takeover)</p>
                                  <p className="mt-0.5 text-[10px] text-app-muted">زمانی که کاربر به پیام خودکار شما پاسخ دهد، اتوماسیون متوقف شده و این گفتگو به اپراتور واگذار می‌شود.</p>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className={`app-interactive flex items-start gap-2.5 rounded-md border p-2.5 text-right cursor-pointer transition ${
                                    onCustomerReply === "hand_off" ? "border-app-primary bg-white shadow-soft" : "border-app-border bg-white/70"
                                  }`}>
                                    <input
                                      type="radio"
                                      name="onCustomerReply"
                                      value="hand_off"
                                      checked={onCustomerReply === "hand_off"}
                                      onChange={() => setOnCustomerReply("hand_off")}
                                      className="mt-0.5 h-3.5 w-3.5 text-app-primary focus:ring-app-primary"
                                    />
                                    <span>
                                      <span className="block text-xs font-black text-app-text">سکوت و واگذاری گفتگو</span>
                                      <span className="mt-0.5 block text-[10px] text-app-muted">بدون پیام اضافه، وضعیت گفتگو را به «در انتظار پاسخ اپراتور» تغییر دهید.</span>
                                    </span>
                                  </label>

                                  <label className={`app-interactive flex items-start gap-2.5 rounded-md border p-2.5 text-right cursor-pointer transition ${
                                    onCustomerReply === "send_waiting_message" ? "border-app-primary bg-white shadow-soft" : "border-app-border bg-white/70"
                                  }`}>
                                    <input
                                      type="radio"
                                      name="onCustomerReply"
                                      value="send_waiting_message"
                                      checked={onCustomerReply === "send_waiting_message"}
                                      onChange={() => setOnCustomerReply("send_waiting_message")}
                                      className="mt-0.5 h-3.5 w-3.5 text-app-primary focus:ring-app-primary"
                                    />
                                    <span>
                                      <span className="block text-xs font-black text-app-text">ارسال پیام انتظار خودکار</span>
                                      <span className="mt-0.5 block text-[10px] text-app-muted">یک پیام پیش‌فرض برای مشتری بفرستید و سپس گفتگو را به اپراتور واگذار کنید.</span>
                                    </span>
                                  </label>
                                </div>
                                {onCustomerReply === "send_waiting_message" ? (
                                  <Field label="متن پیام انتظار خودکار" required hint="این پیام قبل از توقف اتوماسیون به دایرکت کاربر فرستاده می‌شود.">
                                    <Input
                                      value={waitingReplyMessage}
                                      onChange={(e) => setWaitingReplyMessage(e.target.value)}
                                      placeholder="پیام شما دریافت شد؛ به زودی اپراتور به شما پاسخ خواهد داد."
                                      required
                                    />
                                  </Field>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </WorkspacePanel>

              {/* Mobile Stepper pagination */}
              <div className="lg:hidden flex items-center justify-between border-t border-app-border bg-app-surfaceMuted/50 p-3 mt-3 rounded-lg">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={activeStepIndex === 0}
                  onClick={() => handleStepClick(activeStepIndex - 1)}
                  className="w-[45%]"
                >
                  قبلی
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  disabled={activeStepIndex === 3}
                  onClick={() => handleStepClick(activeStepIndex + 1)}
                  className="w-[45%]"
                >
                  بعدی
                </Button>
              </div>

              {message ? <NoticeBanner tone="success" title="انجام شد">{message}</NoticeBanner> : null}
              {error ? <NoticeBanner tone="alert" title="نیاز به بررسی">{error}</NoticeBanner> : null}
            </section>

            <aside className="min-w-0 space-y-3 xl:sticky xl:top-24 xl:self-start">
              <WorkspacePanel
                title="بازرس انتشار"
                description="پیش‌نمایش، زمان‌بندی و کنترل نهایی در یک پنل ثابت."
                action={<StatusToken tone={publishTone}>{publishStateLabel}</StatusToken>}
                bodyClassName="p-0"
              >
                <div className="grid grid-cols-3 border-b border-app-border bg-app-surfaceMuted p-1">
                  {studioPanels.map((panel) => {
                    const Icon = panel.icon;
                    const active = studioPanel === panel.value;
                    return (
                      <button
                        key={panel.value}
                        type="button"
                        onClick={() => {
                          setStudioPanel(panel.value);
                          if (panel.value === "schedule") {
                            setWorkspaceMode("workflow");
                            setActiveStepIndex(2);
                          } else if (panel.value === "review") {
                            setWorkspaceMode("workflow");
                            setActiveStepIndex(3);
                          } else if (panel.value === "preview") {
                            if (workspaceMode !== "content" && workspaceMode !== "media") {
                              setWorkspaceMode("content");
                              setActiveStepIndex(0);
                            } else {
                              setActiveStepIndex(workspaceMode === "content" ? 0 : 1);
                            }
                          }
                        }}
                        className={`app-interactive relative flex min-w-0 flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] font-black ${
                          active ? "bg-white text-app-primary shadow-sm" : "text-slate-500 hover:text-app-text"
                        }`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        <span className="truncate">{panel.label}</span>
                        <span className={`absolute left-2 top-2 h-1.5 w-1.5 rounded-full ${panel.ready ? "bg-emerald-500" : "bg-slate-300"}`} />
                      </button>
                    );
                  })}
                </div>

                <div className="p-3">
                  {studioPanel === "preview" ? (
                    <div>
                      <div className="mb-3 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-app-text">کانال پیش‌نمایش</p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewChannel("rubika")}
                              className={`rounded px-2.5 py-1 text-xs font-black transition ${
                                previewChannel === "rubika" ? "bg-app-primary text-white" : "bg-app-surfaceMuted text-app-muted hover:bg-slate-200"
                              }`}
                            >
                              روبیکا
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewChannel("instagram")}
                              className={`rounded px-2.5 py-1 text-xs font-black transition ${
                                previewChannel === "instagram" ? "bg-app-primary text-white" : "bg-app-surfaceMuted text-app-muted hover:bg-slate-200"
                              }`}
                            >
                              اینستاگرام
                            </button>
                          </div>
                        </div>

                        {previewChannel === "instagram" ? (
                          <div className="flex items-center justify-between border-t border-app-border pt-2">
                            <p className="text-xs font-black text-app-muted">قالب انتشار</p>
                            <div className="flex gap-1">
                              {(["feed", "story", "reel"] as const).map((mode) => (
                                <button
                                  key={mode}
                                  type="button"
                                  onClick={() => setInstagramPreviewMode(mode)}
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold capitalize transition ${
                                    instagramPreviewMode === mode ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                  }`}
                                >
                                  {mode === "feed" ? "پست" : mode === "story" ? "استوری" : "ریلز"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {previewChannel === "instagram" ? (
                        <InstagramPostPreview
                          imageUrl={previewImageUrl}
                          caption={finalPreview}
                          destination={store?.name || "اکانت اینستاگرام"}
                          brandColor={store?.brand_primary_color}
                          avatarUrl={brandAvatarUrl}
                          viewMode={instagramPreviewMode}
                        />
                      ) : (
                        <RubikaPostPreview
                          imageUrl={previewImageUrl}
                          caption={finalPreview}
                          destination={store?.name || "کانال روبیکا"}
                          brandColor={store?.brand_primary_color}
                          avatarUrl={brandAvatarUrl}
                        />
                      )}

                      <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-app-border overflow-hidden rounded-md bg-app-surfaceMuted text-center shadow-hairline">
                        <div className="p-2"><p className="text-sm font-black text-app-text">{captionLength}</p><p className="mt-1 text-[10px] text-app-muted">کاراکتر</p></div>
                        <div className="p-2"><p className="text-sm font-black text-app-text">{hashtagCount}</p><p className="mt-1 text-[10px] text-app-muted">هشتگ</p></div>
                        <div className="p-2"><p className="text-sm font-black text-app-text">{previewImageUrl ? "1" : "0"}</p><p className="mt-1 text-[10px] text-app-muted">رسانه</p></div>
                      </div>
                    </div>
                  ) : null}

                  {studioPanel === "schedule" ? (
                    <ComposerSchedulePanel
                      scheduledAt={form.scheduled_at}
                      timezone={timezone}
                      onChange={(value) => updateField("scheduled_at", value)}
                    />
                  ) : null}

                  {studioPanel === "review" ? (
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-app-text">کنترل پیش از انتشار</p>
                        <StatusToken tone={canSchedule ? "success" : "warning"}>{canSchedule ? "آماده صف" : "نیازمند تکمیل"}</StatusToken>
                      </div>
                      {editingPost ? (
                        <div className="mb-3 rounded-md border border-app-border bg-app-surfaceMuted/70 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <ApprovalBadge status={editingPost.approval_status} />
                            {editingPost.reviewed_by ? <StatusToken tone="neutral">{editingPost.reviewed_by}</StatusToken> : null}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-app-muted">{approvalConfig(editingPost.approval_status).description}</p>
                          {editingPost.approval_note ? <p className="mt-2 rounded bg-white px-3 py-2 text-xs leading-5 text-app-muted shadow-hairline">{editingPost.approval_note}</p> : null}
                        </div>
                      ) : null}
                      <ComposerReadinessChecks items={readinessItems} />
                      <Button href="/media" variant="secondary" className="mt-4 w-full">کتابخانه رسانه</Button>
                    </div>
                  ) : null}
                </div>
              </WorkspacePanel>
            </aside>

            <div className="xl:col-span-2">
              <ComposerActionFooter
                savingAction={savingAction}
                canSaveDraft={canSaveDraft}
                canMarkReady={canMarkReady}
                canSchedule={canSchedule}
                hasSchedule={hasSchedule}
                isEditing={isEditing}
                onUseDefaults={applyDefaults}
                onCancel={resetComposer}
                autosaveLabel={!isEditing ? autosaveLabel : undefined}
                onSaveDraft={() => persistPost("draft")}
                onMarkReady={() => persistPost("ready")}
                onSchedule={() => persistPost("schedule")}
              />
            </div>
          </form>
        </WorkspacePage>
      </AppShell>
    </AuthGate>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-app-muted">در حال آماده‌سازی composer...</div>}>
      <ComposePageContent />
    </Suspense>
  );
}
