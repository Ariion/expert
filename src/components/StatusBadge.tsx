import { STATUS_TONE, statusLabel } from "@/lib/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { ServiceStatus } from "@/lib/feeds";

export function StatusBadge({
  status,
  label,
  locale = DEFAULT_LOCALE,
}: {
  status: ServiceStatus;
  label?: string;
  locale?: Locale;
}) {
  return (
    <span className={`badge ${STATUS_TONE[status] ?? "muted"}`}>
      <i className="dot" />
      {label ?? statusLabel(status, locale)}
    </span>
  );
}
