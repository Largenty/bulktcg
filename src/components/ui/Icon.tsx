/* Jeu d'icônes du site, tracées au trait sur une grille de 24, extrémités
   carrées comme le reste du boîtier. Un seul
   fichier plutôt qu'un SVG recopié dans chaque composant : l'épaisseur et
   les terminaisons restent les mêmes partout, et une icône se change à un
   seul endroit.

   Toujours décoratives : le sens est porté par le libellé à côté, ou par
   un texte réservé aux lecteurs d'écran sur le bouton qui les contient. */

const PATHS = {
  search: "M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15zm5.3-2.2L21 21",
  close: "M6 6l12 12M18 6L6 18",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevronDown: "M6 9l6 6 6-6",
  chevronUp: "M6 15l6-6 6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
  arrowRight: "M4 12h15m-6-6 6 6-6 6",
  arrowLeft: "M20 12H5m6-6-6 6 6 6",
  arrowUp: "M12 20V5m-6 6 6-6 6 6",
  plus: "M12 5v14M5 12h14",
  camera: "M4 8h3l1.6-2.2h6.8L17 8h3v11H4zM12 16.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-13v4.5l3 2",
  check: "M4.5 12.5l5 5 10-11",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  trash: "M4 7h16M9 7V4.5h6V7m-9 0 1 13h10l1-13",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5",
  message: "M4 5h16v11H9l-5 4z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7.5 8.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
  box: "M3.5 8.5 12 4l8.5 4.5v9L12 22l-8.5-4.5zM3.5 8.5 12 13l8.5-4.5M12 13v9",
  eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  alert: "M12 4 2.8 19.5h18.4zM12 10v4.5m0 2.7v.1",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-10v6m0-9.2v.1",
  image: "M4 5h16v14H4zm0 10 4.5-4.5 4 4 2.5-2.5L20 17M15.5 9.5v.1",
  upload: "M12 16V4m-5 5 5-5 5 5M4 15v5h16v-5",
  star: "M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  shield: "M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6zm-3.2 9 2.3 2.3 4.2-4.6",
  handshake: "M3 11l4-4 4 2 3-2 7 4-4 4-3-2-3 3-4-1zm4 4 2 2m1-4 2 2",
  sparkle: "M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  external: "M14 4h6v6m0-6-9 9M18 14v6H4V6h6",
  flag: "M5 21V4m0 0h11l-2 4 2 4H5",
  bell: "M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9zm4 11a2.2 2.2 0 0 0 4 0",
  swap: "M4 8h15l-4-4m5 12H5l4 4",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  monitor: "M3.5 5h17v11h-17zM9 20h6M12 16v4",
  lock: "M6 11h12v9H6zm2.5 0V8a3.5 3.5 0 0 1 7 0v3",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function Icon({ name, size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
