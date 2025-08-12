export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "Buddy Budget",
  description: "Take control of your financial future with Buddy Budget - the intuitive app that makes budgeting simple and smart.",
  links: {
    github: "https://github.com/heroui-inc/heroui",
  },
  providers : [
    {
      name: "Google",
      icon: "flat-color-icons:google",
      active: true,
    },
    {
      name: "Apple",
      icon: "ic:baseline-apple",
      active: false,
    },
    {
      name : "Facebook",
      icon: "logos:facebook",
      active: false,
    }
  ]
};
