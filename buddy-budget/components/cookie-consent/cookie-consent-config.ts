import type { CookieConsentConfig } from "vanilla-cookieconsent";

export const cookieConsentConfig: CookieConsentConfig = {
  guiOptions: {
    consentModal: {
      layout: "bar inline",
      position: "bottom",
      equalWeightButtons: true,
      flipButtons: false,
    },
    preferencesModal: {
      layout: "box",
      position: "right",
      equalWeightButtons: true,
      flipButtons: false,
    },
  },

  categories: {
    necessary: {
      readOnly: true,
    },
    functionality: {},
    analytics: {},
    marketing: {},
  },

  disablePageInteraction: true,

  language: {
    default: "en",
    autoDetect: "browser",
    translations: {
      en: {
        consentModal: {
          title: "Hello traveller, it's cookie time!",
          description:
            "We use cookies to enhance your experience, analyze traffic, and deliver personalized content. You can customize your preferences or accept all cookies.",
          acceptAllBtn: "Accept all",
          acceptNecessaryBtn: "Reject all",
          showPreferencesBtn: "Manage preferences",
          footer:
            '<a href="/privacy">Privacy Policy</a>\n<a href="/terms">Terms and conditions</a>',
        },
        preferencesModal: {
          title: "Consent Preferences Center",
          acceptAllBtn: "Accept all",
          acceptNecessaryBtn: "Reject all",
          savePreferencesBtn: "Save preferences",
          closeIconLabel: "Close modal",
          serviceCounterLabel: "Service|Services",
          sections: [
            {
              title: "Cookie Usage",
              description:
                "We use cookies to improve your experience and deliver personalized content. You can choose which categories to accept.",
            },
            {
              title:
                'Strictly Necessary Cookies <span class="pm__badge">Always Enabled</span>',
              description:
                "These cookies are required for the website to function properly. They enable core functionality such as security, theme preferences, and session management.",
              linkedCategory: "necessary",
            },
            {
              title: "Functionality Cookies",
              description:
                "These cookies enable the website to provide enhanced functionality and personalization. They may be set by us or by third party providers whose services we have added to our pages.",
              linkedCategory: "functionality",
            },
            {
              title: "Analytics Cookies",
              description:
                "These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously.",
              linkedCategory: "analytics",
            },
            {
              title: "Advertisement Cookies",
              description:
                "These cookies are used to deliver advertisements more relevant to you and your interests. They may also be used to limit the number of times you see an advertisement.",
              linkedCategory: "marketing",
            },
            {
              title: "More information",
              description:
                'For any query in relation to our policy on cookies and your choices, please <a class="cc__link" href="https://github.com/YonderUrik/buddy-budget/issues">contact us</a>.',
            },
          ],
        },
      },
    },
  },
};
