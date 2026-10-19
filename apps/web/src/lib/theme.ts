/*
 * Ported verbatim from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/lib/theme.ts. Compare against that file on the next sync.
 *
 * Kept as it is, domain rule included: if the builder ever runs on a
 * zoblocks.design subdomain, the light/dark choice is shared with
 * zoblocks.design; anywhere else it is local. The builder has no high-contrast
 * palette, so a stored "high-contrast" (set by ZoBlocks) renders light here.
 */

/**
 * The theme choice, and why it lives in a cookie.
 *
 * The app and the docs site are separate origins — `zoblocks.design` and
 * `app.zoblocks.design` in production, `:6001` and `:6003` locally. A reader
 * who sets dark here and clicks "Sign in" should not be thrown into a white
 * login screen, so the choice has to survive the origin hop.
 *
 * `localStorage` cannot do that: it is keyed by scheme + host + **port**, so
 * the two apps could not read each other's value in either environment. A
 * cookie can, and for two different reasons that happen to line up:
 *
 *   - **Locally**, cookies ignore the port entirely. One set on `localhost`
 *     is sent to `localhost:6001` and `localhost:6003` alike.
 *   - **In production**, a cookie scoped to `.zoblocks.design` is sent to the
 *     apex and to every subdomain.
 *
 * `localStorage` is still written alongside it. That is not belt-and-braces:
 * the docs site's a11y audit drives themes through storage
 * before each pass, and the pre-paint script still reads it as a fallback, so
 * the high-contrast theme stays auditable even though the picker no longer
 * offers it.
 */

/**
 * Two, not four.
 *
 * `system` is gone as a *button* but not as behaviour — with nothing stored,
 * {@link resolveTheme} still follows `prefers-color-scheme`, so a reader whose
 * machine is dark still lands on dark. What has gone is the ability to pin
 * "follow the OS" as an explicit third state after choosing otherwise.
 *
 * `high-contrast` is gone from the picker but survives as a value. The token
 * build emits 59 tokens at a 7:1 floor behind `[data-zb-theme="high-contrast"]`
 * and the a11y script audits them; deleting the value would make that theme
 * unreachable again, which is the exact regression the comment in `globals.css`
 * was written about.
 */
export type Theme = "light" | "dark";

/** Values the pre-paint script and the audit may legitimately encounter. */
export type StoredTheme = Theme | "high-contrast";

export const THEME_COOKIE = "zoblocks-theme";
export const THEME_STORAGE_KEY = "zoblocks-theme";

/** A year. Long enough that the choice feels permanent, short enough to expire. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Scope the cookie to the registrable domain so the app subdomain receives it.
 *
 * Returns an empty string on localhost and on preview deployments, where the
 * host is either portless-shared already or a one-off origin that should not
 * be writing a cookie for a domain it does not own.
 */
function cookieDomain(): string {
  const host = location.hostname;
  return host === "zoblocks.design" || host.endsWith(".zoblocks.design")
    ? "; domain=.zoblocks.design"
    : "";
}

export function readStoredTheme(): StoredTheme | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)zoblocks-theme=([^;]*)/);
    const encoded = match?.[1];
    const fromCookie = encoded === undefined ? null : decodeURIComponent(encoded);
    const raw =
      fromCookie ??
      localStorage.getItem(THEME_STORAGE_KEY) ??
      // What this app called it before the cookie, and before it was the console.
      localStorage.getItem("zoblocks-app-theme") ??
      localStorage.getItem("zoblocks-console-theme");
    return raw === "light" || raw === "dark" || raw === "high-contrast" ? raw : null;
  } catch {
    return null;
  }
}

/** What to show when nothing has been chosen: whatever the machine says. */
export function resolveTheme(stored: StoredTheme | null): StoredTheme {
  if (stored) return stored;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: StoredTheme): void {
  const root = document.documentElement;

  // High contrast is a third value set held to 7:1, not a modifier on the other
  // two. Layering it over dark would give a reader two half-applied palettes.
  if (theme === "high-contrast") {
    root.classList.remove("dark");
    root.setAttribute("data-zb-theme", "high-contrast");
    return;
  }

  root.removeAttribute("data-zb-theme");
  root.classList.toggle("dark", theme === "dark");
}

export function writeTheme(theme: Theme): void {
  try {
    document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${MAX_AGE}; SameSite=Lax${cookieDomain()}`;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode, or a browser refusing storage. The class is still applied. */
  }
}

/**
 * The pre-paint script, shared verbatim by both apps' `layout.tsx`.
 *
 * Inlined into `<head>` and run before first paint, because applying the class
 * from an effect means a white flash on every load for every dark reader. It is
 * a string rather than an import for the same reason — it has to execute before
 * any bundle is fetched.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var e=document.documentElement,m=document.cookie.match(/(?:^|;\\s*)zoblocks-theme=([^;]*)/),t=m?decodeURIComponent(m[1]):null;if(!t){t=localStorage.getItem("zoblocks-theme")||localStorage.getItem("zoblocks-app-theme")||localStorage.getItem("zoblocks-console-theme")}if(t==="high-contrast"){e.setAttribute("data-zb-theme","high-contrast");return}var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;e.classList.toggle("dark",d)}catch(e){}})()`;
