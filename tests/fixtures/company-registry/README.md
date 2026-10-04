# Réponses du répertoire des entreprises

Rejouées par `tests/company-registry.test.mjs`, sans réseau.

- `recherche-*.json` : réponses réelles de l'API Recherche d'entreprises
  (`recherche-entreprises.api.gouv.fr/search?q=<siret>`), enregistrées le 2 octobre 2026 et
  réduites aux champs que lit `src/lib/company-registry.ts`. Un établissement actif (le siège
  de Danone), un établissement fermé de la même entreprise, et un SIRET valide absent du
  répertoire public.
- `sirene-non-diffusible.json` : **reconstituée** d'après la documentation de l'API Sirene
  3.11 de l'Insee (`api.insee.fr/api-sirene/3.11/siret/<siret>`), faute de clé pour
  l'enregistrer. Une entreprise qui a refusé la diffusion de ses données y apparaît avec ses
  champs masqués (`[ND]`). À remplacer par une vraie réponse au branchement de la clé
  (`todo.md`).
