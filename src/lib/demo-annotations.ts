import type { Annotation, Geometry } from "./types";

// Synthetic examples only: these are editing demonstrations, not road advice.
export function demoAnnotations(geometry: Geometry): Annotation[] {
  const segment = geometry.reduce(
    (a, b) => (a.length > b.length ? a : b),
    [] as Geometry[number],
  );
  if (segment.length < 50) throw Error("Demo requires at least 50 points");
  const point = (fraction: number) =>
    segment[Math.round((segment.length - 1) * fraction)].id;
  const colors = [
    "#2563eb",
    "#16a34a",
    "#f97316",
    "#9333ea",
    "#dc2626",
    "#0891b2",
  ];
  const sections = [
    "Cycle lane example / Пример велодорожки",
    "Smooth surface example / Пример ровного покрытия",
    "Slow section example / Пример медленного участка",
    "Scenic section example / Пример видового участка",
    "Rough surface example / Пример неровного покрытия",
    "Return leg example / Пример обратного пути",
  ];
  const stops = [
    "Start of the ride notes / Начало заметок о поездке",
    "Water stop / Остановка за водой",
    "Bike parking / Велопарковка",
    "Viewpoint / Видовая точка",
    "Surface change / Смена покрытия",
    "Crossing / Пересечение",
    "Rest stop / Остановка для отдыха",
    "Turn to review / Поворот для проверки",
    "Photo stop / Остановка для фото",
    "Repair stop / Остановка для ремонта",
    "Narrow passage / Узкий проезд",
    "Meeting point / Место встречи",
    "Coffee stop / Остановка на кофе",
    "Short climb / Небольшой подъём",
    "Sheltered stop / Остановка под навесом",
    "GPS correction example / Пример исправления GPS",
    "Alternative turn / Альтернативный поворот",
    "Final rest stop / Последняя остановка",
  ];
  return [
    ...sections.map((text, index) => ({
      id: `demo-segment-${index + 1}`,
      startId: point(0.18 + index * 0.105),
      endId: point(0.25 + index * 0.105),
      color: colors[index],
      text,
    })),
    ...stops.map((text, index) => ({
      id: `demo-point-${index + 1}`,
      startId: point(0.18 + index * 0.037),
      endId: point(0.18 + index * 0.037),
      color: colors[index % colors.length],
      text: `Demo ${index + 1}: ${text}`,
    })),
  ];
}
