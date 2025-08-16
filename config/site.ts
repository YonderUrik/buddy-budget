export type SiteConfig = typeof siteConfig;

export const defaultCategories = [
  // INCOMES
  {
    name : "salary",
    icon : "mdi:cash",
    color : "#22c55e",
    type : "income",
  },
  {
    name : "bonuses",
    icon : "mdi:gift",
    color : "#10b981",
    type : "income",
  },
  {
    name : "investments",
    icon : "mdi:finance",
    color : "#0ea5e9",
    type : "income",
  },
  {
    name : "rental_income",
    icon : "mdi:home-city",
    color : "#f59e0b",
    type : "income",
  },
  {
    name : "interest_income",
    icon : "mdi:percent",
    color : "#06b6d4",
    type : "income",
  },
  {
    name : "gift_income",
    icon : "mdi:gift-outline",
    color : "#ec4899",
    type : "income",
  },
  {
    name : "other_income",
    icon : "mdi:cash-multiple",
    color : "#84cc16",
    type : "income",
  },
  // EXPENSES
  {
    name : "rent_mortgage",
    icon : "mdi:home",
    color : "#ef4444",
    type : "expense",
  },
  {
    name : "utilities",
    icon : "mdi:power-plug",
    color : "#a855f7",
    type : "expense",
  },
  {
    name : "internet_phone_tv",
    icon : "mdi:access-point",
    color : "#6366f1",
    type : "expense",
  },
  {
    name : "groceries",
    icon : "mdi:cart",
    color : "#65a30d",
    type : "expense",
  },
  {
    name : "clothing",
    icon : "mdi:tshirt-crew",
    color : "#f97316",
    type : "expense",
  },
  {
    name : "dining_out",
    icon : "mdi:food-fork-drink",
    color : "#f43f5e",
    type : "expense",
  },
  {
    name : "self_care",
    icon : "mdi:spa",
    color : "#d946ef",
    type : "expense",
  },
  {
    name : "car_maintenance",
    icon : "mdi:car-wrench",
    color : "#eab308",
    type : "expense",
  },
  {
    name : "fuel",
    icon : "mdi:gas-station",
    color : "#ea580c",
    type : "expense",
  },
  {
    name : "car_insurance",
    icon : "mdi:shield-car",
    color : "#ca8a04",
    type : "expense",
  },
  {
    name : "car_taxes",
    icon : "mdi:receipt-text",
    color : "#d97706",
    type : "expense",
  },
  {
    name : "public_transport",
    icon : "mdi:bus",
    color : "#0891b2",
    type : "expense",
  },
  {
    name : "parking",
    icon : "mdi:parking",
    color : "#14b8a6",
    type : "expense",
  },
  {
    name : "health_insurance",
    icon : "mdi:heart-pulse",
    color : "#10b981",
    type : "expense",
  },
  {
    name : "medical_bills",
    icon : "mdi:clipboard-pulse-outline",
    color : "#059669",
    type : "expense",
  },
  {
    name : "pharmacy",
    icon : "mdi:pill",
    color : "#34d399",
    type : "expense",
  },
  {
    name : "fitness",
    icon : "mdi:dumbbell",
    color : "#22d3ee",
    type : "expense",
  },
  {
    name : "book_courses",
    icon : "mdi:book-open-variant",
    color : "#60a5fa",
    type : "expense",
  },
  {
    name : "streaming_services",
    icon : "mdi:television-play",
    color : "#3b82f6",
    type : "expense",
  },
  {
    name : "hobbies",
    icon : "mdi:palette",
    color : "#a3e635",
    type : "expense",
  },
  {
    name : "vacations",
    icon : "mdi:airplane",
    color : "#fbbf24",
    type : "expense",
  },
  {
    name : "taxes",
    icon : "mdi:receipt-text",
    color : "#991b1b",
    type : "expense",
  },
  {
    name : "gifts_donations",
    icon : "mdi:hand-heart",
    color : "#db2777",
    type : "expense",
  },
  // TRANSFERS
  {
    name : "bank_transfer",
    icon : "mdi:bank-transfer",
    color : "#6b7280",
    type : "transfer",
  },
  {
    name : "cash_withdrawal",
    icon : "mdi:cash-minus",
    color : "#94a3b8",
    type : "transfer",
  },
]

export const siteConfig = {
  name: "Buddy Budget",
  description: "Take control of your financial future with Buddy Budget - the intuitive app that makes budgeting simple and smart.",
  supportEmail: "support@buddybudget.app",
  links: {
    github: "https://github.com/YonderUrik/buddy-budget",
  },
  providers : [
    {
      id : "google",
      name: "Google",
      icon: "flat-color-icons:google",
      active: true,
    },
    {
      id : "apple",
      name: "Apple",
      icon: "ic:baseline-apple",
      active: false,
    },
    {
      id : "facebook",
      name : "Facebook",
      icon: "logos:facebook",
      active: false,
    }
  ]
};
