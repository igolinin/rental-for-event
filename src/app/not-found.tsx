import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center">
      <h1 className="text-6xl font-bold text-slate-300">404</h1>
      <p className="text-slate-600 font-medium">Page not found</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild>
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
