export type Subscription = { enabled: boolean; channelId: string | null };
export function channelId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 256)
    throw Error("invalidVideo");
  const text = value.trim();
  const match =
    /^(?:https:\/\/(?:www\.)?youtube\.com\/channel\/)?(UC[A-Za-z0-9_-]{22})\/?$/.exec(
      text,
    );
  if (!match) throw Error("invalidVideo");
  return match[1];
}
export function subscription(value: unknown): Subscription {
  if (value === undefined || value === null)
    return { enabled: true, channelId: null };
  if (typeof value !== "object" || Array.isArray(value))
    throw Error("invalidVideo");
  const input = value as Subscription;
  if (typeof input.enabled !== "boolean") throw Error("invalidVideo");
  return { enabled: input.enabled, channelId: channelId(input.channelId) };
}
