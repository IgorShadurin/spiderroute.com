import { z } from "zod";

const webUrl = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an HTTP or HTTPS link");
export type Marketplace = "wb" | "ozon" | "amazon" | "ebay";
export const marketplaceNames: Record<Marketplace, string> = {
  wb: "Wildberries",
  ozon: "Ozon",
  amazon: "Amazon",
  ebay: "eBay",
};
export function marketplaceOrder(locale: string): Marketplace[] {
  return locale === "ru"
    ? ["wb", "ozon", "amazon", "ebay"]
    : ["amazon", "ebay", "wb", "ozon"];
}
const marketplaceDomains: Record<Marketplace, string[]> = {
  wb: ["wildberries.ru", "wb.ru"],
  ozon: ["ozon.ru"],
  amazon: [
    "amazon.com",
    "amazon.co.uk",
    "amazon.ca",
    "amazon.de",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
    "amazon.co.jp",
    "amazon.in",
    "amazon.com.au",
    "amazon.com.br",
    "amazon.com.mx",
    "amazon.nl",
    "amazon.se",
    "amazon.pl",
    "amazon.com.be",
    "amazon.ie",
    "amazon.sg",
    "amazon.ae",
    "amazon.sa",
    "amazon.com.tr",
    "amazon.eg",
    "amazon.co.za",
    "amzn.to",
    "a.co",
  ],
  ebay: [
    "ebay.com",
    "ebay.co.uk",
    "ebay.ca",
    "ebay.de",
    "ebay.fr",
    "ebay.it",
    "ebay.es",
    "ebay.com.au",
    "ebay.at",
    "ebay.ch",
    "ebay.ie",
    "ebay.nl",
    "ebay.be",
    "ebay.pl",
    "ebay.com.sg",
    "ebay.com.my",
    "ebay.ph",
    "ebay.com.hk",
    "ebay.co.in",
    "ebay.us",
  ],
};
export function marketplaceUrl(value: string, marketplace: Marketplace) {
  if (!value) return "";
  if (marketplace === "amazon" && /^[a-z0-9]{10}$/i.test(value))
    return `https://www.amazon.com/dp/${value.toUpperCase()}`;
  if (marketplace === "ebay" && /^\d{9,15}$/.test(value))
    return `https://www.ebay.com/itm/${value}`;
  if (
    (marketplace === "wb" || marketplace === "ozon") &&
    /^\d{1,20}$/.test(value)
  )
    return marketplace === "wb"
      ? `https://www.wildberries.ru/catalog/${value}/detail.aspx`
      : `https://www.ozon.ru/product/${value}/`;
  const parsed = webUrl.safeParse(value);
  if (!parsed.success) throw Error("invalidInput");
  const host = new URL(parsed.data).hostname;
  if (
    !marketplaceDomains[marketplace].some(
      (domain) => host === domain || host.endsWith("." + domain),
    )
  )
    throw Error("invalidInput");
  return parsed.data;
}
const marketplace = (name: Marketplace) =>
  z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine((value) => {
      try {
        marketplaceUrl(value, name);
        return true;
      } catch {
        return false;
      }
    }, "Enter a product ID or marketplace URL");
export const setInput = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(""),
  metaTitle: z.string().trim().max(70).default(""),
  metaDescription: z.string().trim().max(160).default(""),
  locale: z.enum(["en", "ru"]).default("en"),
});
export const itemInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(3000).default(""),
    wb: marketplace("wb"),
    ozon: marketplace("ozon"),
    amazon: marketplace("amazon"),
    ebay: marketplace("ebay"),
    links: z
      .array(z.object({ label: z.string().trim().min(1).max(80), url: webUrl }))
      .max(12)
      .default([]),
  })
  .refine(
    (item) =>
      Boolean(
        item.wb || item.ozon || item.amazon || item.ebay || item.links.length,
      ),
    { message: "linkRequired", path: ["links"] },
  );
export type SetInput = z.infer<typeof setInput>;
export type ItemInput = z.infer<typeof itemInput>;
export type SetItem = ItemInput & { id: string; photo: string | null };
export type ItemSet = SetInput & {
  id: string;
  token: string | null;
  createdAt: string;
  updatedAt: string;
  items: SetItem[];
};
export function itemPhotoUrl(item: SetItem, token?: string | null) {
  return item.photo
    ? `/set-photos/${item.id}/${item.photo}${token ? `?share=${encodeURIComponent(token)}` : ""}`
    : "";
}
const seoText = (value: string, limit: number) => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= limit
    ? clean
    : clean.slice(0, limit - 1).trimEnd() + "…";
};
export function setSeoTitle(set: ItemSet) {
  return set.metaTitle.trim()
    ? seoText(set.metaTitle, 70)
    : `${seoText(set.title, 56)} · SpiderRoute`;
}
export function setDescription(set: ItemSet) {
  if (set.metaDescription.trim()) return seoText(set.metaDescription, 160);
  if (set.description.trim()) return seoText(set.description, 160);
  const names = set.items
    .slice(0, 4)
    .map((item) => item.title)
    .join(", ");
  return seoText(
    set.locale === "ru"
      ? `${set.title} — подборка вещей${names ? `: ${names}` : ""}. Фото и ссылки на магазины в одном месте.`
      : `${set.title} — a collection of items${names ? `: ${names}` : ""}. Photos and shopping links in one place.`,
    160,
  );
}

export function countedLabel(
  count: number,
  ru: boolean,
  kind: "items" | "links" = "items",
) {
  if (!ru)
    return `${count} ${kind === "items" ? (count === 1 ? "item" : "items") : count === 1 ? "link" : "links"}`;
  const forms =
    kind === "items"
      ? ["вещь", "вещи", "вещей"]
      : ["ссылка", "ссылки", "ссылок"];
  const category = new Intl.PluralRules("ru").select(count);
  return `${count} ${forms[category === "one" ? 0 : category === "few" ? 1 : 2]}`;
}
