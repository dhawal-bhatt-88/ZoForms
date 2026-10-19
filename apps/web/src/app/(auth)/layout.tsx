import { Logo } from "@/components/logo";
import { ToastProvider } from "@/components/ui";

/**
 * The signed-out frame for sign-in, sign-up, forgot, reset, invite and verify.
 *
 * Ported from github.com/zoworkhq/zoblocks at 9aaefe0,
 * apps/app/src/app/(auth)/layout.tsx. Compare against it on the next sync.
 *
 * One 26rem column: the wordmark, the form and the footer share a single left
 * edge. `justify-center` on the middle row, with the other two as flex
 * siblings, puts the form a little above true centre, where the eye expects
 * it. The form sits on the page, not in a card.
 *
 * `ToastProvider` is mounted here as well as in the app shell: these screens
 * raise results too.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="relative flex min-h-screen flex-col px-6 py-8 sm:px-10">
        {/* One faint wash behind the form. Decorative. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(var(--zb-accent-wash)),transparent)]"
        />

        <header className="relative mx-auto w-full max-w-[26rem]">
          <Logo />
        </header>

        <main className="relative flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>

        <footer className="relative mx-auto flex w-full max-w-[26rem] flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[0.6875rem] text-graphite-soft">
          <span>Zowork Forms</span>
          <a href="https://zoblocks.design" className="link">
            zoblocks.design
          </a>
        </footer>
      </div>
    </ToastProvider>
  );
}
