import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

/**
 * The frame for the public pages: the home page now, the docs next. Nothing
 * here needs a session or calls the API. Public pages are in US English.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
