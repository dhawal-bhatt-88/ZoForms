"use client";

import { useEffect, useState } from "react";

/** Landing page for admin impersonation: stores the issued token and enters the app. */
export default function ImpersonatePage() {
  const [msg, setMsg] = useState("Signing you in…");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      localStorage.setItem("frame_token", token);
      window.location.href = "/app";
    } else {
      setMsg("Missing impersonation token.");
    }
  }, []);

  return <div className="grid min-h-screen place-items-center text-sm text-muted">{msg}</div>;
}
