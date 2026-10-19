"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

/**
 * `/` has no page of its own: it sends people into the app if they hold a
 * token, and to sign-in if not. The token lives in localStorage, so this has to
 * run in the browser. A stale token reaches `/app`, whose 401 handling sends it
 * on to `/login`.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getToken() ? "/app" : "/login");
  }, [router]);
  return null;
}
