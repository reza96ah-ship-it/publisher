"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "./loading-skeleton";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const token = window.localStorage.getItem("rubika_publisher_access");
      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        window.localStorage.removeItem("rubika_publisher_access");
        router.replace("/login");
        return;
      }

      setReady(true);
    }

    checkSession().catch(() => {
      window.localStorage.removeItem("rubika_publisher_access");
      router.replace("/login");
    });
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-app-background text-app-text">
        <div className="w-full max-w-xs rounded-md border border-app-border bg-white p-4 shadow-sm" aria-label="در حال بررسی نشست کاربری">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-2.5 w-full" />
        </div>
      </main>
    );
  }

  return children;
}

