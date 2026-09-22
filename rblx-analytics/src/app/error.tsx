"use client";

import { RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { ErrorState } from "@/components/common/states";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl py-10">
      <ErrorState
        title="Data unavailable"
        description="We couldn't load this page. The data source may be temporarily unreachable — please try again."
        action={<Button variant="secondary" onClick={reset}><RefreshCw /> Try again</Button>}
      />
    </div>
  );
}
