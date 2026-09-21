import { marketplaceNames, type Marketplace } from "@/lib/item-sets";
/** Locally served favicons; no third-party requests from visitor browsers. */
export function MarketplaceLabel({
  market,
  compact = false,
}: {
  market: Marketplace;
  compact?: boolean;
}) {
  const name = market === "wb" && compact ? "WB" : marketplaceNames[market];
  return (
    <span className="marketplace-label">
      <img
        src={`/brand/${market === "wb" ? "wildberries" : market}.png`}
        width={20}
        height={20}
        alt=""
        aria-hidden="true"
      />
      {name}
    </span>
  );
}
