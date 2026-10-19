import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="max-w-md">
        <span className="eyebrow text-brand-deep">404</span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted">
          The page you&apos;re looking for doesn&apos;t exist or was moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
