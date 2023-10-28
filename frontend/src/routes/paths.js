// ----------------------------------------------------------------------

const ROOTS = {
  AUTH: '/auth',
  HOME: '/dashboard',
};

// ----------------------------------------------------------------------

export const paths = {
  // AUTH
  auth: {
    jwt: {
      login: `${ROOTS.AUTH}/login`,
      register: `${ROOTS.AUTH}/register`,
      forgotPassword : `${ROOTS.AUTH}/forgot-password`,
      resetPassword : `${ROOTS.AUTH}/reset-password`
    },
  },
  // HOME
  app: {
    root: ROOTS.HOME,
    banking : `${ROOTS.HOME}/banking`,
    account : `${ROOTS.HOME}/account`,
    assets : `${ROOTS.HOME}/assets`
  },
};
