"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl, authHeaders } from "./posts";

export function useMediaPreviewUrls(assetIds: Array<number | null | undefined>) {
  const key = useMemo(() => {
    return Array.from(new Set(assetIds.filter((assetId): assetId is number => typeof assetId === "number"))).join(",");
  }, [assetIds]);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!key) {
      setPreviewUrls({});
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    async function loadPreviews() {
      const assetIds = key.split(",").map(Number).filter(Boolean);
      const entries = await Promise.all(
        assetIds.map(async (assetId) => {
          try {
            const response = await fetch(`${apiUrl}/media/${assetId}/file`, { headers: authHeaders() });
            if (!response.ok) return null;
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return [assetId, url] as const;
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        setPreviewUrls(Object.fromEntries(entries.filter(Boolean) as Array<[number, string]>));
      } else {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    }

    loadPreviews();

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [key]);

  return previewUrls;
}

export function useMediaPreviewUrl(assetId?: number | null) {
  const previewUrls = useMediaPreviewUrls([assetId]);
  return assetId ? previewUrls[assetId] ?? "" : "";
}

