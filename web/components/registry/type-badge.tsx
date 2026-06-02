import type { ComponentType } from "@/lib/registry";
import { Badge } from "@/components/ui/badge";

export function TypeBadge({
  type,
  labels,
  className,
}: {
  type: ComponentType;
  labels: Record<ComponentType, string>;
  className?: string;
}) {
  return (
    <Badge
      variant={type === "segment" ? "default" : "secondary"}
      className={className}
    >
      {labels[type]}
    </Badge>
  );
}
