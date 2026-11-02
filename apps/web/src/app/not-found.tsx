import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-full">
        <FileQuestion className="text-muted-foreground h-10 w-10" />
      </div>

      <div className="max-w-md text-center">
        <h1 className="text-foreground text-2xl font-bold">Page Not Found</h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>

      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
