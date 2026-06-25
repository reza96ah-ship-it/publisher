import { ImageIcon, Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { WorkspaceAvatar } from "./brand-mark";

type InstagramPostPreviewProps = {
  imageUrl?: string;
  caption: string;
  destination?: string;
  emptyText?: string;
  brandColor?: string;
  avatarUrl?: string;
  viewMode?: "feed" | "story" | "reel";
};

export function InstagramPostPreview({
  imageUrl,
  caption,
  destination = "اکانت اینستاگرام",
  emptyText = "متن نهایی پست اینجا نمایش داده می‌شود.",
  brandColor,
  avatarUrl,
  viewMode = "feed"
}: InstagramPostPreviewProps) {
  if (viewMode === "story" || viewMode === "reel") {
    return (
      <div className="rounded-md bg-app-surfaceMuted p-2 shadow-hairline flex justify-center">
        <div className="relative overflow-hidden rounded-[2rem] border-[6px] border-black bg-slate-900 shadow-xl w-[260px] h-[520px]">
          {imageUrl ? (
            <img src={imageUrl} alt="پیش‌نمایش اینستاگرام" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-white/50 border border-dashed border-white/20 m-2 rounded-2xl">
              <ImageIcon className="h-6 w-6" aria-hidden="true" />
              رسانه {viewMode === "story" ? "استوری" : "ریلز"}
            </div>
          )}
          
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/60 to-transparent flex items-center gap-2 z-10">
            <WorkspaceAvatar name={destination} color={brandColor} imageUrl={avatarUrl} size="sm" />
            <span className="text-white text-xs font-bold drop-shadow-md">{destination}</span>
          </div>

          {viewMode === "reel" && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
              <div className="flex items-center gap-2 mb-2">
                <WorkspaceAvatar name={destination} color={brandColor} imageUrl={avatarUrl} size="sm" />
                <span className="text-white text-xs font-bold drop-shadow-md">{destination}</span>
              </div>
              <p className="text-white text-[11px] line-clamp-2 drop-shadow-md">{caption || emptyText}</p>
            </div>
          )}

          <div className="absolute bottom-6 right-3 flex flex-col gap-4 z-10 items-center">
             <Heart className="h-6 w-6 text-white drop-shadow-md" />
             <MessageCircle className="h-6 w-6 text-white drop-shadow-md" />
             <Send className="h-6 w-6 text-white drop-shadow-md" />
          </div>
        </div>
      </div>
    );
  }

  // Feed View
  return (
    <div className="rounded-md bg-app-surfaceMuted p-2 shadow-hairline">
      <div className="overflow-hidden rounded-md bg-white shadow-hairline">
        <div className="flex items-center justify-between border-b border-app-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <WorkspaceAvatar name={destination} color={brandColor} imageUrl={avatarUrl} size="sm" />
            <div>
              <p className="text-xs font-bold text-slate-800">{destination}</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400 tracking-widest">...</span>
        </div>

        {imageUrl ? (
          <img src={imageUrl} alt="پیش‌نمایش تصویر اینستاگرام" className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-slate-50 text-xs text-app-muted border-b border-dashed border-app-border">
            <ImageIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
            تصویر (توصیه شده نسبت ۱:۱)
          </div>
        )}

        <div className="px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-slate-700" />
              <MessageCircle className="h-5 w-5 text-slate-700" />
              <Send className="h-5 w-5 text-slate-700" />
            </div>
            <Bookmark className="h-5 w-5 text-slate-700" />
          </div>
          
          <div className="text-[13px] leading-6 text-slate-800">
            <span className="font-bold ml-1">{destination}</span>
            <span className="whitespace-pre-wrap">{caption || emptyText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

