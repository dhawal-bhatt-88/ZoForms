"use client";

import { useEffect, useState } from "react";
import { me } from "./api";

type Me = Awaited<ReturnType<typeof me>>;

/**
 * The signed-in member, fetched once: "loading" until it arrives, then the
 * member, or "failed" (the editor then lays itself out with the defaults).
 */
type MeState = { status: "loading" } | { status: "ready"; me: Me } | { status: "failed" };

export function useMe(): MeState {
  const [state, setState] = useState<MeState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    me()
      .then((m) => live && setState({ status: "ready", me: m }))
      .catch(() => live && setState({ status: "failed" }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/**
 * Whether the signed-in member may change things: anyone but a VIEWER, as the
 * API's `assertCanEdit` decides. False until the role is known, so a viewer
 * never sees a write control flash up — the Team page treats its own controls
 * the same way. Write controls are hidden, not disabled, when this is false.
 */
export function canEditAs(state: MeState): boolean {
  return state.status === "ready" && state.me.role !== "VIEWER";
}

export function useCanEdit(): boolean {
  return canEditAs(useMe());
}
