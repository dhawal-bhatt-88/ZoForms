import { ToastProvider } from "@/components/ui";

/**
 * Every signed-in route: My forms, Templates, Team, Versions and the editor.
 *
 * `ToastProvider` lives here rather than in `AppShell` because each page calls
 * `useToast()` in its own body, and `AppShell` is that page's child — a
 * provider inside it would be out of the page's reach. Here it also covers the
 * Versions page, which has no `AppShell`.
 */
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
