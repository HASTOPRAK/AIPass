export const PRICING = {
  individual: [
    { key: "ind_starter", name: "Starter", credits: 100, priceLabel: "$9" },
    { key: "ind_plus", name: "Plus", credits: 300, priceLabel: "$19" },
    { key: "ind_pro", name: "Pro", credits: 800, priceLabel: "$39" },
  ],
  business: [
    { key: "biz_team", name: "Team", credits: 5000, priceLabel: "$149" },
    { key: "biz_growth", name: "Growth", credits: 12000, priceLabel: "$299" },
    { key: "biz_scale", name: "Scale", credits: 30000, priceLabel: "$599" },
  ],
};

export const PRICING_LOOKUP = Object.fromEntries(
  [...PRICING.individual, ...PRICING.business].map(p => [p.key, p])
);
