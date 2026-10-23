"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

/**
 * The home page's redirect for a client-side arrival, such as the sign-in
 * page's logo link. A full load is redirected before paint by
 * HOME_REDIRECT_SCRIPT (lib/home-redirect.ts), so this only acts when that
 * script didn't run.
 */
export function SignedInRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (getToken()) router.replace("/app");
  }, [router]);
  return null;
}
