export function parseVideoTime(value: string): number | undefined {
  if (!/^\d{1,5}(?::[0-5]\d){0,2}$/.test(value.trim())) return undefined;
  const seconds = value
    .trim()
    .split(":")
    .reduce((sum, part) => sum * 60 + Number(part), 0);
  return seconds <= 86400 ? seconds : undefined;
}
export function formatVideoTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
