export interface Dictionary {
  common: {
    name: string;
    description: string;
    documentation: string;
    github: string;
    poweredBy: string;
  };
  home: {
    title: {
      make: string;
      beautiful: string;
      websites: string;
    };
    subtitle: string;
    getStarted: string;
  };
  navigation: {
    home: string;
    docs: string;
    pricing: string;
    blog: string;
    about: string;
    profile: string;
    dashboard: string;
    projects: string;
    team: string;
    calendar: string;
    settings: string;
    helpFeedback: string;
    logout: string;
  };
  pages: {
    about: {
      title: string;
      content: string;
    };
    blog: {
      title: string;
      content: string;
    };
    docs: {
      title: string;
      content: string;
    };
    pricing: {
      title: string;
      content: string;
    };
  };
  landing: {
    hero: {
      titleBefore: string;
      description: string;
      primaryCta: string;
    };
    features: {
      kicker: string;
      heading: string;
      description: string;
      items: Array<{
        title: string;
        desc: string;
      }>
    };
    cta: {
      heading: string;
      description: string;
      primary: string;
      secondary?: string;
    };
    howItWorks: {
      kicker: string;
      heading: string;
      steps: Array<{
        title: string;
        desc: string;
      }>;
    };
    faq: {
      kicker: string;
      heading: string;
      items: Array<{
        q: string;
        a: string;
      }>;
    };
    metrics?: {
      items: Array<{
        label: string;
      }>;
    };
  };
  auth: {
    welcomeBack: string;
    loginToContinue: string;
    continueWith: string;
  };
  legal?: {
    nav: {
      terms: string;
      privacy: string;
    };
    lastUpdatedLabel: string;
    questions: string;
    terms: {
      title: string;
      sections: Array<{
        title: string;
        body: string[];
      }>;
    };
    privacy: {
      title: string;
      sections: Array<{
        title: string;
        body: string[];
      }>;
    };
  };
}