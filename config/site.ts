export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Buddy Budget",
  description: "Take control of your financial future with Buddy Budget - the intuitive app that makes budgeting simple and smart.",
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
      active: true,
    },
    {
      id : "facebook",
      name : "Facebook",
      icon: "logos:facebook",
      active: true,
    }
  ]
};
