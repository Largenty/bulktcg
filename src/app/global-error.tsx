"use client";

import "./globals.css";

/* Ce fichier remplace le gabarit racine — en-tête et pied de page compris —
   parce qu'il sert quand c'est le gabarit lui-même qui a échoué. Il ne peut
   donc s'appuyer sur rien : ni sur les polices chargées par layout.tsx, ni
   sur les composants qui les supposent. D'où le texte nu, et les tokens
   appelés directement.

   Il n'y a pas de bouton « réessayer » ici : si la racine tombe, réessayer
   au même endroit retombera au même endroit. On propose de repartir de
   l'accueil, ce qui recharge tout.

   Le texte prend la largeur de la page, gouttières du gabarit comprises
   (--container-pad, 24 px si la feuille de style manque) : il était bridé
   à 480 px par un style en ligne, que tests/text-width.test.mjs ne lisait
   pas. */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "var(--container-pad, 24px)",
          background: "var(--paper)",
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
        }}
      >
        <main>
          <h1 style={{ fontSize: "var(--text-h3)", margin: 0 }}>Le site n&apos;a pas pu se charger</h1>
          <p
            style={{
              marginTop: "16px",
              fontSize: "var(--text-body)",
              lineHeight: 1.6,
              color: "var(--ink-soft)",
            }}
          >
            L&apos;erreur touche le gabarit commun à toutes les pages, et pas seulement celle-ci.
            Recharger l&apos;accueil est la seule chose utile à tenter d&apos;ici.
          </p>
          {error.digest ? (
            <p
              style={{
                marginTop: "16px",
                fontSize: "var(--text-xs)",
                fontFamily: "var(--font-mono)",
                color: "var(--muted)",
              }}
            >
              Référence de l&apos;incident : {error.digest}
            </p>
          ) : null}
          <p style={{ marginTop: "24px" }}>
            <a href="/" style={{ color: "var(--ink)" }}>
              Retour à l&apos;accueil
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
