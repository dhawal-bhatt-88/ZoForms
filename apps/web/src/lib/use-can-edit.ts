"use client";

import { useEffect, useState } from "react";
import { me } from "./api";

/**
 * Whether the signed-in member may change things: anyone but a VIEWER, as the
 * API's `assertCanEdit` decides. False until the role is known, so a viewer
 * never sees a write control flash up — the Team page treats its own controls
 * the same way. Write controls are hidden, not disabled, when this is false.
 */
export function useCanEdit(): boolean {
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => {
    let live = true;
    me()
      .then((m) => live && setCanEdit(m.role !== "VIEWER"))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return canEdit;
}
