"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-sm text-muted-foreground">Something went wrong.</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
