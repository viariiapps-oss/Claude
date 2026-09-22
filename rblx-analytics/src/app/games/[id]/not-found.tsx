import { SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GameNotFound() {
  return (
    <Card>
      <EmptyState
        icon={SearchX}
        title="Game not found"
        description="We couldn't find a public Roblox experience with this ID. In demo mode only the sample games are available — connect live data to look up any experience by its roblox.com game ID."
        action={
          <Button asChild variant="secondary">
            <Link href="/games">Browse games</Link>
          </Button>
        }
      />
    </Card>
  );
}
