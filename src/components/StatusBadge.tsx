import { STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import type { ServiceStatus } from "@/lib/feeds";

export function StatusBadge({ status, label }: { status: ServiceStatus; label?: string }) {
  return (
    <span className={`badge ${STATUS_TONE[status] ?? "muted"}`}>
      <i className="dot" />
      {label ?? STATUS_LABEL[status] ?? "Inconnu"}
    </span>
  );
}
