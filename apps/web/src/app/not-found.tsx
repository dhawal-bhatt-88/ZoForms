import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <span className="eyebrow text-brand-deep">404</span>
        <h1 className="display-sm mt-3">
          Page not found
        </h1>
        <p className="body-sm mt-2 text-graphite">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className={buttonClasses({ variant: "primary" })}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
