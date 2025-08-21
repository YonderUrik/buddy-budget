export const plans = [
  {
    id: "growth",
    tier: "PRO" as const,
    monthlyPrice: 1.99,
    monthlyProductId: "prod_Su3BrIbRdfUQ0D",
    monthlyPricePaymentLink: process.env.NODE_ENV !== "production" ? "https://buy.stripe.com/test_14A7sK1Jm1M95HDf7t57W00" : '',
    yearlyPrice: 20,
    yearlyProductId: "prod_Su3ELM4KzDhKuG",
    yearlyPricePaymentLink: process.env.NODE_ENV !== "production" ? "https://buy.stripe.com/test_aFa14mafS1M93zvaRd57W01" : '',
  },
  {
    id: "legacy",
    tier: "LEGACY" as const,
    monthlyPrice: 7.99,
    monthlyProductId: "prod_Su3EGtjo7RjDfX",
    monthlyPricePaymentLink: process.env.NODE_ENV !== "production" ? "https://buy.stripe.com/test_cNi6oGbjWduR7PLf7t57W02" : '',
    yearlyPrice: 80,
    yearlyProductId: "prod_Su3FfiuqVNKrQg",
    yearlyPricePaymentLink: process.env.NODE_ENV !== "production" ? "https://buy.stripe.com/test_cNi4gyafS76tee9cZl57W03" : '',
  }
];

export function getPlanTierFromProductId(productId: string): 'PRO' | 'LEGACY' | null {
  for (const plan of plans) {
    if (plan.monthlyProductId === productId || plan.yearlyProductId === productId) {
      return plan.tier;
    }
  }
  return null;
}