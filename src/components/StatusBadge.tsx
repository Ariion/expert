import { STATUS_TONE, statusLabel } from "@/lib/format";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import type { ServiceStatus } from "@/lib/feeds";

/**
 * Sur une grille de cent soixante services, un pill plein vert par ligne
 * opérationnelle ne porte aucune information — c'est l'état par défaut,
 * attendu, silencieux. Seul ce qui a besoin d'attention mérite le traitement
 * plein (fond, bordure) ; l'état normal reste un point et un mot.
 *
 * `quiet={false}` restaure le pill même à l'opérationnel : c'est la réponse
 * principale de la page fournisseur, elle a droit au même poids visuel que
 * les autres états.
 */
export function StatusBadge({
  status,
  label,
  locale = DEFAULT_LOCALE,
  quiet = true,
}: {
  status: ServiceStatus;
  label?: string;
  locale?: Locale;
  quiet?: boolean;
}) {
  const text = label ?? statusLabel(status, locale);
  const tone = STATUS_TONE[status] ?? "muted";

  if (quiet && status === "operational") {
    return (
      <span className="status-quiet ok">
        <i className="dot" />
        {text}
      </span>
    );
  }

  return (
    <span className={`badge ${tone}`}>
      <i className="dot" />
      {text}
    </span>
  );
}
