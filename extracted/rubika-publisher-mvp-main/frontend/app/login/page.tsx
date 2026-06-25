"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("change_this_password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error("ایمیل یا رمز عبور اشتباه است");
      }

      const data = await response.json();
      window.localStorage.setItem("rubika_publisher_access", data.access_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطای ورود");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background p-5 text-app-text">
      <section className="w-full max-w-md rounded-3xl border border-app-border bg-app-surface p-8 shadow-soft">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold text-app-primary">Rubika Publisher</p>
          <h1 className="mt-2 text-2xl font-bold">ورود مدیر سیستم</h1>
          <p className="mt-2 text-sm leading-7 text-app-muted">برای مدیریت پست‌ها و انتشار خودکار وارد شوید.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            ایمیل
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-app-border bg-white px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
              dir="ltr"
              type="email"
              required
            />
          </label>

          <label className="block text-sm font-medium">
            رمز عبور
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-app-border bg-white px-4 py-3 text-left text-sm outline-none ring-app-primary focus:ring-2"
              dir="ltr"
              type="password"
              required
            />
          </label>

          {error ? <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-app-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-app-primaryHover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "در حال ورود..." : "ورود به پنل"}
          </button>
        </form>
      </section>
    </main>
  );
}
