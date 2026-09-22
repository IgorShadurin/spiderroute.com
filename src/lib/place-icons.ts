/** Stable storage keys and trusted SVG paths shared by React cards and map markers. */
export const placeIcons = {
  pin: {
    ru: "Место",
    en: "Place",
    paths: [
      "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z",
      "M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6",
    ],
  },
  monument: {
    ru: "Памятник",
    en: "Monument",
    paths: ["m12 3 9 5H3l9-5Z", "M4 21h16M5 18h14M6 11v7m6-7v7m6-7v7"],
  },
  coffee: {
    ru: "Кофе",
    en: "Coffee",
    paths: [
      "M4 8h13v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Z",
      "M17 8h1a3 3 0 1 1 0 6h-1M7 2v3m4-3v3m4-3v3",
    ],
  },
  viewpoint: {
    ru: "Красивый вид",
    en: "Viewpoint",
    paths: ["M3 7h4l2-3h6l2 3h4v13H3Z", "M12 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8"],
  },
  forest: {
    ru: "Лес",
    en: "Forest",
    paths: ["m12 2-6 8h3l-5 8h16l-5-8h3l-6-8Z", "M12 18v4"],
  },
  mountain: {
    ru: "Горы",
    en: "Mountains",
    paths: ["m2 21 10-18 10 18H2Z", "m8 10 4 3 4-3"],
  },
  camp: {
    ru: "Кемпинг",
    en: "Campsite",
    paths: ["m3 21 9-18 9 18H3Z", "m8 21 4-8 4 8M10 3l2 4 2-4"],
  },
  food: {
    ru: "Еда",
    en: "Food",
    paths: ["M4 3v5a3 3 0 0 0 6 0V3M7 3v19", "M20 22V3c-4 3-5 7-5 10h5"],
  },
  water: {
    ru: "Вода",
    en: "Water",
    paths: [
      "M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z",
      "M9 16a3 3 0 0 0 3 3",
    ],
  },
  parking: {
    ru: "Парковка",
    en: "Parking",
    paths: ["M4 3h16v18H4Z", "M9 18V7h4a3 3 0 0 1 0 6H9"],
  },
} as const;
export type PlaceIconKey = keyof typeof placeIcons;
export const placeIconKeys = Object.keys(placeIcons) as PlaceIconKey[];
export function placeIcon(value?: string) {
  return placeIcons[value as PlaceIconKey] ?? placeIcons.pin;
}
