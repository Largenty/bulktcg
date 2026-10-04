import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export type SearchField = {
  id: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: "text" | "search";
  /* Suggestions du champ, quand il attend une ville. */
  options?: string[];
  /* Le champ « quoi » est plus large que le champ « où ». */
  grow?: string;
};

type SearchBarProps = {
  action: string;
  submitLabel: string;
  fields: SearchField[];
  /* Critères que la page impose et que le formulaire doit reconduire — le
     jeu courant, pour qu'une recherche depuis la page Pokémon y reste. */
  hidden?: Record<string, string | undefined>;
  size?: "md" | "lg";
  /* Le nom du repère : sur une page de liste, la recherche de l'en-tête
     (« sur tout le site ») côtoie celle-ci, et deux repères « recherche »
     sans nom ne se distinguent pas. */
  label?: string;
};

/* Le cadre d'encre de 2 px est réservé à deux choses : les vignettes et la
   recherche — les deux objets qu'on vient chercher ici.
   Formulaire GET nu : les critères atterrissent dans l'URL, la recherche est
   partageable et le retour arrière fonctionne. Rien de tout ça n'a besoin de
   JavaScript, donc le composant reste un Server Component. Une seule coque
   pour la barre à deux champs des annonces et celle à un champ des
   recherches : seules les cellules changent. */
export function SearchBar({ action, submitLabel, fields, hidden, size = "md", label = "Chercher un lot" }: SearchBarProps) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-label={label}
      className="flex flex-col overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--border-width-strong)] border-[var(--ink)] bg-[var(--card)] text-[var(--ink)] sm:flex-row sm:items-stretch"
    >
      {Object.entries(hidden ?? {}).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          className={[
            "search-cell min-w-0",
            field.grow ?? "flex-1",
            index < fields.length - 1
              ? "border-b-[length:var(--border-width)] border-[var(--line)] sm:border-b-0 sm:border-r-[length:var(--border-width)]"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <label htmlFor={field.id} className="label block px-4 pt-3 text-[var(--muted)]">
            {field.label}
          </label>
          <input
            id={field.id}
            name={field.name}
            type={field.options ? "text" : "search"}
            list={field.options ? `${field.id}-options` : undefined}
            defaultValue={field.defaultValue ?? ""}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete}
            className={`w-full bg-transparent px-4 pb-3 pt-0.5 outline-none placeholder:text-[var(--muted)] ${
              size === "lg" ? "text-[length:var(--text-body)]" : "text-[length:var(--text-lg)]"
            }`}
          />
          {field.options ? (
            <datalist id={`${field.id}-options`}>
              {field.options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          ) : null}
        </div>
      ))}

      <div className="p-2">
        <Button type="submit" size={size === "lg" ? "lg" : "md"} className="h-full w-full sm:w-auto">
          <Icon name="search" size={18} />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* Les deux champs de la recherche de lots — « quoi » et « où » — décrits une
   fois. L'accueil et la liste posent la même barre ; les voir diverger d'un
   placeholder serait le premier signe qu'on en a oublié une. */
export function listingSearchFields(
  cities: string[],
  defaults: { search?: string; city?: string } = {},
): SearchField[] {
  return [
    {
      id: "recherche-quoi",
      name: "q",
      label: "Quoi",
      placeholder: "Vrac, classeur, EV08…",
      defaultValue: defaults.search,
      grow: "flex-[1.2]",
    },
    {
      id: "recherche-ou",
      name: "ville",
      label: "Où",
      placeholder: "Ville ou code postal",
      defaultValue: defaults.city,
      autoComplete: "address-level2",
      options: cities,
    },
  ];
}
