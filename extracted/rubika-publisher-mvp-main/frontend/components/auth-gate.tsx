"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
        <div className="rounded-2xl border border-app-border bg-app-surface px-6 py-4 text-sm text-app-muted shadow-sm">
          در حال بررسی نشست کاربری...
        </div>
      </main>
    );
  }

  return children;
}
