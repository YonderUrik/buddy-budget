
export const paths = {
   root: "/",
   login: "/login",
   register: "/register",
   dashboard: "/dashboard",
   accounts: "/dashboard/accounts",
   transactions: "/dashboard/transactions",
   categories: "/dashboard/categories",
   support: "/support",
   terms: "/terms",
   privacy: "/privacy",
   onboarding: "/onboarding",
   profile: "/dashboard/profile",
   verifyCode: (type, user_id) => `/verify?type=${type}&id=${user_id}`,
   forgotPassword: "/forgot-password",
}