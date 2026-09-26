// Public plan terms shared by pricing copy, Stripe validation, and credit grants.
export const PRO_PLAN = {
  amountCents: 900,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
  imagesPerPeriod: 50,
} as const;

export const PRO_PRICE_LABEL = `$${PRO_PLAN.amountCents / 100}`;
