"use client";

import { useEffect, useRef } from "react";
import { GOOGLE_CLIENT_ID } from "@/lib/api";

type GsiApi = {
  accounts: {
    id: {
      initialize: (opts: {
        client_id: string;
        callback: (r: { credential: string }) => void;
      }) => void;
      renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
    };
  };
};

/**
 * "Continue with Google" button via Google Identity Services. Renders nothing
 * when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset, so the login screen degrades
 * gracefully until Google sign-in is configured.
 */
export function GoogleButton({
  onCredential,
}: {
  onCredential: (credential: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const SRC = "https://accounts.google.com/gsi/client";
    const gsi = () => (window as unknown as { google?: GsiApi }).google;
    const render = () => {
      const g = gsi();
      if (!g || !ref.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => cb.current(r.credential),
      });
      g.accounts.id.renderButton(ref.current, {
        theme: "outline",
        size: "large",
        width: ref.current.offsetWidth || 320,
        text: "continue_with",
        logo_alignment: "center",
      });
    };
    if (gsi()) {
      render();
      return;
    }
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement("script");
      s.src = SRC;
      s.async = true;
      s.defer = true;
      s.onload = render;
      document.head.appendChild(s);
      return;
    }
    const timer = setInterval(() => {
      if (gsi()) {
        clearInterval(timer);
        render();
      }
    }, 200);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={ref} className="flex min-h-[40px] justify-center" />;
}
