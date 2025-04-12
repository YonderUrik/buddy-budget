
export const paths = {
   root: "/",
   login: "/login",
   register: "/register",
   dashboard: "/dashboard",
   support: "/support",
   terms: "/terms",
   privacy: "/privacy",
   onboarding: "/onboarding",
   verifyCode: (type, user_id) => `/verify?type=${type}&id=${user_id}`,
   forgotPassword: "/forgot-password",
}