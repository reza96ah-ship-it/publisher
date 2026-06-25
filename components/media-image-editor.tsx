"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Copy, Crop, Eye, EyeOff, FlipHorizontal, Group, ImagePlus, Layers3, Lock, Maximize2, Minus, Palette, Plus, RectangleHorizontal, Redo2, RotateCcw, RotateCw, Save, ShieldCheck, SmilePlus, Square, Trash2, Type, Undo2, Ungroup, Unlock, X, Zap, type LucideIcon } from "lucide-react";
import { PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl, authHeaders } from "../lib/posts";
import { Button } from "./ui/button";
import { StatusToken } from "./workspace-ui";

type EditorLayer = {
  id: string;
  type: "text" | "sticker";
  value: string;
  x: number;
  y: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  boxWidth: number;
  padding: number;
  radius: number;
  outlineColor: string;
  outlineWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  align: "left" | "center" | "right";
  rotation: number;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  groupId?: string;
};

type ImageAdjustments = {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
};

type ImageOverlayMode = "none" | "vignette" | "darkWash" | "lightWash" | "gradient" | "spotlight";

type ImageOverlaySettings = {
  mode: ImageOverlayMode;
  strength: number;
};

type CropPresetId = "original" | "rubika" | "square" | "portrait" | "story" | "landscape";

type ImageCropSettings = {
  presetId: CropPresetId;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  flipX: boolean;
};

type ExportFormat = "png" | "jpeg" | "webp";

type MediaImageEditorProps = {
  imageUrl: string;
  filename: string;
  saving?: boolean;
  onClose: () => void;
  onSave: (file: File) => Promise<void>;
};

type EditorSnapshot = {
  layers: EditorLayer[];
  adjustments: ImageAdjustments;
  overlay: ImageOverlaySettings;
  crop: ImageCropSettings;
  canvasSize: { width: number; height: number };
};

type ActiveTransform = {
  layerId: string;
  mode: "resize" | "rotate";
  initialFontSize: number;
  initialRotation: number;
  initialDistance: number;
  initialAngle: number;
};

type CanvasGuides = {
  centerX: boolean;
  centerY: boolean;
};

type CanvasFitMode = "fit" | "actual" | "fill" | "custom";

type SavedEditorTemplate = {
  id: string;
  name: string;
  createdAt: string;
  layers: EditorLayer[];
  adjustments: ImageAdjustments;
  overlay: ImageOverlaySettings;
  crop: ImageCropSettings;
  canvasSize: { width: number; height: number };
  brandColors?: string[];
};

type DesignRecipe = {
  id: string;
  label: string;
  category: string;
  detail: string;
  bestFor: string;
  accent: string;
  surface: string;
  cropPresetId: CropPresetId;
  overlay: ImageOverlaySettings;
  adjustments: Partial<ImageAdjustments>;
  texts: Array<{ presetIndex: number; x?: number; y: number; boxWidth: number }>;
  stickers: Array<{ value: string; x: number; y: number }>;
};

type StoreBrandColors = {
  brand_primary_color?: string;
  brand_accent_color?: string;
};

const recentColorStorageKey = "rubika_publisher_editor_recent_colors";
const recentStickerStorageKey = "rubika_publisher_editor_recent_stickers";
const editorTemplateStorageKey = "rubika_publisher_editor_templates";
const labelSwatches = ["#0F172A", "#0F766E", "#2563EB", "#E11D48", "#F59E0B", "#FFFFFF"];
const neutralColorSwatches = ["#FFFFFF", "#F8FAFC", "#E2E8F0", "#94A3B8", "#475569", "#0F172A"];
const commerceColorSwatches = ["#0F766E", "#16A34A", "#F59E0B", "#E11D48", "#2563EB", "#7C3AED"];
const stickerPacks = [
  { label: "فروش", stickers: ["🔥", "🎁", "🛍️", "💎", "⭐", "📣"] },
  { label: "تخفیف", stickers: ["٪", "✅", "⚡", "✨", "🎉", "💥"] },
  { label: "اعتماد", stickers: ["✅", "⭐", "💎", "🛡️", "📦", "💬"] },
  { label: "فصل‌ها", stickers: ["🌿", "☀️", "🍂", "❄️", "🌙", "❤️"] },
  { label: "تحویل", stickers: ["🚚", "📦", "⏱️", "📍", "🔁", "🧾"] },
  { label: "تعامل", stickers: ["💬", "👇", "👀", "🤍", "🙌", "📲"] }
];
const fontSampleText = "پچژگ فروش ویژه ۱۲۳";
const fontPickerPreviewText = "فروش ویژه ۱۲۳";
const fontOptions = [
  { label: "وزیرمتن", value: "Vazirmatn" },
  { label: "لاله‌زار", value: "Lalezar" },
  { label: "B Badr", value: "BBadr" },
  { label: "B Baran", value: "BBaran" },
  { label: "B Bardiya", value: "BBardiya" },
  { label: "B Compset", value: "BCompset" },
  { label: "B Davat", value: "BDavat" },
  { label: "B Elham", value: "BElham" },
  { label: "B Esfehan Bold", value: "BEsfehanBold" },
  { label: "B Fantezy", value: "BFantezy" },
  { label: "B Farnaz", value: "BFarnaz" },
  { label: "B Ferdosi", value: "BFerdosi" },
  { label: "B Hamid", value: "BHamid" },
  { label: "B Helal", value: "BHelal" },
  { label: "B Homa", value: "BHoma" },
  { label: "B Jadid Bold", value: "BJadidBold" },
  { label: "B Jalal", value: "BJalal" },
  { label: "B Koodak Bold", value: "BKoodakBold" },
  { label: "B Kourosh", value: "BKourosh" },
  { label: "B Lotus", value: "BLotus" },
  { label: "B Mahsa", value: "BMahsa" },
  { label: "B Mehr Bold", value: "BMehrBold" },
  { label: "B Mitra", value: "BMitra" },
  { label: "B Morvarid", value: "BMorvarid" },
  { label: "B Narm", value: "BNarm" },
  { label: "B Nasim Bold", value: "BNasimBold" },
  { label: "B Nazanin", value: "BNazanin" },
  { label: "B Roya", value: "BRoya" },
  { label: "B Setareh Bold", value: "BSetarehBold" },
  { label: "B Shiraz", value: "BShiraz" },
  { label: "B Sina Bold", value: "BSinaBold" },
  { label: "B Tabassom", value: "BTabassom" },
  { label: "B Tehran", value: "BTehran" },
  { label: "B Titr Bold", value: "BTitrBold" },
  { label: "B Titr TGE Bold", value: "BTitrTGEBold" },
  { label: "B Traffic", value: "BTraffic" },
  { label: "B Vahid Bold", value: "BVahidBold" },
  { label: "B Yagut", value: "BYagut" },
  { label: "B Yas", value: "BYas" },
  { label: "B Yekan", value: "BYekan" },
  { label: "B Zar", value: "BZar" },
  { label: "B Ziba", value: "BZiba" },
  { label: "Tahoma", value: "Tahoma" }
];
const textStylePresets = [
  { label: "تیتر فروش", value: "فروش ویژه", color: "#FFFFFF", backgroundColor: "#E11D48", fontFamily: "Lalezar", fontWeight: 700, fontSizeRatio: 12, radius: 18, padding: 18, outlineWidth: 0, shadowBlur: 8 },
  { label: "قیمت", value: "۲۹۹ هزار تومان", color: "#0F172A", backgroundColor: "#FFFFFF", fontFamily: "Vazirmatn", fontWeight: 900, fontSizeRatio: 16, radius: 14, padding: 16, outlineWidth: 0, shadowBlur: 5 },
  { label: "دعوت به اقدام", value: "همین حالا سفارش بده", color: "#FFFFFF", backgroundColor: "#0F766E", fontFamily: "Vazirmatn", fontWeight: 800, fontSizeRatio: 20, radius: 999, padding: 16, outlineWidth: 0, shadowBlur: 6 },
  { label: "زیرتیتر", value: "ارسال سریع و تضمین کیفیت", color: "#FFFFFF", backgroundColor: "#0F172A", fontFamily: "BNazanin", fontWeight: 700, fontSizeRatio: 24, radius: 12, padding: 14, outlineWidth: 1, shadowBlur: 4 },
  { label: "تیتر دورخط", value: "جدیدترین مدل", color: "#FFFFFF", backgroundColor: "#0F172A", fontFamily: "BTitrBold", fontWeight: 900, fontSizeRatio: 13, radius: 14, padding: 16, outlineWidth: 3, outlineColor: "#0F172A", shadowBlur: 10 },
  { label: "لیبل لوکس", value: "کالکشن محدود", color: "#F8FAFC", backgroundColor: "#111827", fontFamily: "BLotus", fontWeight: 700, fontSizeRatio: 18, radius: 8, padding: 18, outlineWidth: 1, outlineColor: "#F59E0B", shadowBlur: 9 },
  { label: "برچسب شیشه‌ای", value: "انتخاب ویژه امروز", color: "#0F172A", backgroundColor: "#FFFFFF", fontFamily: "Vazirmatn", fontWeight: 800, fontSizeRatio: 21, radius: 18, padding: 16, outlineWidth: 0, shadowBlur: 12 },
  { label: "نشان ارسال", value: "ارسال سریع", color: "#FFFFFF", backgroundColor: "#2563EB", fontFamily: "BYekan", fontWeight: 800, fontSizeRatio: 22, radius: 999, padding: 14, outlineWidth: 0, shadowBlur: 5 }
];
const fontRolePresets = [
  { label: "تیتر", sample: "فروش ویژه", detail: "درشت و تبلیغاتی", fontFamily: "BTitrBold", fontWeight: 900, lineHeight: 1.05, letterSpacing: 0, padding: 18, radius: 14, backgroundOpacity: 82 },
  { label: "قیمت", sample: "۲۹۹ تومان", detail: "عدد و پیشنهاد", fontFamily: "BYekan", fontWeight: 800, lineHeight: 1.12, letterSpacing: 0, padding: 16, radius: 16, backgroundOpacity: 92 },
  { label: "کپشن", sample: "ارسال سریع", detail: "متن توضیحی", fontFamily: "BNazanin", fontWeight: 700, lineHeight: 1.38, letterSpacing: 0, padding: 12, radius: 10, backgroundOpacity: 54 },
  { label: "دست‌نویس", sample: "خاص و تازه", detail: "حس انسانی", fontFamily: "BBaran", fontWeight: 700, lineHeight: 1.2, letterSpacing: 1, padding: 14, radius: 18, backgroundOpacity: 68 },
  { label: "لوکس", sample: "کالکشن", detail: "پریمیوم", fontFamily: "BLotus", fontWeight: 700, lineHeight: 1.22, letterSpacing: 2, padding: 16, radius: 8, backgroundOpacity: 64 },
  { label: "خوانا", sample: "جزئیات محصول", detail: "مطمئن و واضح", fontFamily: "Vazirmatn", fontWeight: 800, lineHeight: 1.26, letterSpacing: 0, padding: 14, radius: 12, backgroundOpacity: 72 }
];
const headlineFontValues = new Set(["Lalezar", "BEsfehanBold", "BJadidBold", "BKoodakBold", "BMehrBold", "BNasimBold", "BSetarehBold", "BSinaBold", "BTitrBold", "BTitrTGEBold", "BTraffic", "BYekan"]);
const bodyFontValues = new Set(["Vazirmatn", "BBadr", "BHoma", "BLotus", "BMitra", "BNazanin", "BRoya", "BYekan", "BZar", "Tahoma"]);
const classicFontValues = new Set(["BBadr", "BFerdosi", "BHoma", "BLotus", "BMitra", "BNazanin", "BRoya", "BZar"]);
const decorativeFontValues = new Set(["BBaran", "BDavat", "BFantezy", "BFarnaz", "BHamid", "BHelal", "BMahsa", "BMorvarid", "BShiraz", "BTabassom", "BVahidBold", "BYagut", "BYas", "BZiba"]);
const fontCategoryFilters = [
  { id: "all", label: "همه", test: () => true },
  { id: "headline", label: "تیتر", test: (font: typeof fontOptions[number]) => headlineFontValues.has(font.value) },
  { id: "body", label: "متن", test: (font: typeof fontOptions[number]) => bodyFontValues.has(font.value) },
  { id: "classic", label: "کلاسیک", test: (font: typeof fontOptions[number]) => classicFontValues.has(font.value) },
  { id: "decorative", label: "تزئینی", test: (font: typeof fontOptions[number]) => decorativeFontValues.has(font.value) }
];
const exportFormatOptions: Array<{ id: ExportFormat; label: string; detail: string; mime: string; extension: string }> = [
  { id: "png", label: "PNG", detail: "کیفیت بالا", mime: "image/png", extension: "png" },
  { id: "jpeg", label: "JPG", detail: "حجم کمتر", mime: "image/jpeg", extension: "jpg" },
  { id: "webp", label: "WEBP", detail: "مدرن و سبک", mime: "image/webp", extension: "webp" }
];
const initialAdjustments: ImageAdjustments = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
const initialOverlay: ImageOverlaySettings = { mode: "none", strength: 45 };
const initialCrop: ImageCropSettings = { presetId: "original", scale: 100, offsetX: 0, offsetY: 0, rotation: 0, flipX: false };
const overlayPresets: Array<{ mode: ImageOverlayMode; label: string; detail: string }> = [
  { mode: "none", label: "بدون افکت", detail: "تصویر خام" },
  { mode: "spotlight", label: "اسپات محصول", detail: "تمرکز مرکز" },
  { mode: "vignette", label: "وینیت نرم", detail: "لبه‌های سینمایی" },
  { mode: "darkWash", label: "واش تیره", detail: "خوانایی متن روشن" },
  { mode: "lightWash", label: "واش روشن", detail: "خوانایی متن تیره" },
  { mode: "gradient", label: "گرادیان کمپین", detail: "عمق تبلیغاتی" }
];
const backgroundToolPresets: Array<{ id: string; label: string; detail: string; overlay: ImageOverlaySettings; adjustments: ImageAdjustments }> = [
  { id: "readable", label: "خوانایی متن", detail: "تیره‌سازی امن", overlay: { mode: "darkWash", strength: 58 }, adjustments: { brightness: 96, contrast: 106, saturation: 100, blur: 0 } },
  { id: "product", label: "اسپات محصول", detail: "تمرکز روی مرکز", overlay: { mode: "spotlight", strength: 64 }, adjustments: { brightness: 102, contrast: 108, saturation: 106, blur: 0 } },
  { id: "catalog", label: "کاتالوگ نرم", detail: "روشن و مرتب", overlay: { mode: "lightWash", strength: 36 }, adjustments: { brightness: 108, contrast: 98, saturation: 96, blur: 0 } },
  { id: "sale", label: "کمپین فروش", detail: "رنگ و عمق", overlay: { mode: "gradient", strength: 58 }, adjustments: { brightness: 102, contrast: 110, saturation: 114, blur: 0 } },
  { id: "softBlur", label: "بلور پس‌زمینه", detail: "متن‌محور", overlay: { mode: "vignette", strength: 42 }, adjustments: { brightness: 98, contrast: 102, saturation: 100, blur: 2 } },
  { id: "reset", label: "بازگشت تصویر", detail: "حذف افکت‌ها", overlay: initialOverlay, adjustments: initialAdjustments }
];
const cropPresets: Array<{ id: CropPresetId; label: string; detail: string; width: number; height: number; icon: LucideIcon }> = [
  { id: "original", label: "اصلی", detail: "حفظ نسبت فایل", width: 0, height: 0, icon: Crop },
  { id: "rubika", label: "پست روبیکا", detail: "1080×1080 · محصول/آفر", width: 1080, height: 1080, icon: Square },
  { id: "square", label: "مربع عمومی", detail: "1080×1080 · شبکه‌ها", width: 1080, height: 1080, icon: Square },
  { id: "portrait", label: "پرتره فروش", detail: "1080×1350 · کاتالوگ", width: 1080, height: 1350, icon: RectangleHorizontal },
  { id: "story", label: "استوری", detail: "1080×1920 · تمام‌صفحه", width: 1080, height: 1920, icon: RectangleHorizontal },
  { id: "landscape", label: "بنر افقی", detail: "1200×675 · کمپین", width: 1200, height: 675, icon: RectangleHorizontal }
];
const designRecipes: DesignRecipe[] = [
  {
    id: "flash-offer",
    label: "آفر فوری",
    category: "فروش سریع",
    detail: "تیتر، قیمت، CTA",
    bestFor: "کمپین تخفیف و فروش محدود",
    accent: "#E11D48",
    surface: "#FFF1F2",
    cropPresetId: "rubika" as CropPresetId,
    overlay: { mode: "gradient" as ImageOverlayMode, strength: 58 },
    adjustments: { brightness: 102, contrast: 108, saturation: 112 },
    texts: [
      { presetIndex: 0, x: 0.52, y: 0.2, boxWidth: 0.76 },
      { presetIndex: 1, y: 0.68, boxWidth: 0.6 },
      { presetIndex: 2, y: 0.85, boxWidth: 0.66 }
    ],
    stickers: [{ value: "🔥", x: 0.14, y: 0.16 }]
  },
  {
    id: "luxury-product",
    label: "لوکس محصول",
    category: "برند پریمیوم",
    detail: "وینیت، لیبل لوکس",
    bestFor: "کالکشن، اکسسوری و محصول گران‌تر",
    accent: "#B45309",
    surface: "#FFFBEB",
    cropPresetId: "portrait" as CropPresetId,
    overlay: { mode: "vignette" as ImageOverlayMode, strength: 54 },
    adjustments: { brightness: 98, contrast: 112, saturation: 96 },
    texts: [
      { presetIndex: 5, y: 0.18, boxWidth: 0.68 },
      { presetIndex: 6, y: 0.82, boxWidth: 0.72 }
    ],
    stickers: [{ value: "💎", x: 0.86, y: 0.18 }]
  },
  {
    id: "story-launch",
    label: "استوری لانچ",
    category: "لانچ",
    detail: "تمام‌صفحه، CTA پایین",
    bestFor: "معرفی محصول تازه و خبر فوری",
    accent: "#7C3AED",
    surface: "#F5F3FF",
    cropPresetId: "story" as CropPresetId,
    overlay: { mode: "spotlight" as ImageOverlayMode, strength: 62 },
    adjustments: { brightness: 104, contrast: 104, saturation: 110 },
    texts: [
      { presetIndex: 4, y: 0.16, boxWidth: 0.78 },
      { presetIndex: 3, y: 0.28, boxWidth: 0.7 },
      { presetIndex: 2, y: 0.88, boxWidth: 0.74 }
    ],
    stickers: [{ value: "✨", x: 0.18, y: 0.12 }, { value: "🎁", x: 0.84, y: 0.82 }]
  },
  {
    id: "clean-catalog",
    label: "کاتالوگ تمیز",
    category: "کاتالوگ",
    detail: "خوانا و مینیمال",
    bestFor: "محصولات روزانه و تصویرهای شلوغ",
    accent: "#0F766E",
    surface: "#ECFDF5",
    cropPresetId: "portrait" as CropPresetId,
    overlay: { mode: "lightWash" as ImageOverlayMode, strength: 34 },
    adjustments: { brightness: 106, contrast: 100, saturation: 98 },
    texts: [
      { presetIndex: 6, y: 0.16, boxWidth: 0.74 },
      { presetIndex: 7, y: 0.84, boxWidth: 0.58 }
    ],
    stickers: [{ value: "✅", x: 0.84, y: 0.84 }]
  }
];

