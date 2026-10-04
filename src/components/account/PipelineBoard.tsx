import Link from "next/link";
import { formatCount } from "@/lib/format";

export type PipelineStage = {
  label: string;
  count: number;
  href: string;
  /* Une étape qui attend un geste : elle passe en encre pleine dès qu'elle
     compte quelque chose. */
  needsAction?: boolean;
  /* Une autre fin plutôt que l'étape suivante : « Trouvé » ou
     « Abandonnée ». */
  isAlternative?: boolean;
};

export type PipelineRow = { title: string; stages: PipelineStage[] };

/* Le suivi, comme la page des commandes d'un site de vente : chaque ligne
   suit un objet d'une étape à l'autre, chaque étape se compte et mène à sa
   liste. Zéro s'affiche : ici c'est une information, pas une absence. */
export function PipelineBoard({ rows }: { rows: PipelineRow[] }) {
  return (
    <div className="panel flex flex-col">
      {rows.map((row, index) => (
        <section
          key={row.title}
          aria-labelledby={`suivi-${index}`}
          className={`grid gap-3 py-4 md:grid-cols-[150px_minmax(0,1fr)] md:items-center ${
            index > 0 ? "border-t-[length:var(--border-width)] border-[var(--line)]" : ""
          }`}
        >
          <h3 id={`suivi-${index}`} className="label text-[var(--muted)]">
            {row.title}
          </h3>
          <ol className="pipeline">
            {row.stages.map((stage) => (
              <li key={stage.label} data-alternative={stage.isAlternative ? "" : undefined}>
                <Link
                  href={stage.href}
                  className="pipeline-stage"
                  data-needs-action={stage.needsAction && stage.count > 0 ? "" : undefined}
                >
                  <span className="price text-[length:var(--number-lg)] leading-none">{formatCount(stage.count)}</span>
                  <span className="text-[length:var(--text-sm)] font-semibold">{stage.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
