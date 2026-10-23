import type { Metadata } from "next";
import Link from "next/link";
import { SignedInRedirect } from "@/components/signed-in-redirect";
import { buttonClasses } from "@/components/ui";

const TITLE = "Zowork Forms: clinical forms that run in your app";
const DESCRIPTION =
  "A form builder for behavioral health teams. Build forms with logic and scoring, download them, and render them in your own app with @zoworkhq/forms.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // The image is opengraph-image.tsx beside this file.
  openGraph: { type: "website", url: "/", siteName: "Zowork Forms", title: TITLE, description: DESCRIPTION },
};

/**
 * The public home page. A signed-in visitor is sent on to My forms before
 * paint (HOME_REDIRECT_SCRIPT in the root layout) or, arriving by a link
 * inside the app, by SignedInRedirect.
 */
export default function HomePage() {
  return (
    <>
      <SignedInRedirect />
      <section aria-labelledby="hero-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h1 id="hero-title" className="display-sm max-w-[20ch]">
          Clinical forms, built here, running in your app
        </h1>
        <p className="lede mt-4 max-w-[60ch]">
          Zowork Forms is a form builder for behavioral health teams. You design the form; it runs inside your own
          application, and the answers go to your own server.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className={buttonClasses({ variant: "primary" })}>
            Get started
          </Link>
          <Link href="/login" className={buttonClasses({ variant: "secondary" })}>
            Sign in
          </Link>
        </div>
      </section>
    </>
  );
}
