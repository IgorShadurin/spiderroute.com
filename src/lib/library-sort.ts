export type LibrarySort =
  | "date-desc"
  | "date-asc"
  | "distance-asc"
  | "distance-desc"
  | "name-asc"
  | "name-desc";
type Item = {
  id: string;
  title?: string;
  updatedAt?: string;
  stats?: { distance: number };
  available?: boolean;
};
export function sortLibrary<T extends Item>(
  items: T[],
  sort: LibrarySort,
  locale: string,
): T[] {
  const [field, direction] = sort.split("-");
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  });
  return [...items].sort((a, b) => {
    if (a.available === false || b.available === false)
      return (
        Number(a.available === false) - Number(b.available === false) ||
        a.id.localeCompare(b.id)
      );
    const result =
      field === "name"
        ? collator.compare(a.title || "", b.title || "")
        : field === "distance"
          ? (a.stats?.distance ?? 0) - (b.stats?.distance ?? 0)
          : (Date.parse(a.updatedAt || "") || 0) -
            (Date.parse(b.updatedAt || "") || 0);
    return result * (direction === "desc" ? -1 : 1) || a.id.localeCompare(b.id);
  });
}
export function libraryDate(value: string | undefined, locale: string): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
