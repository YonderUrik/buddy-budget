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
  onboarding?: {
    selected: string;
    hello: string;
    titleBefore: string;
    description: string;
    mobileKicker?: string;
    mobilePoints?: Array<string>;
    whatTitle: string;
    whatItems: Array<string>;
    fieldDescriptions?: Array<string>;
    options?: {
      countries?: Array<string>;
      currencies?: Array<string>;
      discovery?: Array<string>;
      experience?: Array<string>;
      goals?: Array<string>;
    };
    searchPlaceholder?: string;
    currencyLabel?: string;
    netWorthLabels?: {
      lessThan: string;
      between: string;
      moreThan: string;
    };
    back?: string;
    next?: string;
    primaryCta: string;
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
      cookies?: string;
    };
    lastUpdatedLabel: string;
    questions: string;
    cookieBanner?: {
      title: string;
      description: string;
      policy: string;
      accept: string;
      reject: string;
    };
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
    cookies?: {
      title: string;
      sections: Array<{
        title: string;
        body: string[];
      }>;
    };
  };
  dashboard: {
    dock: {
      home: string;
      accounts: string;
      transactions: string;
      investments: string;
      reports: string;
      profile: string;
      settings?: string;
      categories?: string;
      logout?: string;
      support?: string;
      upgrade?: string;
    }
    categoriesPage?: {
      filters?: {
        all?: string;
        expense?: string;
        income?: string;
        transfer?: string;
      };
      actions?: {
        new?: string;
        edit?: string;
        save?: string;
        create?: string;
        cancel?: string;
        delete?: string;
      };
      fields?: {
        name?: string;
        type?: string;
        icon?: string;
        color?: string;
        searchPlaceholder?: string;
      };
      modal?: {
        titleNew?: string;
        titleEdit?: string;
        deleteConfirmTitle?: string;
        deleteConfirmDesc?: string;
      };
      states?: {
        loading?: string;
        empty?: string;
        errorLoad?: string;
        errorGeneric?: string;
      };
      types?: {
        expense?: { title?: string; desc?: string };
        income?: { title?: string; desc?: string };
        transfer?: { title?: string; desc?: string };
      };
    };
  },
  categories: {
    salary: string;
    bonuses: string;
    investments: string;
    rental_income: string;
    interest_income: string;
    gift_income: string;
    other_income: string;
    rent_mortgage: string;
    utilities: string;
    internet_phone_tv: string;
    groceries: string;
    clothing: string;
    dining_out: string;
    car_maintenance: string;
    fuel: string;
    car_insurance: string;
    car_taxes: string;
    public_transport: string;
    parking: string;
    health_insurance: string;
    medical_bills: string;
    pharmacy: string;
    fitness: string;
    book_courses: string;
    streaming_services: string;
    hobbies: string;
    vacations: string;
    taxes: string;
    gifts_donations: string;
    bank_transfer: string;
    cash_withdrawal: string;
  },
  accounts: {
    title: string;
    CASH: string;
    CHECKING: string;
    SAVINGS: string;
    CREDIT_CARD: string;
    INVESTMENT: string;
    failedToLoad: string;
    failedToCreate: string;
    failedToStartBankLink: string;
    failedToLoadInstitutions: string;
    failedToUpdate: string;
    failedToDelete: string;
    addAccount: string;
    loading: string;
    last90Days: string;
    noAccounts: string;
    createManualAccount: string;
    createBankAccount: string;
    chooseMethod: string;
    manualAccountDescription: string;
    bankAccountDescription: string;
    connectionFailed: string;
    manually : {
      title: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
      features : Array<{
        icon: string;
        title: string;
        desc: string;
      }>;
    },
    bank: {
      title: string;
      description: string;
      primaryCta: string;
      secondaryCta: string;
      features : Array<{
        icon: string;
        title: string;
        desc: string;
      }>;
    },
    form: {
      accountName: string;
      accountNamePlaceholder: string;
      accountType: string;
      currency: string;
      initialBalance: string;
      institutionName: string;
      institutionNamePlaceholder: string;
      icon: string;
      color: string;
      back: string;
      createAccount: string;
      editAccount: string;
      searchInstitutions: string;
      noInstitutions: string;
      connectingInstitution: string;
      connectingInstitutionDescription: string;
      loadingInstitutions: string;
      linkedAccount: string;
      linkedAccountDescription: string;
      cancel: string;
      save: string;
      deleteAccount: string;
      deleteAccountDescription: string;
      confirmDeleteAccount: string;
    },
    psd2: {
      steps: Array<{
        text: string;
        icon: string;
      }>;
      connectionFailed: string;
      tryAgain: string;
      backToAccounts: string;
      success: string;
      successDescription: string;
      goToAccounts: string;
    }
  },
  pricing: {
    kicker: string;
    heading: string;
    description: string;
    monthlyToggle: string;
    yearlyToggle: string;
    yearlyDiscount: string;
    mostPopular: string;
    getStarted: string;
    choosePlan: string;
    currentPlan: string;
    plans: {
      free: {
        name: string;
        title: string;
        price: string;
        description: string;
        features: string[];
      };
      pro: {
        name: string;
        price: string;
        yearlyPrice: string;
        description: string;
        features: string[];
      };
      premium: {
        name: string;
        price: string;
        yearlyPrice: string;
        description: string;
        features: string[];
      };
    };
    comparison: {
      features: Array<{
        name: string;
        free: string | boolean;
        pro: string | boolean;
        premium: string | boolean;
      }>;
    };
    faq: {
      heading: string;
      items: Array<{
        q: string;
        a: string;
      }>;
    };
  },
  upgrade: {
    badge: string;
    title: string;
    titleAccent: string;
    description: string;
    currentSubscription: {
      title: string;
      description: string;
      manageButton: string;
    };
    choosePlan: {
      title: string;
      description: string;
    };
    helpCards: {
      paymentMethods: {
        title: string;
        description: string;
      };
      subscriptionSettings: {
        title: string;
        description: string;
      };
      premiumFeatures: {
        title: string;
        description: string;
      };
    };
    security: {
      badge: string;
    };
  }
}