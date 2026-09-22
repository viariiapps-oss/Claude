import { Badge } from "@/components/ui/badge";
import type { Confidence } from "@/types";

const MAP: Record<Confidence, { label: string; variant: "success" | "warning" | "danger"; dot: string }> = {
  high: { label: "High", variant: "success", dot: "🟢" },
  medium: { label: "Medium", variant: "warning", dot: "🟡" },
  low: { label: "Low", variant: "danger", dot: "🔴" },
};

export function ConfidenceBadge({ confidence, withLabel = true }: { confidence: Confidence; withLabel?: boolean }) {
  const m = MAP[confidence];
  return (
    <Badge variant={m.variant}>
      <span aria-hidden>{m.dot}</span>
      {withLabel ? `Confidence: ${m.label}` : m.label}
    </Badge>
  );
}