function createLayerId() {
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function imageFilter(adjustments: ImageAdjustments) {
  return `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%) blur(${adjustments.blur ?? 0}px)`;
}

function drawImageOverlay(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, overlay: ImageOverlaySettings) {
  if (overlay.mode === "none") return;
  const alpha = Math.max(0, Math.min(100, overlay.strength)) / 100;
  context.save();
  if (overlay.mode === "darkWash") {
    context.fillStyle = `rgba(15, 23, 42, ${0.5 * alpha})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else if (overlay.mode === "lightWash") {
    context.fillStyle = `rgba(255, 255, 255, ${0.45 * alpha})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else if (overlay.mode === "gradient") {
    const gradient = context.createLinearGradient(canvas.width, 0, 0, canvas.height);
    gradient.addColorStop(0, `rgba(37, 99, 235, ${0.34 * alpha})`);
    gradient.addColorStop(0.48, `rgba(15, 23, 42, ${0.08 * alpha})`);
    gradient.addColorStop(1, `rgba(225, 29, 72, ${0.28 * alpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.12, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.62);
    const edgeAlpha = overlay.mode === "spotlight" ? 0.62 * alpha : 0.5 * alpha;
    gradient.addColorStop(0, "rgba(15, 23, 42, 0)");
    gradient.addColorStop(0.58, `rgba(15, 23, 42, ${0.08 * alpha})`);
    gradient.addColorStop(1, `rgba(15, 23, 42, ${edgeAlpha})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.restore();
}

function cloneLayers(layers: EditorLayer[]) {
  return layers.map((layer) => ({ ...layer }));
}

function isHexColor(value: string | null | undefined) {
  return Boolean(value && /^#[0-9A-Fa-f]{6}$/.test(value));
}

function uniqueColors(colors: string[]) {
  return Array.from(new Set(colors.filter(isHexColor).map((color) => color.toUpperCase())));
}

function uniqueStickers(stickers: string[]) {
  return Array.from(new Set(stickers.filter((sticker) => sticker.trim().length > 0)));
}

function readSavedTemplates() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(editorTemplateStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedEditorTemplate => Boolean(item?.id && item?.name && Array.isArray(item?.layers)));
  } catch {
    return [];
  }
}

function writeSavedTemplates(templates: SavedEditorTemplate[]) {
  window.localStorage.setItem(editorTemplateStorageKey, JSON.stringify(templates.slice(0, 18)));
}

function formatTemplateDate(value: string) {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(new Date(value));
  } catch {
    return "بدون تاریخ";
  }
}

function scaleLayerToCanvas(layer: EditorLayer, from: { width: number; height: number }, to: { width: number; height: number }) {
  const scaleX = from.width ? to.width / from.width : 1;
  const scaleY = from.height ? to.height / from.height : 1;
  const scale = Math.min(scaleX, scaleY);
  return {
    ...layer,
    id: createLayerId(),
    x: Math.max(0, Math.min(to.width, layer.x * scaleX)),
    y: Math.max(0, Math.min(to.height, layer.y * scaleY)),
    fontSize: Math.max(18, Math.round(layer.fontSize * scale)),
    boxWidth: Math.max(120, Math.round(layer.boxWidth * scaleX)),
    groupId: undefined
  };
}

function normalizeAngle(angle: number) {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function boundedSourceRect(image: HTMLImageElement, targetSize: { width: number; height: number }, crop: ImageCropSettings) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = targetSize.width / targetSize.height;
  const baseWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
  const baseHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
  const zoom = Math.max(1, crop.scale / 100);
  const width = Math.max(1, Math.min(image.naturalWidth, baseWidth / zoom));
  const height = Math.max(1, Math.min(image.naturalHeight, baseHeight / zoom));
  const maxLeft = Math.max(0, image.naturalWidth - width);
  const maxTop = Math.max(0, image.naturalHeight - height);
  const left = Math.max(0, Math.min(maxLeft, maxLeft / 2 + (crop.offsetX / 100) * (maxLeft / 2)));
  const top = Math.max(0, Math.min(maxTop, maxTop / 2 + (crop.offsetY / 100) * (maxTop / 2)));
  return { left, top, width, height };
}

function originalCanvasSize(image: HTMLImageElement) {
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  return {
    width: Math.max(1, Math.round(image.naturalWidth * scale)),
    height: Math.max(1, Math.round(image.naturalHeight * scale))
  };
}

function layerFont(layer: EditorLayer) {
  const weight = layer.type === "text" ? layer.fontWeight : 700;
  const size = layer.type === "sticker" ? Math.round(layer.fontSize * 1.2) : layer.fontSize;
  const family = layer.type === "sticker" ? "Arial" : layer.fontFamily;
  return `${weight} ${size}px "${family.replace(/"/g, '\\"')}"`;
}

function fontPreviewStyle(fontFamily: string, fontWeight = 400) {
  return {
    direction: "rtl" as const,
    fontFamily: `"${fontFamily}"`,
    fontSynthesis: "none",
    fontWeight
  };
}

async function loadLayerFonts(layers: EditorLayer[]) {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const fontSet = document.fonts as FontFaceSet & {
    load?: (font: string, text?: string) => Promise<FontFace[]>;
    ready?: Promise<FontFaceSet>;
  };
  const fontRequests = Array.from(new Set(
    layers
      .filter((layer) => layer.visible && layer.type === "text")
      .map((layer) => layerFont({ ...layer, fontSize: 32 }))
  ));

  if (typeof fontSet.load === "function") {
    await Promise.all(fontRequests.map((font) => fontSet.load?.(font, "فروش ویژه محصول")));
  }
  if (fontSet.ready) {
    await fontSet.ready;
    return;
  }
  await new Promise((resolve) => window.setTimeout(resolve, 180));
}

function splitTextLines(context: CanvasRenderingContext2D, layer: EditorLayer) {
  if (layer.type !== "text") return [layer.value];
  const maxWidth = Math.max(layer.fontSize * 2, layer.boxWidth - layer.padding * 2);
  const paragraphs = layer.value.split(/\n/);
  const lines: string[] = [];

  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let line = "";
    words.forEach((word) => {
      const nextLine = line ? `${line} ${word}` : word;
      if (line && context.measureText(nextLine).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = nextLine;
      }
    });
    lines.push(line);
  });

  return lines;
}

