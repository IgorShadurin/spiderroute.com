import { placeIcon } from "@/lib/place-icons";
export function PlaceIcon({
  icon,
  size = 20,
}: {
  icon?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {placeIcon(icon).paths.map((d, i) => (
        <path d={d} key={i} />
      ))}
    </svg>
  );
}
