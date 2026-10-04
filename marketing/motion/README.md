# Film BulkTCG

Cinquante secondes de motion design pour donner envie de déposer son lot : le stock
qui dort, les deux impasses (la carte à l'unité, la poste), la marque, le site, le dépôt,
le croisement avec les demandes, le statut en un clic, l'offre pro, puis ce qu'un lot de
150 € rapporte face à Cardmarket et Leboncoin.

Tout est dessiné en code avec les éléments du site — jetons de `src/styles/tokens.css`,
géométrie du logo de `src/lib/brand-mark.ts`, icônes de `src/components/ui/Icon.tsx`,
vignette, intercalaires, demande de recherche, sélecteur de statut — et la bande-son est
synthétisée dans le navigateur : aucune image, carte ni musique sous licence.

| Fichier | Rôle |
|---|---|
| `config.js` | ce que le film affirme : montants, sources, date du relevé, domaine |
| `engine.js` | ligne de temps à images clés, déterministe, et lecteur |
| `scenes.js` | le décor et le mouvement des dix plans |
| `audio.js` | musique et bruitages, rendus hors temps réel |
| `motion.css` | la scène (jetons du site) et le lecteur (suit le thème) |
| `index.html` | le lecteur : 16:9 ou 9:16, son, chapitres, clavier |
| `render.mjs` | l'export MP4, image par image |

## Les chiffres

Un montant n'est écrit qu'une fois, dans `config.js`, avec sa source et la date du relevé
(4 octobre 2026) ; le film calcule le reste. Une publicité comparative doit pouvoir
prouver chacun de ses chiffres : quand un tarif change, on relit la page source, on
corrige `config.js` et on change la date.

- Cardmarket : « frais de vente de 5 % », envoi suivi obligatoire au-delà de 25 € —
  centre d'aide Cardmarket.
- Leboncoin : la Transaction sécurisée est gratuite pour le vendeur — centre d'aide
  Leboncoin. Le vendeur y garde donc autant que sur BulkTCG, et le film le montre.
- La Poste : Colissimo jusqu'à 10 kg, livraison à domicile, 25,29 € (tarifs 2026).

Le domaine n'est pas encore choisi : tant que `siteAddress` vaut `null`, la carte de fin
n'affiche aucune adresse.

## Exporter

```
FFMPEG=/chemin/vers/ffmpeg node marketing/motion/render.mjs        # 16:9 et 9:16
node marketing/motion/render.mjs --format 9x16                     # un seul format
node marketing/motion/render.mjs --still 24.6,47.6                 # des images PNG
node marketing/motion/render.mjs --from 12 --to 20 --fps 30        # un extrait, muet
```

Les fichiers sortent dans `out/` (ignoré par git). Il faut un ffmpeg qui encode libx264
et AAC — celui de Playwright ne fait que du VP8 muet ; une version statique convient
(paquet npm `ffmpeg-static`, hors du projet). Compter quelques minutes par format à
60 images/s.

Le 9:16 garde ses textes principaux au-dessus du quart bas de l'image, que recouvrent
les légendes et les boutons des formats verticaux des réseaux sociaux ; seules les
sources du comparatif, en petits caractères, y descendent.
