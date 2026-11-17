// Ikoner i SVG, samma ritning som i prototypen. Dekorativa: aria-hidden.
const PATHS = {
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
  book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6',
  plane: 'M2 16l20-6-6 9-3-4-11 1z',
  us: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6.5 6.5 0 0 1 3.5 5.5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  x: 'M6 6l12 12M18 6L6 18',
  heart: 'M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z',
  lock: 'M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2',
  build: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6',
  // Samlingsbokens ikoner (compendium_items.icon), från prototypen
  food: 'M4 11h16M5 11a7 7 0 0 0 14 0M12 4v3M9 5l1 2M15 5l-1 2M8 20h8',
  cup: 'M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 9h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2',
  paw: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 13c-3 0-5 3-5 5 0 1.5 1.5 2 3 1.5 1.3-.4 2.7-.4 4 0 1.5.5 3 0 3-1.5 0-2-2-5-5-5z',
  sky: 'M3 16c3-6 6-6 9-2s6 4 9-2M3 20c3-4 6-4 9-1s6 3 9-1M12 3v3',
  bird: 'M4 14c4 0 6-2 8-6 1.5 3 4 4 8 4-2 4-6 6-10 6l-3 3v-3c-1.5 0-3-1.5-3-4z',
  ball: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7l4 3-1.5 4.5h-5L8 10z',
  flower: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 10V5M14 12h5M10 12H5M12 14v7',
  mush: 'M3 12a9 7 0 0 1 18 0zM9 12v6a3 3 0 0 0 6 0v-6',
  tram: 'M6 4h12v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 10h12M9 21l1.5-3M15 21l-1.5-3',
  // Egna tillägg i samma stil
  palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.6-1-2.6 0-.9.7-1.3 1.6-1.3H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  key: 'M14 10a4 4 0 1 0-3.9 4.9L7 18v3h3v-2h2v-2l2.1-2.1A4 4 0 0 0 14 10zM15.5 8.5h.01',
  out: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6h14v-6',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  locate: 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 2v4M12 18v4M2 12h4M18 12h4',
  filter: 'M4 6h16M7 12h10M10 18h4',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
} as const;

export type IconName = keyof typeof PATHS;

/** Sant om namnet finns bland ikonerna (till exempel icon från innehållet). */
export const isIcon = (n: string | null | undefined): n is IconName => Boolean(n && n in PATHS);

export function Icon({ name, size = 22, stroke = 1.9 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