function roughTextLineCount(layer: EditorLayer) {
  if (layer.type !== "text") return 1;
  const maxChars = Math.max(4, Math.floor((layer.boxWidth - layer.padding * 2) / Math.max(8, layer.fontSize * 0.52)));
  return layer.value.split(/\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / maxChars)), 0);
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + nextRadius, y);
  context.lineTo(x + width - nextRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  context.lineTo(x + width, y + height - nextRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  context.lineTo(x + nextRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  context.lineTo(x, y + nextRadius);
  context.quadraticCurveTo(x, y, x + nextRadius, y);
  context.closePath();
}

function hexToRgba(hex: string, opacity: number) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3 ? normalized.split("").map((item) => item + item).join("") : normalized.padEnd(6, "0").slice(0, 6);
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(100, opacity)) / 100})`;
}

export function MediaImageEditor({ imageUrl, filename, saving = false, onClose, onSave }: MediaImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const artboardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ layerId: string; offsetX: number; offsetY: number } | null>(null);
  const transformRef = useRef<ActiveTransform | null>(null);
  const layerDragRef = useRef<string | null>(null);
  const selectedLayerLiveFrameRef = useRef<number | null>(null);
  const selectedLayerLivePatchRef = useRef<Partial<EditorLayer>>({});
  const selectedLayerLiveEditingRef = useRef(false);
  const canvasLiveEditingRef = useRef(false);
  const [layers, setLayers] = useState<EditorLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState("");
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [draftText, setDraftText] = useState("متن جدید");
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(initialAdjustments);
  const [overlay, setOverlay] = useState<ImageOverlaySettings>(initialOverlay);
  const [crop, setCrop] = useState<ImageCropSettings>(initialCrop);
  const [past, setPast] = useState<EditorSnapshot[]>([]);
  const [future, setFuture] = useState<EditorSnapshot[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [zoom, setZoom] = useState(100);
  const [fitMode, setFitMode] = useState<CanvasFitMode>("fit");
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [guides, setGuides] = useState<CanvasGuides>({ centerX: false, centerY: false });
  const [imageReady, setImageReady] = useState(false);
  const [error, setError] = useState("");
  const [fontSearch, setFontSearch] = useState("");
  const [fontCategory, setFontCategory] = useState("all");
  const [selectedColorDraft, setSelectedColorDraft] = useState("#FFFFFF");
  const [selectedOutlineColorDraft, setSelectedOutlineColorDraft] = useState("#0F172A");
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [recentStickers, setRecentStickers] = useState<string[]>([]);
  const [stickerSearch, setStickerSearch] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedEditorTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [activeDesignRecipeId, setActiveDesignRecipeId] = useState("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [exportNameSuffix, setExportNameSuffix] = useState("edited");

  const selectedLayer = useMemo(() => layers.find((layer) => layer.id === selectedLayerId) ?? null, [layers, selectedLayerId]);
  const selectedBounds = selectedLayer?.visible ? layerBounds(selectedLayer) : null;
  const selectedFontOption = useMemo(() => {
    if (!selectedLayer || selectedLayer.type !== "text") return null;
    return fontOptions.find((font) => font.value === selectedLayer.fontFamily) ?? fontOptions[0];
  }, [selectedLayer]);
  const selectedFontPreviewText = useMemo(() => {
    if (!selectedLayer || selectedLayer.type !== "text") return fontSampleText;
    const normalized = selectedLayer.value.replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, 48) : fontSampleText;
  }, [selectedLayer]);
  const filteredFontOptions = useMemo(() => {
    const query = fontSearch.trim().toLowerCase();
    const activeCategory = fontCategoryFilters.find((filter) => filter.id === fontCategory) ?? fontCategoryFilters[0];
    return fontOptions.filter((font) => {
      const matchesCategory = activeCategory.test(font);
      const matchesQuery = !query || `${font.label} ${font.value}`.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [fontCategory, fontSearch]);
  const activeDesignRecipe = useMemo(() => designRecipes.find((recipe) => recipe.id === activeDesignRecipeId) ?? null, [activeDesignRecipeId]);
  const textColorGroups = useMemo(() => [
    { label: "برند", detail: "از هویت فروشگاه", colors: brandColors },
    { label: "اخیر", detail: "رنگ‌های استفاده‌شده", colors: recentColors },
    { label: "تجاری", detail: "فروش، هشدار و CTA", colors: commerceColorSwatches },
    { label: "خنثی", detail: "متن و پس‌زمینه", colors: neutralColorSwatches }
  ].filter((group) => group.colors.length > 0), [brandColors, recentColors]);
  const activeCropPreset = cropPresets.find((preset) => preset.id === crop.presetId) ?? cropPresets[0];
  const activeOverlayPreset = overlayPresets.find((preset) => preset.mode === overlay.mode) ?? overlayPresets[0];
  const brandKitColors = useMemo(() => uniqueColors([...brandColors, "#2563EB", "#0F766E", "#F59E0B"]).slice(0, 5), [brandColors]);
  const brandPrimaryColor = brandKitColors[0] ?? "#2563EB";
  const brandAccentColor = brandKitColors[1] ?? "#0F766E";
  const activeExportFormat = exportFormatOptions.find((option) => option.id === exportFormat) ?? exportFormatOptions[0];
  const safeExportSuffix = exportNameSuffix.trim().replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "edited";
  const outputBaseName = filename.replace(/\.[^.]+$/, "") || "image";
  const outputFilename = `${outputBaseName}-${safeExportSuffix}.${activeExportFormat.extension}`;
  const filteredStickerPacks = useMemo(() => {
    const query = stickerSearch.trim().toLowerCase();
    if (!query) return stickerPacks;
    return stickerPacks
      .map((pack) => ({
        ...pack,
        stickers: pack.stickers.filter((sticker) => `${pack.label} ${sticker}`.toLowerCase().includes(query))
      }))
      .filter((pack) => pack.stickers.length > 0);
  }, [stickerSearch]);
  const editorWorkflowItems = [
    { label: "تصویر", value: activeCropPreset.label },
    { label: "طراحی", value: activeDesignRecipe?.label ?? "آزاد" },
    { label: "لایه", value: selectedLayer ? selectedLayer.name : "انتخاب نشده" },
    { label: "خروجی", value: `${canvasSize.width}×${canvasSize.height}` }
  ];
  const layerStats = {
    text: layers.filter((layer) => layer.type === "text").length,
    sticker: layers.filter((layer) => layer.type === "sticker").length,
    visible: layers.filter((layer) => layer.visible).length,
    locked: layers.filter((layer) => layer.locked).length
  };
  const layerSummaryItems = [
    { label: "متن", value: layerStats.text },
    { label: "استیکر", value: layerStats.sticker },
    { label: "نمایان", value: layerStats.visible },
    { label: "قفل", value: layerStats.locked }
  ];

  const snapshot = useCallback((): EditorSnapshot => ({
    layers: cloneLayers(layers),
    adjustments: { ...adjustments },
    overlay: { ...overlay },
    crop: { ...crop },
    canvasSize: { ...canvasSize }
  }), [adjustments, canvasSize, crop, layers, overlay]);

  const remember = useCallback(() => {
    setPast((current) => [...current, snapshot()].slice(-80));
    setFuture([]);
  }, [snapshot]);

  useEffect(() => {
    if (!selectedLayer || selectedLayer.type !== "text") return;
    setSelectedColorDraft(selectedLayer.color);
    setSelectedOutlineColorDraft(selectedLayer.outlineColor);
  }, [selectedLayer]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(recentColorStorageKey) ?? "[]");
      if (Array.isArray(parsed)) setRecentColors(uniqueColors(parsed).slice(0, 10));
    } catch {
      setRecentColors([]);
    }
    try {
      const parsed = JSON.parse(window.localStorage.getItem(recentStickerStorageKey) ?? "[]");
      if (Array.isArray(parsed)) setRecentStickers(uniqueStickers(parsed).slice(0, 12));
    } catch {
      setRecentStickers([]);
    }
    setSavedTemplates(readSavedTemplates());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadBrandColors() {
      try {
        const response = await fetch(`${apiUrl}/stores/active`, { headers: authHeaders() });
        if (!response.ok) return;
        const data = await response.json() as StoreBrandColors | null;
        if (cancelled || !data) return;
        setBrandColors(uniqueColors([data.brand_primary_color ?? "", data.brand_accent_color ?? ""]));
      } catch {
        if (!cancelled) setBrandColors([]);
      }
    }
    void loadBrandColors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedLayerLiveFrameRef.current !== null) {
        window.cancelAnimationFrame(selectedLayerLiveFrameRef.current);
      }
    };
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.filter = imageFilter(adjustments);
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((crop.rotation * Math.PI) / 180);
    context.scale(crop.flipX ? -1 : 1, 1);
    const drawWidth = crop.rotation % 180 === 0 ? canvas.width : canvas.height;
    const drawHeight = crop.rotation % 180 === 0 ? canvas.height : canvas.width;
    const source = boundedSourceRect(image, { width: drawWidth, height: drawHeight }, crop);
    context.drawImage(image, source.left, source.top, source.width, source.height, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
    drawImageOverlay(context, canvas, overlay);

    layers.filter((layer) => layer.visible).forEach((layer) => {
      context.save();
      context.translate(layer.x, layer.y);
      context.rotate((layer.rotation * Math.PI) / 180);
      context.globalAlpha = layer.opacity / 100;
      context.textAlign = layer.align;
      context.textBaseline = "middle";
      context.direction = "rtl";
      context.fillStyle = layer.color;
      context.font = layerFont(layer);
      (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = layer.type === "text" ? `${layer.letterSpacing}px` : "0px";
      context.shadowColor = layer.shadowColor;
      context.shadowBlur = layer.shadowBlur;
      context.shadowOffsetY = layer.shadowOffsetY;

      if (layer.type === "text") {
        const lines = splitTextLines(context, layer);
        const lineHeight = layer.fontSize * layer.lineHeight;
        const height = lines.length * lineHeight + layer.padding * 2;
        const backgroundLeft = layer.align === "center" ? -layer.boxWidth / 2 : layer.align === "right" ? -layer.boxWidth : 0;
        if (layer.backgroundOpacity > 0) {
          context.save();
          context.shadowColor = "rgba(15, 23, 42, 0.16)";
          context.shadowBlur = Math.max(4, layer.shadowBlur);
          context.shadowOffsetY = Math.max(2, layer.shadowOffsetY);
          context.fillStyle = hexToRgba(layer.backgroundColor, layer.backgroundOpacity);
          drawRoundedRect(context, backgroundLeft, -height / 2, layer.boxWidth, height, layer.radius);
          context.fill();
          context.restore();
        }

        context.shadowColor = layer.shadowColor;
        context.shadowBlur = layer.shadowBlur;
        context.shadowOffsetY = layer.shadowOffsetY;
        context.fillStyle = layer.color;
        context.strokeStyle = layer.outlineColor;
        context.lineWidth = layer.outlineWidth;
        const textX = layer.align === "center" ? 0 : layer.align === "right" ? -layer.padding : layer.padding;
        lines.forEach((line, index) => {
          const y = -((lines.length - 1) * lineHeight) / 2 + index * lineHeight;
          if (layer.outlineWidth > 0) context.strokeText(line, textX, y);
          context.fillText(line, textX, y);
        });
      } else {
        context.fillText(layer.value, 0, 0);
      }
      context.restore();
    });
  }, [adjustments, crop, layers, overlay]);

  const fitCanvas = useCallback((size: { width: number; height: number }, mode: CanvasFitMode = fitMode) => {
    const viewport = viewportRef.current;
    if (!viewport || !size.width || !size.height) return;
    const availableWidth = Math.max(220, viewport.clientWidth - 64);
    const availableHeight = Math.max(220, viewport.clientHeight - 64);
    const fitZoom = Math.min(100, (availableWidth / size.width) * 100, (availableHeight / size.height) * 100);
    const nextZoom = mode === "actual"
      ? 100
      : mode === "fill"
        ? Math.min(180, (availableWidth / size.width) * 100)
        : fitZoom;
    setZoom(Math.max(20, Math.round(nextZoom)));
  }, [fitMode]);

  function applyFitMode(mode: Exclude<CanvasFitMode, "custom">) {
    setFitMode(mode);
    fitCanvas(canvasSize, mode);
  }

  useEffect(() => {
    setImageReady(false);
    setError("");
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const nextSize = originalCanvasSize(image);
      canvas.width = nextSize.width;
      canvas.height = nextSize.height;
      imageRef.current = image;
      setCanvasSize(nextSize);
      setImageReady(true);
      window.setTimeout(() => fitCanvas(nextSize), 0);
    };
    image.onerror = () => setError("بارگذاری تصویر برای ویرایش ناموفق بود.");
    image.src = imageUrl;
    return () => {
      imageRef.current = null;
    };
  }, [fitCanvas, imageUrl]);

  useEffect(() => {
    if (!imageReady) return;
    let cancelled = false;
    renderCanvas();
    void loadLayerFonts(layers).then(() => {
      if (!cancelled) renderCanvas();
    });
    return () => {
      cancelled = true;
    };
  }, [imageReady, layers, renderCanvas]);

  useEffect(() => {
    if (!imageReady || fitMode === "custom") return;
    const handleResize = () => fitCanvas(canvasSize, fitMode);
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [canvasSize, fitCanvas, fitMode, imageReady]);

  useEffect(() => {
    setSelectedLayerIds((current) => current.filter((id) => layers.some((layer) => layer.id === id)));
    setSelectedLayerId((current) => layers.some((layer) => layer.id === current) ? current : "");
  }, [layers]);

  function canvasPointFromClient(clientX: number, clientY: number) {
    const artboard = artboardRef.current;
    if (!artboard) return { x: 0, y: 0 };
    const bounds = artboard.getBoundingClientRect();
    return {
      x: (clientX - bounds.left) * (canvasSize.width / bounds.width),
      y: (clientY - bounds.top) * (canvasSize.height / bounds.height)
    };
  }

  function canvasPoint(event: PointerEvent<HTMLElement>) {
    return canvasPointFromClient(event.clientX, event.clientY);
  }

  function snapPoint(point: { x: number; y: number }) {
    const threshold = Math.max(8, canvasSize.width * 0.012);
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    const snapX = Math.abs(point.x - centerX) <= threshold;
    const snapY = Math.abs(point.y - centerY) <= threshold;
    setGuides({ centerX: snapX, centerY: snapY });
    return {
      x: Math.max(0, Math.min(canvasSize.width, snapX ? centerX : point.x)),
      y: Math.max(0, Math.min(canvasSize.height, snapY ? centerY : point.y))
    };
  }

  function layerWidth(layer: EditorLayer) {
    if (layer.type === "text") return layer.boxWidth;
    return Math.max(layer.fontSize, layer.value.length * layer.fontSize * 0.8);
  }

  function layerBounds(layer: EditorLayer) {
    const width = layerWidth(layer);
    const height = layer.type === "text" ? roughTextLineCount(layer) * layer.fontSize * layer.lineHeight + layer.padding * 2 : layer.fontSize * 2;
    const left = layer.align === "center" ? layer.x - width / 2 : layer.align === "right" ? layer.x - width : layer.x;
    return { left, top: layer.y - height / 2, width, height };
  }

  function hitLayer(point: { x: number; y: number }) {
    return [...layers].reverse().find((layer) => {
      if (!layer.visible || layer.locked) return false;
      const bounds = layerBounds(layer);
      return point.x >= bounds.left - 16 && point.x <= bounds.left + bounds.width + 16 && point.y >= bounds.top - 16 && point.y <= bounds.top + bounds.height + 16;
    }) ?? null;
  }

  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    const layer = hitLayer(point);
    if (!layer) {
      setSelectedLayerId("");
      setSelectedLayerIds([]);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedLayerId(layer.id);
    setSelectedLayerIds((current) => current.includes(layer.id) ? current : [layer.id]);
    remember();
    dragRef.current = { layerId: layer.id, offsetX: point.x - layer.x, offsetY: point.y - layer.y };
  }

  function dragLayer(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const pointer = canvasPoint(event);
    const point = snapPoint({ x: pointer.x - drag.offsetX, y: pointer.y - drag.offsetY });
    setLayers((current) => current.map((layer) => layer.id === drag.layerId ? { ...layer, x: point.x, y: point.y } : layer));
  }

  function stopDrag() {
    dragRef.current = null;
    setGuides({ centerX: false, centerY: false });
  }

  function startTransform(event: PointerEvent<HTMLButtonElement>, mode: ActiveTransform["mode"]) {
    if (!selectedLayer || selectedLayer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    const deltaX = point.x - selectedLayer.x;
    const deltaY = point.y - selectedLayer.y;
    remember();
    transformRef.current = {
      layerId: selectedLayer.id,
      mode,
      initialFontSize: selectedLayer.fontSize,
      initialRotation: selectedLayer.rotation,
      initialDistance: Math.max(1, Math.hypot(deltaX, deltaY)),
      initialAngle: Math.atan2(deltaY, deltaX)
    };
  }

  function transformLayer(event: PointerEvent<HTMLButtonElement>) {
    const transform = transformRef.current;
    if (!transform) return;
    const layer = layers.find((item) => item.id === transform.layerId);
    if (!layer || layer.locked) return;
    const point = canvasPoint(event);
    const deltaX = point.x - layer.x;
    const deltaY = point.y - layer.y;

    if (transform.mode === "resize") {
      const nextSize = Math.max(20, Math.min(240, Math.round(transform.initialFontSize * (Math.hypot(deltaX, deltaY) / transform.initialDistance))));
      setLayers((current) => current.map((item) => item.id === transform.layerId ? { ...item, fontSize: nextSize } : item));
      return;
    }

    const angle = Math.atan2(deltaY, deltaX);
    const nextRotation = normalizeAngle(transform.initialRotation + ((angle - transform.initialAngle) * 180) / Math.PI);
    setLayers((current) => current.map((item) => item.id === transform.layerId ? { ...item, rotation: Math.round(nextRotation) } : item));
  }

  function stopTransform() {
    transformRef.current = null;
  }

  const restoreSnapshot = useCallback((next: EditorSnapshot) => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = next.canvasSize.width;
      canvas.height = next.canvasSize.height;
    }
    setLayers(cloneLayers(next.layers));
    setAdjustments({ ...next.adjustments });
    setOverlay({ ...next.overlay });
    setCrop({ ...next.crop });
    setCanvasSize({ ...next.canvasSize });
    setSelectedLayerId((current) => next.layers.some((layer) => layer.id === current) ? current : "");
    setSelectedLayerIds((current) => current.filter((id) => next.layers.some((layer) => layer.id === id)));
  }, []);

  const undo = useCallback(() => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((current) => current.slice(0, -1));
    setFuture((current) => [snapshot(), ...current].slice(0, 80));
    restoreSnapshot(previous);
  }, [past, restoreSnapshot, snapshot]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setPast((current) => [...current, snapshot()].slice(-80));
    setFuture((current) => current.slice(1));
    restoreSnapshot(next);
  }, [future, restoreSnapshot, snapshot]);

  function createTextLayer(value = draftText.trim(), preset?: typeof textStylePresets[number]) {
    const canvas = canvasRef.current;
    if (!canvas || !value.trim()) return null;
    return {
      id: createLayerId(),
      type: "text",
      value: value.trim(),
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: preset?.color ?? "#FFFFFF",
      backgroundColor: preset?.backgroundColor ?? "#0F172A",
      backgroundOpacity: preset ? 82 : 0,
      fontFamily: preset?.fontFamily ?? "Vazirmatn",
      fontSize: Math.max(24, Math.round(canvas.width / (preset?.fontSizeRatio ?? 18))),
      fontWeight: preset?.fontWeight ?? 800,
      lineHeight: 1.22,
      letterSpacing: 0,
      boxWidth: Math.max(260, Math.round(canvas.width * 0.68)),
      padding: preset?.padding ?? 14,
      radius: preset?.radius ?? 12,
      outlineColor: preset?.outlineColor ?? "#0F172A",
      outlineWidth: preset?.outlineWidth ?? 0,
      shadowColor: "rgba(15, 23, 42, 0.35)",
      shadowBlur: preset?.shadowBlur ?? 6,
      shadowOffsetY: 3,
      align: "center",
      rotation: 0,
      name: `متن ${layers.filter((item) => item.type === "text").length + 1}`,
      visible: true,
      locked: false,
      opacity: 100
    } satisfies EditorLayer;
  }

  function addText() {
    const layer = createTextLayer();
    if (!layer) return;
    remember();
    setLayers((current) => [...current, layer]);
    setSelectedLayerId(layer.id);
    setSelectedLayerIds([layer.id]);
  }

  function addPresetText(preset: typeof textStylePresets[number]) {
    const layer = createTextLayer(preset.value, preset);
    if (!layer) return;
    remember();
    setLayers((current) => [...current, layer]);
    setSelectedLayerId(layer.id);
    setSelectedLayerIds([layer.id]);
  }

  function addQuickPreset(preset: typeof textStylePresets[number], position: "center" | "bottom" | "top" = "center") {
    const canvas = canvasRef.current;
    const layer = createTextLayer(preset.value, preset);
    if (!layer || !canvas) return;
    const y = position === "top" ? canvas.height * 0.18 : position === "bottom" ? canvas.height * 0.82 : canvas.height / 2;
    remember();
    setLayers((current) => [...current, { ...layer, y }]);
    setSelectedLayerId(layer.id);
    setSelectedLayerIds([layer.id]);
  }

  function addSticker(value: string) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const layer: EditorLayer = {
      id: createLayerId(),
      type: "sticker",
      value,
      x: canvas.width / 2,
      y: canvas.height / 2,
      color: "#FFFFFF",
      backgroundColor: "#0F172A",
      backgroundOpacity: 0,
      fontFamily: "Arial",
      fontSize: Math.max(36, Math.round(canvas.width / 14)),
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: 0,
      boxWidth: Math.max(120, Math.round(canvas.width * 0.24)),
      padding: 0,
      radius: 0,
      outlineColor: "#0F172A",
      outlineWidth: 0,
      shadowColor: "rgba(15, 23, 42, 0.32)",
      shadowBlur: Math.max(2, Math.round(canvas.width / 220)),
      shadowOffsetY: 2,
      align: "center",
      rotation: 0,
      name: `استیکر ${layers.filter((item) => item.type === "sticker").length + 1}`,
      visible: true,
      locked: false,
      opacity: 100
    };
    remember();
    setLayers((current) => [...current, layer]);
    setSelectedLayerId(layer.id);
    setSelectedLayerIds([layer.id]);
    const nextRecentStickers = uniqueStickers([value, ...recentStickers]).slice(0, 12);
    setRecentStickers(nextRecentStickers);
    window.localStorage.setItem(recentStickerStorageKey, JSON.stringify(nextRecentStickers));
  }

  function createStickerLayer(value: string, x: number, y: number, indexOffset = 0): EditorLayer | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return {
      id: createLayerId(),
      type: "sticker",
      value,
      x,
      y,
      color: "#FFFFFF",
      backgroundColor: "#0F172A",
      backgroundOpacity: 0,
      fontFamily: "Arial",
      fontSize: Math.max(36, Math.round(canvas.width / 14)),
      fontWeight: 700,
      lineHeight: 1,
      letterSpacing: 0,
      boxWidth: Math.max(120, Math.round(canvas.width * 0.24)),
      padding: 0,
      radius: 0,
      outlineColor: "#0F172A",
      outlineWidth: 0,
      shadowColor: "rgba(15, 23, 42, 0.32)",
      shadowBlur: Math.max(2, Math.round(canvas.width / 220)),
      shadowOffsetY: 2,
      align: "center",
      rotation: 0,
      name: `استیکر ${layers.filter((item) => item.type === "sticker").length + indexOffset + 1}`,
      visible: true,
      locked: false,
      opacity: 100
    };
  }

  function applyDesignRecipe(recipe: DesignRecipe) {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const preset = cropPresets.find((item) => item.id === recipe.cropPresetId) ?? cropPresets[0];
    const nextSize = preset.id === "original" ? originalCanvasSize(image) : { width: preset.width, height: preset.height };
    remember();
    canvas.width = nextSize.width;
    canvas.height = nextSize.height;
    setCanvasSize(nextSize);
    setCrop((current) => ({ ...current, presetId: preset.id, offsetX: 0, offsetY: 0, scale: 100 }));
    setOverlay(recipe.overlay);
    setAdjustments((current) => ({ ...current, ...recipe.adjustments }));

    const nextTextLayers = recipe.texts
      .map((item, index) => {
        const textPreset = textStylePresets[item.presetIndex];
        const layer = textPreset ? createTextLayer(textPreset.value, textPreset) : null;
        if (!layer) return null;
        const brandPatch = brandColors.length ? {
          color: index === 1 ? "#0F172A" : "#FFFFFF",
          backgroundColor: index === 1 ? "#FFFFFF" : index === 2 ? brandAccentColor : brandPrimaryColor,
          backgroundOpacity: Math.max(layer.backgroundOpacity, index === 1 ? 92 : 76),
          outlineColor: brandPrimaryColor
        } : {};
        return {
          ...layer,
          ...brandPatch,
          x: Math.round(nextSize.width * (item.x ?? 0.5)),
          y: Math.round(nextSize.height * item.y),
          boxWidth: Math.max(220, Math.round(nextSize.width * item.boxWidth)),
          groupId: `recipe-${recipe.id}`
        };
      })
      .filter(Boolean) as EditorLayer[];
    const nextStickerLayers = recipe.stickers
      .map((item, index) => createStickerLayer(item.value, Math.round(nextSize.width * item.x), Math.round(nextSize.height * item.y), index))
      .map((layer) => ({ ...layer, groupId: `recipe-${recipe.id}` }))
      .filter(Boolean) as EditorLayer[];
    const nextLayers = [...nextTextLayers, ...nextStickerLayers];
    setLayers(nextLayers);
    setSelectedLayerIds(nextLayers.map((layer) => layer.id));
    setSelectedLayerId(nextLayers[0]?.id ?? "");
    setActiveDesignRecipeId(recipe.id);
    setFitMode("fit");
    window.setTimeout(() => fitCanvas(nextSize, "fit"), 0);
  }

  function clearAppliedDesignRecipe() {
    if (!activeDesignRecipeId) return;
    remember();
    const recipeGroupId = `recipe-${activeDesignRecipeId}`;
    setLayers((current) => current.filter((layer) => layer.groupId !== recipeGroupId));
    setSelectedLayerIds([]);
    setSelectedLayerId("");
    setActiveDesignRecipeId("");
  }

  function saveCurrentTemplate() {
    if (!layers.length) {
      setError("برای ذخیره قالب، ابتدا حداقل یک لایه اضافه کنید.");
      return;
    }
    const nextTemplate: SavedEditorTemplate = {
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: templateName.trim() || `قالب ${savedTemplates.length + 1}`,
      createdAt: new Date().toISOString(),
      layers: cloneLayers(layers),
      adjustments: { ...adjustments },
      overlay: { ...overlay },
      crop: { ...crop },
      canvasSize: { ...canvasSize },
      brandColors: brandKitColors
    };
    const nextTemplates = [nextTemplate, ...savedTemplates.filter((template) => template.id !== nextTemplate.id)].slice(0, 18);
    writeSavedTemplates(nextTemplates);
    setSavedTemplates(nextTemplates);
    setTemplateName("");
    setError("");
  }

  function applySavedTemplate(template: SavedEditorTemplate) {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const preset = cropPresets.find((item) => item.id === template.crop.presetId);
    const nextSize = preset && preset.id !== "original" ? { width: preset.width, height: preset.height } : originalCanvasSize(image);
    remember();
    canvas.width = nextSize.width;
    canvas.height = nextSize.height;
    setCanvasSize(nextSize);
    setAdjustments({ ...initialAdjustments, ...template.adjustments });
    setOverlay({ ...template.overlay });
    setCrop({ ...template.crop, offsetX: 0, offsetY: 0 });
    const nextLayers = template.layers.map((layer) => scaleLayerToCanvas(layer, template.canvasSize, nextSize));
    setLayers(nextLayers);
    setSelectedLayerIds(nextLayers.map((layer) => layer.id));
    setSelectedLayerId(nextLayers[0]?.id ?? "");
    setActiveDesignRecipeId("");
    setFitMode("fit");
    window.setTimeout(() => fitCanvas(nextSize, "fit"), 0);
  }

  function deleteSavedTemplate(templateId: string) {
    const nextTemplates = savedTemplates.filter((template) => template.id !== templateId);
    writeSavedTemplates(nextTemplates);
    setSavedTemplates(nextTemplates);
  }

  function makeSelectedTitleReadable() {
    if (!selectedLayer || selectedLayer.type !== "text" || selectedLayer.locked) return;
    remember();
    setLayers((current) => current.map((layer) => layer.id === selectedLayer.id ? {
      ...layer,
      color: "#FFFFFF",
      backgroundColor: "#0F172A",
      backgroundOpacity: 78,
      outlineColor: "#0F172A",
      outlineWidth: Math.max(layer.outlineWidth, 1),
      shadowBlur: Math.max(layer.shadowBlur, 10),
      padding: Math.max(layer.padding, 16),
      radius: Math.max(layer.radius, 14)
    } : layer));
  }

  function centerProductSafe() {
    if (!selectedLayerIds.length) return;
    remember();
    setLayers((current) => current.map((layer) => selectedLayerIds.includes(layer.id) && !layer.locked ? { ...layer, x: canvasSize.width / 2, y: canvasSize.height * 0.72 } : layer));
  }

  function addCtaQuickAction() {
    addQuickPreset(textStylePresets[2], "bottom");
  }

  function addPriceQuickAction() {
    addQuickPreset(textStylePresets[1], "top");
  }

  function addProductSpotlight() {
    updateOverlay({ mode: "spotlight", strength: 58 });
  }

  function applyBackgroundTool(preset: typeof backgroundToolPresets[number]) {
    remember();
    setOverlay({ ...preset.overlay });
    setAdjustments({ ...preset.adjustments });
    setError("");
  }

  function addAssetBadge(kind: "watermark" | "delivery" | "trust") {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const config = {
      watermark: { value: "نام فروشگاه", y: 0.12, color: "#FFFFFF", backgroundColor: brandPrimaryColor, opacity: 64, radius: 999 },
      delivery: { value: "ارسال سریع", y: 0.84, color: "#FFFFFF", backgroundColor: brandAccentColor, opacity: 88, radius: 999 },
      trust: { value: "تضمین کیفیت", y: 0.74, color: "#0F172A", backgroundColor: "#FFFFFF", opacity: 92, radius: 14 }
    }[kind];
    const layer = createTextLayer(config.value, {
      label: config.value,
      value: config.value,
      color: config.color,
      backgroundColor: config.backgroundColor,
      fontFamily: "Vazirmatn",
      fontWeight: 900,
      fontSizeRatio: 22,
      radius: config.radius,
      padding: 14,
      outlineWidth: 0,
      shadowBlur: 8
    });
    if (!layer) return;
    remember();
    const nextLayer = {
      ...layer,
      x: canvas.width / 2,
      y: Math.round(canvas.height * config.y),
      backgroundOpacity: config.opacity,
      boxWidth: Math.max(220, Math.round(canvas.width * 0.48)),
      name: kind === "watermark" ? "واترمارک برند" : kind === "delivery" ? "نشان ارسال" : "نشان اعتماد"
    };
    setLayers((current) => [...current, nextLayer]);
    setSelectedLayerId(nextLayer.id);
    setSelectedLayerIds([nextLayer.id]);
  }

  function makeImageReadable() {
    remember();
    setOverlay({ mode: "darkWash", strength: 56 });
    setAdjustments({ brightness: 96, contrast: 108, saturation: 100, blur: 0 });
    setLayers((current) => current.map((layer) => {
      if (layer.locked || layer.type !== "text") return layer;
      return {
        ...layer,
        color: "#FFFFFF",
        backgroundColor: layer.backgroundColor === "#FFFFFF" ? "#0F172A" : layer.backgroundColor,
        backgroundOpacity: Math.max(layer.backgroundOpacity, 68),
        shadowBlur: Math.max(layer.shadowBlur, 10),
        padding: Math.max(layer.padding, 12),
        radius: Math.max(layer.radius, 12)
      };
    }));
  }

  function applyBrandStyle(scope: "selected" | "allText") {
    const targetIds = (scope === "selected" ? layers.filter((layer) => selectedLayerIds.includes(layer.id) && layer.type === "text") : layers.filter((layer) => layer.type === "text")).map((layer) => layer.id);
    if (!targetIds.length) {
      setError(scope === "selected" ? "برای اعمال برند، ابتدا یک لایه متن انتخاب کنید." : "برای اعمال برند، ابتدا یک متن به تصویر اضافه کنید.");
      return;
    }
    remember();
    setLayers((current) => current.map((layer) => {
      if (!targetIds.includes(layer.id) || layer.locked || layer.type !== "text") return layer;
      return {
        ...layer,
        color: "#FFFFFF",
        backgroundColor: brandPrimaryColor,
        backgroundOpacity: Math.max(layer.backgroundOpacity, 78),
        outlineColor: brandAccentColor,
        outlineWidth: Math.max(layer.outlineWidth, 1),
        shadowBlur: Math.max(layer.shadowBlur, 8),
        padding: Math.max(layer.padding, 14),
        radius: Math.max(layer.radius, 12)
      };
    }));
    if (selectedLayer?.type === "text") {
      setSelectedColorDraft("#FFFFFF");
      setSelectedOutlineColorDraft(brandAccentColor);
    }
    setError("");
  }

  function updateSelectedLayer(patch: Partial<EditorLayer>, withHistory = true) {
    if (!selectedLayerId || selectedLayer?.locked) return;
    if (withHistory) remember();
    setLayers((current) => {
      let changed = false;
      const nextLayers = current.map((layer) => {
        if (layer.id !== selectedLayerId) return layer;
        const nextLayer = { ...layer, ...patch };
        changed = Object.keys(patch).some((key) => layer[key as keyof EditorLayer] !== nextLayer[key as keyof EditorLayer]);
        return changed ? nextLayer : layer;
      });
      return changed ? nextLayers : current;
    });
  }

  function beginSelectedLayerLiveEdit() {
    if (!selectedLayerId || selectedLayer?.locked) return;
    if (selectedLayerLiveEditingRef.current) return;
    selectedLayerLiveEditingRef.current = true;
    remember();
    window.setTimeout(() => {
      selectedLayerLiveEditingRef.current = false;
    }, 0);
  }

  function rememberRecentColor(color: string) {
    if (!isHexColor(color)) return;
    setRecentColors((current) => {
      const next = uniqueColors([color, ...current]).slice(0, 10);
      window.localStorage.setItem(recentColorStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function applySelectedLayerColor(field: "color" | "outlineColor" | "backgroundColor", color: string, patch: Partial<EditorLayer> = {}) {
    if (!isHexColor(color)) return;
    const nextColor = color.toUpperCase();
    rememberRecentColor(nextColor);
    updateSelectedLayer({ [field]: nextColor, ...patch } as Partial<EditorLayer>);
  }

  function scheduleSelectedLayerLiveUpdate(patch: Partial<EditorLayer>) {
    if (!selectedLayerId || selectedLayer?.locked) return;
    selectedLayerLivePatchRef.current = { ...selectedLayerLivePatchRef.current, ...patch };
    if (selectedLayerLiveFrameRef.current !== null) return;
    selectedLayerLiveFrameRef.current = window.requestAnimationFrame(() => {
      selectedLayerLiveFrameRef.current = null;
      const nextPatch = selectedLayerLivePatchRef.current;
      selectedLayerLivePatchRef.current = {};
      updateSelectedLayer(nextPatch, false);
    });
  }

  function updateSelectedLayerColorDraft(field: "color" | "outlineColor", value: string) {
    const nextValue = value.toUpperCase();
    if (field === "color") setSelectedColorDraft(nextValue);
    else setSelectedOutlineColorDraft(nextValue);
    if (!/^#[0-9A-Fa-f]{6}$/.test(nextValue)) return;
    scheduleSelectedLayerLiveUpdate({ [field]: nextValue } as Partial<EditorLayer>);
  }

  function commitSelectedLayerColor(field: "color" | "outlineColor", value: string) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;
    const nextValue = value.toUpperCase();
    rememberRecentColor(nextValue);
    updateSelectedLayer({ [field]: nextValue } as Partial<EditorLayer>, false);
  }

  const removeSelectedLayer = useCallback(() => {
    if (!selectedLayerIds.length) return;
    remember();
    setLayers((current) => current.filter((layer) => !selectedLayerIds.includes(layer.id) || layer.locked));
    setSelectedLayerId("");
    setSelectedLayerIds([]);
  }, [remember, selectedLayerIds]);

  const duplicateSelectedLayer = useCallback(() => {
    const selectedLayers = layers.filter((layer) => selectedLayerIds.includes(layer.id));
    if (!selectedLayers.length) return;
    const duplicates = selectedLayers.map((layer) => ({ ...layer, id: createLayerId(), name: `${layer.name} کپی`, x: layer.x + 24, y: layer.y + 24, groupId: undefined }));
    remember();
    setLayers((current) => [...current, ...duplicates]);
    setSelectedLayerId(duplicates[duplicates.length - 1].id);
    setSelectedLayerIds(duplicates.map((layer) => layer.id));
  }, [layers, remember, selectedLayerIds]);

  function duplicateLayer(layerId: string) {
    const layer = layers.find((item) => item.id === layerId);
    if (!layer) return;
    const duplicate = { ...layer, id: createLayerId(), name: `${layer.name} کپی`, x: layer.x + 24, y: layer.y + 24, groupId: undefined };
    remember();
    setLayers((current) => [...current, duplicate]);
    setSelectedLayerId(duplicate.id);
    setSelectedLayerIds([duplicate.id]);
  }

  function removeLayer(layerId: string) {
    const layer = layers.find((item) => item.id === layerId);
    if (!layer || layer.locked) return;
    remember();
    setLayers((current) => current.filter((item) => item.id !== layerId));
    setSelectedLayerIds((current) => current.filter((id) => id !== layerId));
    setSelectedLayerId((current) => current === layerId ? "" : current);
  }

  function resetEditor() {
    if (layers.length || adjustments.brightness !== 100 || adjustments.contrast !== 100 || adjustments.saturation !== 100 || overlay.mode !== initialOverlay.mode || crop.presetId !== initialCrop.presetId || crop.scale !== initialCrop.scale || crop.offsetX !== initialCrop.offsetX || crop.offsetY !== initialCrop.offsetY || crop.rotation !== initialCrop.rotation || crop.flipX !== initialCrop.flipX) remember();
    setLayers([]);
    setSelectedLayerId("");
    setSelectedLayerIds([]);
    setAdjustments(initialAdjustments);
    setOverlay(initialOverlay);
    setCrop(initialCrop);
    setFitMode("fit");
    if (imageRef.current && canvasRef.current) {
      const nextSize = originalCanvasSize(imageRef.current);
      canvasRef.current.width = nextSize.width;
      canvasRef.current.height = nextSize.height;
      setCanvasSize(nextSize);
      window.setTimeout(() => fitCanvas(nextSize), 0);
    }
    setError("");
  }

  function updateAdjustment(field: keyof ImageAdjustments, value: number, withHistory = true) {
    if (withHistory) remember();
    setAdjustments((current) => ({ ...current, [field]: value }));
  }

  function updateOverlay(patch: Partial<ImageOverlaySettings>, withHistory = true) {
    if (withHistory) remember();
    setOverlay((current) => ({ ...current, ...patch }));
  }

  function applyOverlayPreset(mode: ImageOverlayMode) {
    if (overlay.mode === mode && mode === "none") return;
    remember();
    setOverlay((current) => {
      const nextMode = current.mode === mode && mode !== "none" ? "none" : mode;
      return { ...current, mode: nextMode, strength: nextMode === "none" ? current.strength : Math.max(current.strength, 46) };
    });
  }

  function applyCropPreset(presetId: CropPresetId) {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    const preset = cropPresets.find((item) => item.id === presetId);
    if (!preset) return;
    const nextSize = preset.id === "original" ? originalCanvasSize(image) : { width: preset.width, height: preset.height };
    const scaleX = nextSize.width / canvasSize.width;
    const scaleY = nextSize.height / canvasSize.height;
    remember();
    canvas.width = nextSize.width;
    canvas.height = nextSize.height;
    setCanvasSize(nextSize);
    setCrop((current) => ({ ...current, presetId, offsetX: 0, offsetY: 0, scale: 100 }));
    setLayers((current) => current.map((layer) => ({ ...layer, x: layer.x * scaleX, y: layer.y * scaleY, fontSize: Math.max(20, Math.round(layer.fontSize * Math.min(scaleX, scaleY))) })));
    window.setTimeout(() => fitCanvas(nextSize), 0);
  }

  function updateCrop(patch: Partial<ImageCropSettings>, withHistory = true) {
    if (withHistory) remember();
    setCrop((current) => ({ ...current, ...patch }));
  }

  function beginCanvasLiveEdit() {
    if (canvasLiveEditingRef.current) return;
    canvasLiveEditingRef.current = true;
    remember();
    window.setTimeout(() => {
      canvasLiveEditingRef.current = false;
    }, 0);
  }

  function rotateImage() {
    updateCrop({ rotation: normalizeAngle(crop.rotation + 90) });
  }

  function selectLayer(layerId: string, additive = false) {
    setSelectedLayerId(layerId);
    setSelectedLayerIds((current) => {
      if (!additive) return [layerId];
      return current.includes(layerId) ? current.filter((id) => id !== layerId) : [...current, layerId];
    });
  }

  function updateLayer(layerId: string, patch: Partial<EditorLayer>, withHistory = true) {
    const layer = layers.find((item) => item.id === layerId);
    if (!layer) return;
    if (withHistory) remember();
    setLayers((current) => current.map((item) => item.id === layerId ? { ...item, ...patch } : item));
  }

  function moveLayer(layerId: string, direction: "up" | "down") {
    const index = layers.findIndex((layer) => layer.id === layerId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= layers.length) return;
    remember();
    setLayers((current) => {
      const next = [...current];
      const [layer] = next.splice(index, 1);
      next.splice(nextIndex, 0, layer);
      return next;
    });
  }

  function reorderLayer(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const sourceIndex = layers.findIndex((layer) => layer.id === sourceId);
    const targetIndex = layers.findIndex((layer) => layer.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    remember();
    setLayers((current) => {
      const next = [...current];
      const [layer] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, layer);
      return next;
    });
  }

  function alignSelected(mode: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") {
    if (!selectedLayerIds.length) return;
    const selected = layers.filter((layer) => selectedLayerIds.includes(layer.id) && !layer.locked);
    if (!selected.length) return;
    remember();
    setLayers((current) => current.map((layer) => {
      if (!selectedLayerIds.includes(layer.id) || layer.locked) return layer;
      const bounds = layerBounds(layer);
      if (mode === "left") return { ...layer, x: layer.x - bounds.left };
      if (mode === "centerX") return { ...layer, x: canvasSize.width / 2 };
      if (mode === "right") return { ...layer, x: layer.x + (canvasSize.width - (bounds.left + bounds.width)) };
      if (mode === "top") return { ...layer, y: layer.y - bounds.top };
      if (mode === "centerY") return { ...layer, y: canvasSize.height / 2 };
      return { ...layer, y: layer.y + (canvasSize.height - (bounds.top + bounds.height)) };
    }));
  }

  function groupSelected() {
    if (selectedLayerIds.length < 2) return;
    const groupId = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    remember();
    setLayers((current) => current.map((layer) => selectedLayerIds.includes(layer.id) ? { ...layer, groupId } : layer));
  }

  function ungroupSelected() {
    if (!selectedLayerIds.length) return;
    remember();
    setLayers((current) => current.map((layer) => selectedLayerIds.includes(layer.id) ? { ...layer, groupId: undefined } : layer));
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      const commandKey = event.ctrlKey || event.metaKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelectedLayer();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedLayerIds.length) {
        event.preventDefault();
        removeSelectedLayer();
        return;
      }
      if (!selectedLayer || selectedLayer.locked || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const distance = event.shiftKey ? 10 : 1;
      const patch = {
        x: selectedLayer.x + (event.key === "ArrowRight" ? distance : event.key === "ArrowLeft" ? -distance : 0),
        y: selectedLayer.y + (event.key === "ArrowDown" ? distance : event.key === "ArrowUp" ? -distance : 0)
      };
      remember();
      setLayers((current) => current.map((layer) => layer.id === selectedLayer.id ? { ...layer, x: Math.max(0, Math.min(canvasSize.width, patch.x)), y: Math.max(0, Math.min(canvasSize.height, patch.y)) } : layer));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canvasSize.height, canvasSize.width, duplicateSelectedLayer, redo, remember, removeSelectedLayer, selectedLayer, selectedLayerIds.length, undo]);

  async function saveEditedImage() {
    const canvas = canvasRef.current;
    if (!canvas || !imageReady) return;
    setError("");
    await loadLayerFonts(layers);
    renderCanvas();
    const quality = exportFormat === "png" ? undefined : exportQuality / 100;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, activeExportFormat.mime, quality));
    if (!blob) {
      setError("ساخت خروجی تصویر ناموفق بود.");
      return;
    }
    await onSave(new File([blob], outputFilename, { type: activeExportFormat.mime }));
  }

  return createPortal((
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true" aria-label="ویرایشگر تصویر">
      <div aria-hidden="true" className="pointer-events-none fixed -top-96 h-0 w-0 overflow-hidden opacity-0">
        {fontOptions.map((font) => (
          <span key={font.value} style={fontPreviewStyle(font.value, font.value.includes("Bold") ? 700 : 400)}>
            {fontSampleText}
          </span>
        ))}
      </div>
      <section className="flex h-[97vh] w-full max-w-[1580px] flex-col overflow-hidden rounded-xl border border-white/70 bg-app-canvas shadow-2xl ring-1 ring-slate-900/10">
        <header className="border-b border-app-border bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black text-app-primary">Creative Studio</p>
              <h2 className="mt-1 truncate text-lg font-black text-app-text">ویرایش تصویر حرفه‌ای</h2>
              <p className="mt-1 truncate text-xs text-app-muted">{filename} · خروجی جدید ذخیره می‌شود و فایل اصلی دست‌نخورده می‌ماند.</p>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4 xl:min-w-[520px]">
              {editorWorkflowItems.map((item) => (
                <div key={item.label} className="min-w-0 rounded-md border border-app-border bg-app-surfaceMuted px-3 py-2 shadow-hairline">
                  <span className="block text-[9px] font-black text-app-muted">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-black text-app-text">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
            <StatusToken tone={layers.length ? "primary" : "neutral"}>{layers.length} لایه</StatusToken>
            <StatusToken tone="neutral">{canvasSize.width}×{canvasSize.height}</StatusToken>
            <button type="button" onClick={undo} disabled={!past.length} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-white text-slate-600 shadow-hairline hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="بازگشت" title="بازگشت (Ctrl+Z)">
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={redo} disabled={!future.length} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md border border-app-border bg-white text-slate-600 shadow-hairline hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="انجام دوباره" title="انجام دوباره (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setShowSafeZone((current) => !current)} className={`app-interactive flex h-8 w-8 items-center justify-center rounded-md border shadow-hairline ${showSafeZone ? "border-blue-200 bg-blue-50 text-app-primary" : "border-app-border bg-white text-slate-600 hover:bg-blue-50 hover:text-app-primary"}`} aria-label="نمایش محدوده امن" title="محدوده امن روبیکا">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={resetEditor}>
              <RotateCcw className="ml-1.5 h-4 w-4" aria-hidden="true" />
              بازنشانی
            </Button>
            <Button type="button" size="sm" disabled={!imageReady || saving} onClick={() => void saveEditedImage()}>
              <Save className="ml-1.5 h-4 w-4" aria-hidden="true" />
              {saving ? "در حال ذخیره" : `ذخیره ${activeExportFormat.label}`}
            </Button>
            <button type="button" onClick={onClose} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-app-text" aria-label="بستن ویرایشگر" title="بستن ویرایشگر">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 overflow-hidden bg-app-canvas max-lg:grid-rows-[minmax(340px,1fr)_minmax(220px,30vh)_minmax(220px,30vh)] lg:grid-cols-[286px_minmax(420px,1fr)_340px]">
          <aside className="min-h-0 space-y-4 overflow-y-auto border-b border-app-border bg-app-surfaceMuted p-4 max-lg:order-2 lg:border-b-0 lg:border-l">
            <nav className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-app-border bg-app-surfaceMuted/95 px-4 py-3 backdrop-blur" aria-label="ابزارهای ویرایشگر">
              <div className="grid grid-cols-6 gap-1">
                {[
                  { href: "#editor-crop", label: "تصویر", icon: Crop },
                  { href: "#editor-text", label: "متن", icon: Type },
                  { href: "#editor-recipes", label: "قالب", icon: Layers3 },
                  { href: "#editor-brand", label: "برند", icon: Palette },
                  { href: "#editor-export", label: "خروجی", icon: Save },
                  { href: "#editor-effects", label: "افکت", icon: Palette }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <a key={item.href} href={item.href} className="app-interactive flex flex-col items-center justify-center gap-1 rounded-md border border-app-border bg-white px-1.5 py-2 text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {item.label}
                    </a>
                  );
                })}
              </div>
            </nav>

            <section id="editor-crop" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <Crop className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">کراپ و خروجی</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cropPresets.map((preset) => {
                  const Icon = preset.icon;
                  const active = crop.presetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyCropPreset(preset.id)}
                      className={`app-interactive rounded-md border p-2 text-right shadow-hairline ${active ? "border-blue-300 bg-blue-50 text-app-primary ring-1 ring-blue-200" : "border-app-border bg-white text-app-text hover:bg-slate-50"}`}
                    >
                      <span className="flex items-center gap-2 text-xs font-black">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {preset.label}
                      </span>
                      <span className="mt-1 block text-[10px] font-bold text-app-muted">{preset.detail}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 rounded-md bg-app-surfaceMuted p-3 shadow-hairline">
                <label className="block text-xs font-bold text-app-muted">
                  بزرگ‌نمایی تصویر · {crop.scale}%
                  <input type="range" min="100" max="220" value={crop.scale} onPointerDown={beginCanvasLiveEdit} onFocus={beginCanvasLiveEdit} onChange={(event) => updateCrop({ scale: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600" />
                </label>
                <label className="mt-3 block text-xs font-bold text-app-muted">
                  جابه‌جایی افقی · {crop.offsetX}
                  <input type="range" min="-100" max="100" value={crop.offsetX} onPointerDown={beginCanvasLiveEdit} onFocus={beginCanvasLiveEdit} onChange={(event) => updateCrop({ offsetX: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600" />
                </label>
                <label className="mt-3 block text-xs font-bold text-app-muted">
                  جابه‌جایی عمودی · {crop.offsetY}
                  <input type="range" min="-100" max="100" value={crop.offsetY} onPointerDown={beginCanvasLiveEdit} onFocus={beginCanvasLiveEdit} onChange={(event) => updateCrop({ offsetY: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600" />
                </label>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={rotateImage}>
                    <RotateCw className="ml-1.5 h-4 w-4" aria-hidden="true" />
                    چرخش ۹۰°
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => updateCrop({ flipX: !crop.flipX })}>
                    <FlipHorizontal className="ml-1.5 h-4 w-4" aria-hidden="true" />
                    قرینه
                  </Button>
                </div>
              </div>
            </section>

            <section id="editor-text" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">متن فارسی</h3>
              </div>
              <textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} className="mt-3 min-h-20 w-full resize-y rounded-md border border-app-border bg-app-canvas px-3 py-2 text-sm leading-6 text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" dir="rtl" />
              <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={addText}>
                <ImagePlus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                افزودن متن
              </Button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {textStylePresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => addPresetText(preset)}
                    className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </section>

            <section id="editor-recipes" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-black text-app-text">ترکیب آماده</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-app-muted">قالب‌های سریع برای چیدمان حرفه‌ای تصویر</p>
                  </div>
                </div>
                {activeDesignRecipe ? (
                  <button
                    type="button"
                    onClick={clearAppliedDesignRecipe}
                    className="app-interactive rounded-md border border-app-border bg-white px-2 py-1 text-[10px] font-black text-app-muted shadow-hairline hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    حذف ترکیب
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {designRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => applyDesignRecipe(recipe)}
                    className={`app-interactive w-full rounded-md border bg-white p-2 text-right shadow-hairline transition hover:-translate-y-0.5 hover:shadow-soft ${
                      activeDesignRecipeId === recipe.id ? "border-blue-300 ring-2 ring-blue-100" : "border-app-border hover:border-blue-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white shadow-hairline"
                        style={{ background: `linear-gradient(135deg, ${recipe.surface}, #ffffff 58%, ${recipe.accent}22)` }}
                        aria-hidden="true"
                      >
                        <span className="absolute inset-x-2 top-2 h-2 rounded-full" style={{ backgroundColor: recipe.accent }} />
                        <span className="absolute right-2 top-5 h-3 w-8 rounded-full bg-white/90" />
                        <span className="absolute bottom-2 left-2 h-3 w-7 rounded-full" style={{ backgroundColor: recipe.accent }} />
                        {recipe.stickers.slice(0, 1).map((sticker) => (
                          <span key={sticker.value} className="absolute left-1 top-1 text-sm leading-none">{sticker.value}</span>
                        ))}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-black text-app-text">{recipe.label}</span>
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black" style={{ backgroundColor: recipe.surface, color: recipe.accent }}>
                            {recipe.category}
                          </span>
                        </span>
                        <span className="mt-1 block text-[10px] font-bold leading-5 text-app-muted">{recipe.bestFor}</span>
                        <span className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-full bg-app-surfaceMuted px-2 py-0.5 text-[9px] font-black text-app-muted">{recipe.detail}</span>
                          <span className="rounded-full bg-app-surfaceMuted px-2 py-0.5 text-[9px] font-black text-app-muted">{recipe.texts.length + recipe.stickers.length} لایه</span>
                          <span className="rounded-full bg-app-surfaceMuted px-2 py-0.5 text-[9px] font-black text-app-muted">{cropPresets.find((preset) => preset.id === recipe.cropPresetId)?.label ?? "قالب"}</span>
                        </span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {activeDesignRecipe ? (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-bold leading-5 text-blue-900">
                  ترکیب «{activeDesignRecipe.label}» فعال است. برای تغییر متن‌ها، هر لایه را از روی تصویر یا لیست لایه‌ها انتخاب کن.
                </div>
              ) : null}
            </section>

            <section id="editor-brand" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-black text-app-text">کیت برند</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-app-muted">رنگ و تایپوگرافی فروشگاه برای طراحی سریع</p>
                  </div>
                </div>
                <span className="rounded-full bg-app-surfaceMuted px-2 py-1 text-[10px] font-black text-app-muted">
                  {brandColors.length ? "فروشگاه" : "پیش‌فرض"}
                </span>
              </div>
              <div className="mt-3 rounded-md border border-app-border bg-app-surfaceMuted p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white shadow-hairline" style={{ background: `linear-gradient(135deg, ${brandPrimaryColor}, ${brandAccentColor})` }}>
                    BR
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-app-text">هویت بصری فروشگاه</p>
                    <p className="mt-1 text-[10px] font-bold text-app-muted">لوگو هنوز فایل جدا ندارد؛ رنگ‌ها از پروفایل فروشگاه خوانده می‌شوند.</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  {brandKitColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => selectedLayer?.type === "text" ? applySelectedLayerColor("backgroundColor", color, { backgroundOpacity: Math.max(selectedLayer.backgroundOpacity, 78), color: "#FFFFFF" }) : null}
                      className="aspect-square rounded-md border border-white shadow-hairline ring-1 ring-app-border"
                      style={{ backgroundColor: color }}
                      aria-label={`رنگ برند ${color}`}
                      title={color}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => applyBrandStyle("selected")} disabled={!selectedLayerIds.length} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-45">
                  اعمال روی انتخاب
                </button>
                <button type="button" onClick={() => applyBrandStyle("allText")} disabled={!layerStats.text} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-45">
                  اعمال روی همه متن‌ها
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-app-surfaceMuted px-3 py-2">
                  <span className="block text-[9px] font-black text-app-muted">فونت تیتر</span>
                  <span className="mt-0.5 block text-[11px] font-black text-app-text">B Titr Bold</span>
                </div>
                <div className="rounded-md bg-app-surfaceMuted px-3 py-2">
                  <span className="block text-[9px] font-black text-app-muted">فونت خوانا</span>
                  <span className="mt-0.5 block text-[11px] font-black text-app-text">Vazirmatn</span>
                </div>
              </div>
            </section>

            <section id="editor-export" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-black text-app-text">خروجی و نسخه</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-app-muted">کنترل فرمت، کیفیت و نام فایل ذخیره‌شده</p>
                  </div>
                </div>
                <span className="rounded-full bg-app-surfaceMuted px-2 py-1 text-[10px] font-black text-app-muted">{activeExportFormat.label}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {exportFormatOptions.map((option) => {
                  const active = exportFormat === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setExportFormat(option.id)}
                      className={`app-interactive rounded-md border px-2 py-2 text-right shadow-hairline ${active ? "border-blue-300 bg-blue-50 text-app-primary ring-1 ring-blue-100" : "border-app-border bg-white text-app-text hover:bg-app-surfaceMuted"}`}
                    >
                      <span className="block text-[11px] font-black">{option.label}</span>
                      <span className="mt-0.5 block text-[9px] font-bold text-app-muted">{option.detail}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block text-xs font-bold text-app-muted">
                پسوند نام نسخه
                <input
                  value={exportNameSuffix}
                  onChange={(event) => setExportNameSuffix(event.target.value)}
                  className="mt-2 h-9 w-full rounded-md border border-app-border bg-app-canvas px-3 text-xs font-bold text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  dir="ltr"
                />
              </label>
              <label className={`mt-3 block text-xs font-bold text-app-muted ${exportFormat === "png" ? "opacity-50" : ""}`}>
                کیفیت فایل · {exportFormat === "png" ? "بدون فشرده‌سازی" : `${exportQuality}%`}
                <input
                  type="range"
                  min="60"
                  max="100"
                  value={exportQuality}
                  disabled={exportFormat === "png"}
                  onChange={(event) => setExportQuality(Number(event.target.value))}
                  className="mt-2 w-full accent-blue-600 disabled:opacity-50"
                />
              </label>
              <div className="mt-3 rounded-md border border-app-border bg-app-surfaceMuted px-3 py-2">
                <span className="block text-[9px] font-black text-app-muted">نام خروجی</span>
                <span className="mt-1 block break-all text-[11px] font-black text-app-text" dir="ltr">{outputFilename}</span>
              </div>
            </section>

            <section id="editor-templates" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <Save className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">قالب‌های من</h3>
              </div>
              <div className="mt-3 rounded-md border border-app-border bg-white p-2 shadow-hairline">
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="نام قالب..."
                  className="h-9 w-full rounded-md border border-app-border bg-app-canvas px-2 text-xs font-bold text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <Button type="button" variant="secondary" size="sm" className="mt-2 w-full" onClick={saveCurrentTemplate} disabled={!layers.length}>
                  <Save className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  ذخیره قالب فعلی
                </Button>
              </div>
              <div className="mt-3 space-y-2">
                {savedTemplates.map((template) => (
                  <div key={template.id} className="rounded-md border border-app-border bg-white p-2 shadow-hairline">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => applySavedTemplate(template)} className="min-w-0 flex-1 text-right">
                        <span className="block truncate text-[11px] font-black text-app-text">{template.name}</span>
                        <span className="mt-0.5 block text-[10px] font-bold text-app-muted">{template.layers.length} لایه · {template.crop.presetId} · {formatTemplateDate(template.createdAt)}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          <span className="rounded bg-app-surfaceMuted px-1.5 py-0.5 text-[9px] font-black text-app-muted">{template.canvasSize.width}×{template.canvasSize.height}</span>
                          <span className="rounded bg-app-surfaceMuted px-1.5 py-0.5 text-[9px] font-black text-app-muted">{template.brandColors?.length ?? 0} رنگ برند</span>
                        </span>
                      </button>
                    <button type="button" onClick={() => deleteSavedTemplate(template.id)} className="app-interactive nashrino-control-radius flex h-8 w-8 shrink-0 items-center justify-center bg-app-surfaceMuted text-slate-600 hover:bg-rose-50 hover:text-rose-700" aria-label="حذف قالب" title="حذف قالب">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
                {!savedTemplates.length ? (
                  <p className="rounded-md border border-dashed border-app-border bg-app-surfaceMuted px-3 py-3 text-center text-[11px] font-bold text-app-muted">
                    هنوز قالب ذخیره‌شده‌ای ندارید.
                  </p>
                ) : null}
              </div>
            </section>

            <section id="editor-actions" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">اقدام سریع</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={addCtaQuickAction} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  افزودن CTA
                </button>
                <button type="button" onClick={addPriceQuickAction} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  برچسب قیمت
                </button>
                <button type="button" onClick={makeSelectedTitleReadable} disabled={!selectedLayer || selectedLayer.type !== "text" || selectedLayer.locked} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-45">
                  خوانا کردن تیتر
                </button>
                <button type="button" onClick={centerProductSafe} disabled={!selectedLayerIds.length} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-45">
                  چیدمان امن
                </button>
                <button type="button" onClick={addProductSpotlight} className="app-interactive col-span-2 rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  اسپات محصول روی تصویر
                </button>
              </div>
            </section>

            <section id="editor-background-tools" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-black text-app-text">پس‌زمینه و دارایی</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-app-muted">ابزارهای سریع برای خوانایی، محصول و نشان‌های فروش</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {backgroundToolPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyBackgroundTool(preset)}
                    className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary"
                  >
                    <span className="block text-[11px] font-black text-app-text">{preset.label}</span>
                    <span className="mt-0.5 block text-[9px] font-bold text-app-muted">{preset.detail}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => addAssetBadge("watermark")} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-center text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  واترمارک
                </button>
                <button type="button" onClick={() => addAssetBadge("delivery")} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-center text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  ارسال
                </button>
                <button type="button" onClick={() => addAssetBadge("trust")} className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-center text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary">
                  اعتماد
                </button>
              </div>
              <button type="button" onClick={makeImageReadable} className="app-interactive mt-3 w-full rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-right text-[11px] font-black text-app-primary shadow-hairline hover:bg-blue-100">
                یک‌کلیک خواناسازی تصویر و متن
              </button>
            </section>

            <section id="editor-stickers" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SmilePlus className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-black text-app-text">استیکر و ایموجی</h3>
                    <p className="mt-0.5 text-[10px] font-bold text-app-muted">نمادهای سریع برای کمپین و فروش</p>
                  </div>
                </div>
                <span className="rounded-full bg-app-surfaceMuted px-2 py-1 text-[10px] font-black text-app-muted">
                  {stickerPacks.reduce((count, pack) => count + pack.stickers.length, 0)}
                </span>
              </div>
              <label className="mt-3 block">
                <span className="sr-only">جست‌وجوی استیکر</span>
                <input
                  value={stickerSearch}
                  onChange={(event) => setStickerSearch(event.target.value)}
                  placeholder="جست‌وجو در دسته‌ها..."
                  className="h-9 w-full rounded-md border border-app-border bg-app-canvas px-3 text-xs font-bold text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              {recentStickers.length ? (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50/70 p-2 shadow-hairline">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black text-app-primary">اخیراً استفاده‌شده</p>
                    <button type="button" onClick={() => { setRecentStickers([]); window.localStorage.removeItem(recentStickerStorageKey); }} className="app-interactive rounded px-1.5 py-0.5 text-[9px] font-black text-app-muted hover:bg-white hover:text-rose-700">
                      پاک‌کردن
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1.5">
                    {recentStickers.map((sticker) => (
                      <button key={`recent-${sticker}`} type="button" onClick={() => addSticker(sticker)} className="app-interactive flex aspect-square items-center justify-center rounded-md bg-white text-lg shadow-hairline hover:bg-blue-100" title={`افزودن ${sticker}`}>
                        {sticker}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 space-y-3">
                {filteredStickerPacks.map((pack) => (
                  <div key={pack.label} className="rounded-md border border-app-border bg-white p-2 shadow-hairline">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black text-app-muted">{pack.label}</p>
                      <span className="rounded bg-app-surfaceMuted px-1.5 py-0.5 text-[9px] font-black text-app-muted">{pack.stickers.length}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {pack.stickers.map((sticker) => (
                        <button key={`${pack.label}-${sticker}`} type="button" onClick={() => addSticker(sticker)} className="app-interactive flex aspect-square items-center justify-center rounded-md bg-app-surfaceMuted text-lg hover:bg-blue-50" title={`افزودن ${sticker}`}>
                          {sticker}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {!filteredStickerPacks.length ? (
                  <p className="rounded-md border border-dashed border-app-border bg-app-surfaceMuted px-3 py-3 text-center text-[11px] font-bold text-app-muted">
                    استیکری با این جست‌وجو پیدا نشد.
                  </p>
                ) : null}
              </div>
            </section>

            <section id="editor-tuning" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">تنظیم تصویر</h3>
              </div>
              {(["brightness", "contrast", "saturation", "blur"] as const).map((field) => (
                <label key={field} className="mt-3 block text-xs font-bold text-app-muted">
                  {field === "brightness" ? "روشنایی" : field === "contrast" ? "کنتراست" : field === "saturation" ? "اشباع رنگ" : "بلور"} · {field === "blur" ? `${adjustments[field]}px` : `${adjustments[field]}%`}
                  <input type="range" min={field === "blur" ? 0 : 50} max={field === "blur" ? 8 : 150} value={adjustments[field]} onPointerDown={beginCanvasLiveEdit} onFocus={beginCanvasLiveEdit} onChange={(event) => updateAdjustment(field, Number(event.target.value), false)} className="mt-2 w-full accent-blue-600" />
                </label>
              ))}
            </section>

            <section id="editor-effects" className="scroll-mt-24 rounded-md border border-app-border bg-white p-3 shadow-hairline">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-app-primary" aria-hidden="true" />
                <h3 className="text-xs font-black text-app-text">افکت پس‌زمینه</h3>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {overlayPresets.map((preset) => {
                  const active = overlay.mode === preset.mode;
                  return (
                    <button
                      key={preset.mode}
                      type="button"
                      onClick={() => applyOverlayPreset(preset.mode)}
                      className={`app-interactive rounded-md border p-2 text-right shadow-hairline ${active ? "border-blue-300 bg-blue-50 text-app-primary ring-1 ring-blue-200" : "border-app-border bg-white text-app-text hover:bg-slate-50"}`}
                    >
                      <span className="block text-[11px] font-black">{preset.label}</span>
                      <span className="mt-1 block text-[10px] font-bold text-app-muted">{preset.detail}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block rounded-md bg-app-surfaceMuted p-3 text-xs font-bold text-app-muted shadow-hairline">
                شدت افکت · {overlay.strength}%
                <input type="range" min="10" max="90" value={overlay.strength} disabled={overlay.mode === "none"} onPointerDown={beginCanvasLiveEdit} onFocus={beginCanvasLiveEdit} onChange={(event) => updateOverlay({ strength: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-50" />
              </label>
            </section>
          </aside>

          <div ref={viewportRef} className="app-studio-grid relative flex min-h-[340px] min-w-0 items-center justify-center overflow-auto bg-[#eef2f7] p-4 max-lg:order-1 lg:min-h-[520px] lg:p-8">
            {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
            <div className="absolute inset-x-4 top-4 z-10 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/80 bg-white/90 px-3 py-2 shadow-soft backdrop-blur lg:inset-x-8">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-app-primary">بوم طراحی</p>
                <p className="mt-0.5 truncate text-[11px] font-bold text-app-muted">{activeDesignRecipe?.bestFor ?? "چیدمان آزاد تصویر، متن و استیکر"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-app-surfaceMuted px-2 py-1 text-[10px] font-black text-app-text">{activeCropPreset.label}</span>
                <span className={`rounded px-2 py-1 text-[10px] font-black ${overlay.mode === "none" ? "bg-app-surfaceMuted text-app-muted" : "bg-blue-50 text-app-primary"}`}>{activeOverlayPreset.label}</span>
                <span className="rounded bg-app-surfaceMuted px-2 py-1 text-[10px] font-black text-app-muted">{zoom}%</span>
              </div>
            </div>
            <div
              ref={artboardRef}
              className={`relative shrink-0 overflow-visible rounded-lg bg-white shadow-2xl ring-1 ring-slate-900/10 ${imageReady ? "" : "hidden"}`}
              style={{ width: `${Math.round((canvasSize.width * zoom) / 100)}px`, height: `${Math.round((canvasSize.height * zoom) / 100)}px` }}
            >
              <canvas
                ref={canvasRef}
                onPointerDown={startDrag}
                onPointerMove={dragLayer}
                onPointerUp={stopDrag}
                onPointerCancel={stopDrag}
                className="h-full w-full cursor-move rounded-lg"
              />
              {showSafeZone ? (
                <div className="pointer-events-none absolute inset-[8%] rounded border border-dashed border-emerald-400/90">
                  <span className="absolute right-2 top-2 rounded bg-emerald-500/90 px-1.5 py-1 text-[10px] font-black leading-none text-white">محدوده امن روبیکا</span>
                </div>
              ) : null}
              {guides.centerX ? <span className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-blue-500" /> : null}
              {guides.centerY ? <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-blue-500" /> : null}
              {selectedLayer && selectedBounds ? (
                <div
                  className="pointer-events-none absolute border border-blue-500"
                  style={{
                    left: `${(selectedBounds.left / canvasSize.width) * 100}%`,
                    top: `${(selectedBounds.top / canvasSize.height) * 100}%`,
                    width: `${(selectedBounds.width / canvasSize.width) * 100}%`,
                    height: `${(selectedBounds.height / canvasSize.height) * 100}%`,
                    transform: `rotate(${selectedLayer.rotation}deg)`
                  }}
                >
                  {["-left-1.5 -top-1.5", "-right-1.5 -top-1.5", "-bottom-1.5 -left-1.5"].map((position) => (
                    <span key={position} className={`absolute h-3 w-3 rounded-sm border border-blue-600 bg-white ${position}`} />
                  ))}
                  <button
                    type="button"
                    onPointerDown={(event) => startTransform(event, "resize")}
                    onPointerMove={transformLayer}
                    onPointerUp={stopTransform}
                    onPointerCancel={stopTransform}
                    className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-sm border border-blue-600 bg-white shadow-sm"
                    aria-label="تغییر اندازه لایه"
                    title="برای تغییر اندازه بکشید"
                  />
                  <span className="absolute -top-8 left-1/2 h-8 border-l border-blue-500" />
                  <button
                    type="button"
                    onPointerDown={(event) => startTransform(event, "rotate")}
                    onPointerMove={transformLayer}
                    onPointerUp={stopTransform}
                    onPointerCancel={stopTransform}
                    className="pointer-events-auto absolute -top-11 left-1/2 flex h-5 w-5 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-blue-600 bg-white text-blue-700 shadow-sm active:cursor-grabbing"
                    aria-label="چرخاندن لایه"
                    title="برای چرخاندن بکشید"
                  >
                    <RotateCw className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </div>
            {!imageReady ? (
              <div className="rounded-lg border border-dashed border-app-borderStrong bg-white/80 px-6 py-8 text-center shadow-soft">
                <p className="text-sm font-black text-app-text">در حال آماده‌سازی تصویر</p>
                <p className="mt-2 text-xs font-bold text-app-muted">بعد از بارگذاری، بوم و ابزارها فعال می‌شوند.</p>
              </div>
            ) : null}
            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-lg border border-white/80 bg-white/95 p-1.5 shadow-soft">
                  <button type="button" onClick={() => { setFitMode("custom"); setZoom((current) => Math.max(20, current - 10)); }} className="app-interactive nashrino-control-radius flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-app-primary" aria-label="کوچک‌نمایی" title="کوچک‌نمایی">
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="min-w-12 text-center text-[11px] font-black text-app-text">{zoom}%</span>
                  <button type="button" onClick={() => { setFitMode("custom"); setZoom((current) => Math.min(180, current + 10)); }} className="app-interactive nashrino-control-radius flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-app-primary" aria-label="بزرگ‌نمایی" title="بزرگ‌نمایی">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
                  <button type="button" onClick={() => applyFitMode("fit")} className={`app-interactive nashrino-control-radius flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-app-primary ${fitMode === "fit" ? "bg-blue-50 text-app-primary ring-1 ring-blue-200" : ""}`} aria-label="جای دادن در صفحه" title="جای دادن در صفحه">
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              </button>
                  <button type="button" onClick={() => applyFitMode("actual")} className={`app-interactive nashrino-control-radius min-h-8 px-3 text-[10px] font-black text-slate-600 hover:bg-blue-50 hover:text-app-primary ${fitMode === "actual" ? "bg-blue-50 text-app-primary ring-1 ring-blue-200" : ""}`} aria-label="نمایش صد درصد" title="نمایش صد درصد">
                ۱۰۰
              </button>
                  <button type="button" onClick={() => applyFitMode("fill")} className={`app-interactive nashrino-control-radius min-h-8 px-3 text-[10px] font-black text-slate-600 hover:bg-blue-50 hover:text-app-primary ${fitMode === "fill" ? "bg-blue-50 text-app-primary ring-1 ring-blue-200" : ""}`} aria-label="پر کردن عرض" title="پر کردن عرض">
                عرض
              </button>
            </div>
          </div>

          <aside className="min-h-0 overflow-hidden border-t border-app-border bg-white max-lg:order-3 lg:border-r lg:border-t-0">
            <div className="h-full overflow-y-auto p-4">
              <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-app-border bg-white/95 px-4 py-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-app-primary">Inspector</p>
                    <h3 className="mt-1 truncate text-sm font-black text-app-text">{selectedLayer ? selectedLayer.name : "لایه‌ای انتخاب نشده"}</h3>
                  </div>
                  <StatusToken tone={selectedLayerIds.length > 1 ? "primary" : selectedLayer ? "neutral" : "neutral"}>{selectedLayerIds.length || 0} انتخاب</StatusToken>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-app-surfaceMuted px-2 py-1.5">
                    <span className="block text-[9px] font-black text-app-muted">نوع</span>
                    <span className="mt-0.5 block truncate text-[10px] font-black text-app-text">{selectedLayer?.type === "text" ? "متن" : selectedLayer ? "استیکر" : "هیچ"}</span>
                  </div>
                  <div className="rounded-md bg-app-surfaceMuted px-2 py-1.5">
                    <span className="block text-[9px] font-black text-app-muted">قفل</span>
                    <span className="mt-0.5 block truncate text-[10px] font-black text-app-text">{selectedLayer?.locked ? "فعال" : "باز"}</span>
                  </div>
                  <div className="rounded-md bg-app-surfaceMuted px-2 py-1.5">
                    <span className="block text-[9px] font-black text-app-muted">شفافیت</span>
                    <span className="mt-0.5 block truncate text-[10px] font-black text-app-text">{selectedLayer ? `${selectedLayer.opacity}%` : "-"}</span>
                  </div>
                </div>
              </div>

              <section className="mt-4 rounded-md border border-app-border bg-white p-3 shadow-hairline">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-app-primary" aria-hidden="true" />
                    <h3 className="text-xs font-black text-app-text">لایه‌ها</h3>
                  </div>
                  <StatusToken tone={selectedLayerIds.length > 1 ? "primary" : "neutral"}>{selectedLayerIds.length || 0} انتخاب</StatusToken>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {layerSummaryItems.map((item) => (
                    <div key={item.label} className="rounded-md bg-app-surfaceMuted px-2 py-1.5 text-center">
                      <span className="block text-[10px] font-black text-app-text">{item.value}</span>
                      <span className="mt-0.5 block text-[9px] font-bold text-app-muted">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setSelectedLayerIds(layers.map((layer) => layer.id)); setSelectedLayerId(layers[layers.length - 1]?.id ?? ""); }} disabled={!layers.length} className="app-interactive rounded-md border border-app-border bg-white px-2 py-1.5 text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-40">
                    انتخاب همه
                  </button>
                  <button type="button" onClick={() => { setSelectedLayerIds([]); setSelectedLayerId(""); }} disabled={!selectedLayerIds.length} className="app-interactive rounded-md border border-app-border bg-white px-2 py-1.5 text-[10px] font-black text-app-muted shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary disabled:pointer-events-none disabled:opacity-40">
                    پاک‌کردن انتخاب
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-1 rounded-md bg-app-surfaceMuted p-1 shadow-hairline">
                  <button type="button" onClick={() => alignSelected("centerX")} disabled={!selectedLayerIds.length} className="app-interactive flex h-8 flex-1 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="تراز افقی وسط" title="تراز افقی وسط">
                    <AlignCenter className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => alignSelected("centerY")} disabled={!selectedLayerIds.length} className="app-interactive flex h-8 flex-1 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="تراز عمودی وسط" title="تراز عمودی وسط">
                    <AlignCenter className="h-4 w-4 rotate-90" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={groupSelected} disabled={selectedLayerIds.length < 2} className="app-interactive flex h-8 flex-1 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="گروه کردن" title="گروه کردن">
                    <Group className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={ungroupSelected} disabled={!selectedLayerIds.length} className="app-interactive flex h-8 flex-1 items-center justify-center rounded text-slate-600 hover:bg-white hover:text-app-primary disabled:pointer-events-none disabled:opacity-40" aria-label="خروج از گروه" title="خروج از گروه">
                    <Ungroup className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {!layers.length ? (
                    <div className="rounded-lg border border-dashed border-app-borderStrong bg-app-surfaceMuted p-4 text-center">
                      <p className="text-xs font-black text-app-text">هنوز لایه‌ای روی تصویر نیست</p>
                      <p className="mt-2 text-[11px] font-bold leading-5 text-app-muted">از متن فارسی، ترکیب آماده یا استیکر شروع کن تا اینجا ساختار طراحی را مدیریت کنی.</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={addText}>
                          <ImagePlus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                          متن
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => applyDesignRecipe(designRecipes[0])}>
                          <Layers3 className="ml-1.5 h-4 w-4" aria-hidden="true" />
                          قالب
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {[...layers].reverse().map((layer) => {
                    const active = selectedLayerIds.includes(layer.id);
                    const groupIndex = layer.groupId ? layers.filter((item) => item.groupId === layer.groupId).findIndex((item) => item.id === layer.id) + 1 : 0;
                    return (
                      <div
                        key={layer.id}
                        draggable
                        onDragStart={() => {
                          layerDragRef.current = layer.id;
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (layerDragRef.current) reorderLayer(layerDragRef.current, layer.id);
                          layerDragRef.current = null;
                        }}
                        className={`rounded-lg border p-2 shadow-hairline transition ${active ? "border-blue-300 bg-blue-50/70 ring-1 ring-blue-100" : "border-app-border bg-white hover:bg-app-surfaceMuted"} ${layer.visible ? "" : "opacity-60"}`}
                      >
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => selectLayer(layer.id, true)} className={`app-interactive flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${active ? "bg-blue-600 text-white" : "bg-app-surfaceMuted text-slate-500"}`} aria-label="انتخاب لایه" title="انتخاب لایه">
                            {layer.type === "text" ? <Type className="h-4 w-4" aria-hidden="true" /> : <SmilePlus className="h-4 w-4" aria-hidden="true" />}
                          </button>
                          <span className="h-8 w-1.5 shrink-0 rounded-full border border-white shadow-hairline" style={{ backgroundColor: layer.type === "text" ? layer.color : layer.backgroundColor }} aria-hidden="true" />
                          <button type="button" onClick={() => selectLayer(layer.id)} className="min-w-0 flex-1 text-right" title={layer.name}>
                            <span className="flex items-center gap-1.5">
                              <span className="block min-w-0 truncate text-xs font-black text-app-text">{layer.name}</span>
                              {layer.groupId ? <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-app-primary">گروه {groupIndex}</span> : null}
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] font-bold text-app-muted">{layer.type === "text" ? layer.value : "استیکر"} · {Math.round(layer.opacity)}%</span>
                          </button>
                    <button type="button" onClick={() => updateLayer(layer.id, { visible: !layer.visible })} className="app-interactive nashrino-control-radius flex h-8 w-8 shrink-0 items-center justify-center bg-app-surfaceMuted text-slate-600 hover:bg-white hover:text-app-primary" aria-label={layer.visible ? "پنهان کردن لایه" : "نمایش لایه"} title={layer.visible ? "پنهان کردن" : "نمایش"}>
                            {layer.visible ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                          </button>
                    <button type="button" onClick={() => updateLayer(layer.id, { locked: !layer.locked })} className="app-interactive nashrino-control-radius flex h-8 w-8 shrink-0 items-center justify-center bg-app-surfaceMuted text-slate-600 hover:bg-white hover:text-app-primary" aria-label={layer.locked ? "باز کردن قفل لایه" : "قفل کردن لایه"} title={layer.locked ? "باز کردن قفل" : "قفل کردن"}>
                            {layer.locked ? <Lock className="h-4 w-4" aria-hidden="true" /> : <Unlock className="h-4 w-4" aria-hidden="true" />}
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto_auto] gap-1">
                          <input value={layer.name} onFocus={() => remember()} onChange={(event) => updateLayer(layer.id, { name: event.target.value }, false)} className="h-8 rounded-md border border-app-border bg-white px-2 text-xs font-bold text-app-text outline-none focus:border-blue-300" aria-label="نام لایه" />
                          <button type="button" onClick={() => moveLayer(layer.id, "up")} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md bg-app-surfaceMuted text-slate-600 hover:bg-white hover:text-app-primary" aria-label="انتقال لایه به جلو" title="انتقال به جلو">
                            <ArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => moveLayer(layer.id, "down")} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md bg-app-surfaceMuted text-slate-600 hover:bg-white hover:text-app-primary" aria-label="انتقال لایه به عقب" title="انتقال به عقب">
                            <ArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => duplicateLayer(layer.id)} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md bg-app-surfaceMuted text-slate-600 hover:bg-white hover:text-app-primary" aria-label="تکثیر لایه" title="تکثیر">
                            <Copy className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => removeLayer(layer.id)} disabled={layer.locked} className="app-interactive flex h-8 w-8 items-center justify-center rounded-md bg-app-surfaceMuted text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-40" aria-label="حذف لایه" title={layer.locked ? "لایه قفل است" : "حذف"}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mt-4 rounded-md border border-app-border bg-white p-3 shadow-hairline">
                <div className="flex items-center gap-2">
                  <Redo2 className="h-4 w-4 text-app-primary" aria-hidden="true" />
                  <h3 className="text-xs font-black text-app-text">تنظیم لایه</h3>
                </div>
                {selectedLayer ? (
                  <div className="mt-3 space-y-4">
                    {selectedLayer.type === "text" ? (
                      <>
                        <label className="block text-xs font-bold text-app-muted">
                          متن
                          <textarea value={selectedLayer.value} disabled={selectedLayer.locked} onChange={(event) => updateSelectedLayer({ value: event.target.value })} className="mt-2 min-h-20 w-full resize-y rounded-md border border-app-border bg-app-canvas px-3 py-2 text-sm leading-6 text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" dir="rtl" />
                        </label>
                        <div className="block text-xs font-bold text-app-muted">
                          فونت فارسی
                          {selectedFontOption ? (
                            <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 shadow-hairline">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-app-primary">پیش‌نمایش زنده</span>
                                <span className="rounded bg-white px-2 py-1 text-[10px] font-black text-app-muted shadow-hairline">{selectedFontOption.label}</span>
                              </div>
                              <p className="mt-2 max-h-[4.5rem] overflow-hidden break-words text-2xl leading-9 text-app-text" style={fontPreviewStyle(selectedFontOption.value, selectedLayer.fontWeight)}>
                                {selectedFontPreviewText}
                              </p>
                            </div>
                          ) : null}
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {fontRolePresets.map((preset) => {
                              const active = selectedLayer.fontFamily === preset.fontFamily && selectedLayer.fontWeight === preset.fontWeight;
                              return (
                                <button
                                  key={preset.label}
                                  type="button"
                                  disabled={selectedLayer.locked}
                                  onClick={() => updateSelectedLayer({
                                    fontFamily: preset.fontFamily,
                                    fontWeight: preset.fontWeight,
                                    lineHeight: preset.lineHeight,
                                    letterSpacing: preset.letterSpacing,
                                    padding: preset.padding,
                                    radius: preset.radius,
                                    backgroundOpacity: preset.backgroundOpacity
                                  })}
                                  className={`app-interactive rounded-lg border p-2 text-right shadow-hairline disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-blue-200 bg-blue-50 text-app-primary ring-1 ring-blue-100" : "border-app-border bg-white text-app-muted hover:bg-app-surfaceMuted"}`}
                                >
                                  <span className="block text-[10px] font-black text-app-muted">{preset.label}</span>
                                  <span className="mt-1 block truncate text-lg leading-6 text-app-text" style={fontPreviewStyle(preset.fontFamily, preset.fontWeight)}>
                                    {preset.sample}
                                  </span>
                                  <span className="mt-1 block truncate text-[9px] font-bold text-app-muted">{preset.detail}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="دسته‌بندی فونت">
                            {fontCategoryFilters.map((filter) => {
                              const active = fontCategory === filter.id;
                              return (
                                <button
                                  key={filter.id}
                                  type="button"
                                  disabled={selectedLayer.locked}
                                  onClick={() => setFontCategory(filter.id)}
                                  className={`app-interactive rounded-md border px-2 py-1 text-[10px] font-black shadow-hairline disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-blue-200 bg-blue-50 text-app-primary" : "border-app-border bg-white text-app-muted hover:bg-app-surfaceMuted"}`}
                                  role="tab"
                                  aria-selected={active}
                                >
                                  {filter.label}
                                </button>
                              );
                            })}
                          </div>
                          <label className="mt-2 block">
                            <span className="sr-only">جست‌وجوی فونت</span>
                            <input
                              type="search"
                              value={fontSearch}
                              disabled={selectedLayer.locked}
                              onChange={(event) => setFontSearch(event.target.value)}
                              placeholder="جست‌وجوی فونت..."
                              className="w-full rounded-md border border-app-border bg-white px-3 py-2 text-xs font-bold text-app-text outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
                              dir="ltr"
                            />
                          </label>
                          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-app-border bg-white p-2 shadow-hairline" role="radiogroup" aria-label="فونت فارسی">
                            <div className="mb-2 flex items-center justify-between gap-2 px-1">
                              <span className="text-[10px] font-black text-app-muted">{filteredFontOptions.length} فونت</span>
                              <span className="text-[10px] font-bold text-app-muted">نمونه کوتاه برای انتخاب سریع</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                            {filteredFontOptions.map((font) => {
                              const active = selectedLayer.fontFamily === font.value;
                              return (
                                <button
                                  key={font.value}
                                  type="button"
                                  disabled={selectedLayer.locked}
                                  onClick={() => updateSelectedLayer({ fontFamily: font.value })}
                                  className={`app-interactive min-w-0 rounded-md border px-2 py-2 text-right disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-blue-200 bg-blue-50 text-app-primary ring-1 ring-blue-100" : "border-transparent text-app-text hover:border-app-border hover:bg-app-surfaceMuted"}`}
                                  role="radio"
                                  aria-checked={active}
                                >
                                  <span className="block truncate text-[10px] font-black text-app-muted">{font.label}</span>
                                  <span className="mt-1 block truncate text-lg leading-6 text-app-text" style={fontPreviewStyle(font.value, font.value.includes("Bold") ? 700 : selectedLayer.fontWeight)}>
                                    {fontPickerPreviewText}
                                  </span>
                                </button>
                              );
                            })}
                            </div>
                            {!filteredFontOptions.length ? (
                              <div className="rounded-md bg-app-surfaceMuted px-3 py-4 text-center text-xs font-bold text-app-muted">
                                فونتی پیدا نشد
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <label className="block text-xs font-bold text-app-muted">
                          وزن فونت
                          <select value={selectedLayer.fontWeight} disabled={selectedLayer.locked} onChange={(event) => updateSelectedLayer({ fontWeight: Number(event.target.value) })} className="mt-2 w-full rounded-md border border-app-border bg-white px-3 py-2 text-sm text-app-text outline-none focus:border-blue-300 disabled:opacity-60">
                            <option value={400}>معمولی</option>
                            <option value={700}>بولد</option>
                            <option value={800}>سنگین</option>
                            <option value={900}>تبلیغاتی</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <div className="rounded-md bg-app-surfaceMuted p-3 text-center text-4xl shadow-hairline">{selectedLayer.value}</div>
                    )}

                    <label className="block text-xs font-bold text-app-muted">
                      شفافیت · {selectedLayer.opacity}%
                      <input type="range" min="10" max="100" value={selectedLayer.opacity} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ opacity: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                    </label>
                    <label className="block text-xs font-bold text-app-muted">
                      اندازه · {selectedLayer.fontSize}px
                      <input type="range" min="20" max="180" value={selectedLayer.fontSize} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ fontSize: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                    </label>
                    {selectedLayer.type === "text" ? (
                      <>
                        <label className="block text-xs font-bold text-app-muted">
                          عرض جعبه متن · {selectedLayer.boxWidth}px
                          <input type="range" min="160" max={Math.max(320, canvasSize.width)} value={selectedLayer.boxWidth} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ boxWidth: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs font-bold text-app-muted">
                            فاصله خطوط · {selectedLayer.lineHeight.toFixed(2)}
                            <input type="range" min="0.9" max="1.8" step="0.05" value={selectedLayer.lineHeight} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ lineHeight: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                          </label>
                          <label className="block text-xs font-bold text-app-muted">
                            فاصله حروف · {selectedLayer.letterSpacing}px
                            <input type="range" min="-2" max="8" value={selectedLayer.letterSpacing} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ letterSpacing: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                          </label>
                        </div>
                      </>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={duplicateSelectedLayer}>
                        <Copy className="ml-1.5 h-4 w-4" aria-hidden="true" />
                        تکثیر
                      </Button>
                      <div className="flex items-center justify-center rounded-md bg-app-surfaceMuted px-2 text-xs font-black text-app-muted shadow-hairline">
                        {Math.round(selectedLayer.rotation)}°
                      </div>
                    </div>

                    {selectedLayer.type === "text" ? (
                      <div>
                        <p className="text-xs font-bold text-app-muted">رنگ متن</p>
                        <div className="mt-2 space-y-2 rounded-md border border-app-border bg-white p-2 shadow-hairline">
                          {textColorGroups.map((group) => (
                            <div key={group.label}>
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-app-text">{group.label}</span>
                                <span className="text-[10px] font-bold text-app-muted">{group.detail}</span>
                              </div>
                              <div className="grid grid-cols-6 gap-1.5">
                                {group.colors.map((color) => (
                                  <button
                                    key={`${group.label}-${color}`}
                                    type="button"
                                    disabled={selectedLayer.locked}
                                    onClick={() => applySelectedLayerColor("color", color)}
                                    className={`aspect-square rounded-md border shadow-hairline disabled:opacity-50 ${selectedLayer.color.toUpperCase() === color.toUpperCase() ? "ring-2 ring-app-primary ring-offset-2" : "border-app-border"}`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`انتخاب رنگ ${color}`}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        <label className="mt-3 flex items-center justify-between gap-3 rounded-md bg-app-surfaceMuted px-3 py-2 text-xs font-bold text-app-muted shadow-hairline">
                          رنگ دلخواه
                          <input
                            type="color"
                            value={selectedColorDraft}
                            disabled={selectedLayer.locked}
                            onPointerDown={beginSelectedLayerLiveEdit}
                            onFocus={beginSelectedLayerLiveEdit}
                            onInput={(event) => updateSelectedLayerColorDraft("color", event.currentTarget.value)}
                            onChange={(event) => updateSelectedLayerColorDraft("color", event.target.value)}
                            onBlur={(event) => commitSelectedLayerColor("color", event.currentTarget.value)}
                            className="h-7 w-12 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-50"
                          />
                        </label>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {([
                            { value: "right", icon: AlignRight, label: "راست‌چین" },
                            { value: "center", icon: AlignCenter, label: "وسط‌چین" },
                            { value: "left", icon: AlignLeft, label: "چپ‌چین" }
                          ] as const).map((option) => {
                            const Icon = option.icon;
                            return (
                              <button key={option.value} type="button" disabled={selectedLayer.locked} onClick={() => updateSelectedLayer({ align: option.value })} className={`app-interactive flex items-center justify-center rounded-md p-2 disabled:opacity-50 ${selectedLayer.align === option.value ? "bg-blue-50 text-app-primary ring-1 ring-blue-200" : "bg-app-surfaceMuted text-slate-500"}`} aria-label={option.label} title={option.label}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 rounded-md border border-app-border bg-app-surfaceMuted p-3">
                          <p className="text-xs font-black text-app-text">برچسب و افکت متن</p>
                          <div className="mt-2 grid grid-cols-6 gap-1.5">
                            {labelSwatches.map((color) => (
                              <button key={color} type="button" disabled={selectedLayer.locked} onClick={() => applySelectedLayerColor("backgroundColor", color, { backgroundOpacity: Math.max(selectedLayer.backgroundOpacity, 70) })} className={`aspect-square rounded-md border shadow-hairline disabled:opacity-50 ${selectedLayer.backgroundColor === color ? "ring-2 ring-app-primary ring-offset-2" : "border-app-border"}`} style={{ backgroundColor: color }} aria-label={`انتخاب پس‌زمینه ${color}`} title={color} />
                            ))}
                          </div>
                          <label className="mt-3 block text-xs font-bold text-app-muted">
                            شفافیت پس‌زمینه · {selectedLayer.backgroundOpacity}%
                            <input type="range" min="0" max="100" value={selectedLayer.backgroundOpacity} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ backgroundOpacity: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                          </label>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="block text-xs font-bold text-app-muted">
                              فاصله داخلی · {selectedLayer.padding}px
                              <input type="range" min="0" max="44" value={selectedLayer.padding} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ padding: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                            </label>
                            <label className="block text-xs font-bold text-app-muted">
                              گردی · {selectedLayer.radius}px
                              <input type="range" min="0" max="48" value={selectedLayer.radius} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ radius: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                            </label>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <label className="block text-xs font-bold text-app-muted">
                              دورخط · {selectedLayer.outlineWidth}px
                              <input type="range" min="0" max="8" value={selectedLayer.outlineWidth} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ outlineWidth: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                            </label>
                            <label className="flex items-end justify-between gap-2 text-xs font-bold text-app-muted">
                              رنگ دورخط
                              <input
                                type="color"
                                value={selectedOutlineColorDraft}
                                disabled={selectedLayer.locked}
                                onPointerDown={beginSelectedLayerLiveEdit}
                                onFocus={beginSelectedLayerLiveEdit}
                                onInput={(event) => updateSelectedLayerColorDraft("outlineColor", event.currentTarget.value)}
                                onChange={(event) => updateSelectedLayerColorDraft("outlineColor", event.target.value)}
                                onBlur={(event) => commitSelectedLayerColor("outlineColor", event.currentTarget.value)}
                                className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent p-0 disabled:opacity-50"
                              />
                            </label>
                          </div>
                          <label className="mt-3 block text-xs font-bold text-app-muted">
                            سایه متن · {selectedLayer.shadowBlur}px
                            <input type="range" min="0" max="24" value={selectedLayer.shadowBlur} disabled={selectedLayer.locked} onPointerDown={beginSelectedLayerLiveEdit} onFocus={beginSelectedLayerLiveEdit} onChange={(event) => updateSelectedLayer({ shadowBlur: Number(event.target.value) }, false)} className="mt-2 w-full accent-blue-600 disabled:opacity-60" />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <Button type="button" variant="danger" size="sm" className="w-full" onClick={removeSelectedLayer}>
                      <Trash2 className="ml-1.5 h-4 w-4" aria-hidden="true" />
                      حذف لایه
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-dashed border-app-borderStrong bg-app-surfaceMuted p-4">
                    <div className="flex items-center gap-2">
                      <Type className="h-4 w-4 text-app-primary" aria-hidden="true" />
                      <p className="text-xs font-black text-app-text">برای شروع یک متن اضافه کنید</p>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-app-muted">
                      بعد از اضافه شدن متن، همین بخش به فونت‌ها، دسته‌بندی‌ها و کیت‌های تایپوگرافی تبدیل می‌شود.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {textStylePresets.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => addPresetText(preset)}
                          className="app-interactive rounded-md border border-app-border bg-white px-2 py-2 text-right text-[11px] font-black text-app-text shadow-hairline hover:border-blue-200 hover:bg-blue-50 hover:text-app-primary"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <Button type="button" variant="secondary" size="sm" className="mt-3 w-full" onClick={addText}>
                      <ImagePlus className="ml-1.5 h-4 w-4" aria-hidden="true" />
                      افزودن متن دستی
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </aside>
        </div>
      </section>
    </div>
  ), document.body);
}

