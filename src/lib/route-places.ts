import { placeIconKeys } from "./place-icons";
import { z } from "zod";
import type { RoutePlace } from "./types";
export const placeInput = z.object({
  icon: z.enum(placeIconKeys).default("pin"),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(6000).default(""),
  lat: z.number().finite().min(-85).max(85),
  lon: z.number().finite().min(-180).max(180),
});
export function placePhotoUrl(place: RoutePlace, token?: string) {
  return `/place-photos/${place.id}/${place.photo}${token ? `?share=${encodeURIComponent(token)}` : ""}`;
}
