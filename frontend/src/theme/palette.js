import { alpha } from '@mui/material/styles';

// ----------------------------------------------------------------------

// SETUP COLORS

export const grey = {
  0: '#FFFFFF',
  100: '#F9FAFB',
  200: '#F4F6F8',
  300: '#DFE3E8',
  400: '#C4CDD5',
  500: '#919EAB',
  600: '#637381',
  700: '#454F5B',
  800: '#212B36',
  900: '#161C24',
};

export const primary = {
  lighter: '#EC7F6E',
  light: '#DA4F48',
  main: '#C2151C',
  dark: '#A60F22',
  darker: '#8B0A26',
  contrastText: '#FFFFFF',
};

export const secondary = {
  lighter: '#D6E4FF',
  light: '#84A9FF',
  main: '#3366FF',
  dark: '#1939B7',
  darker: '#091A7A',
  contrastText: '#FFFFFF',
};

export const info = {
  lighter: '#5CE5E7',
  light: '#33C1CF',
  main: '#0092AF',
  dark: '#007296',
  darker: '#00557D',
  contrastText: '#FFFFFF',
};

export const success = {
  lighter: '#58D883',
  light: '#2EB268',
  main: '#027F45',
  dark: '#016D45',
  darker: '#015B43',
  contrastText: '#FFFFFF',
};

export const warning = {
  lighter: '#FBDB64',
  light: '#F8CB3E',
  main: '#F4B300',
  dark: '#D19400',
  darker: '#AF7700',
  contrastText: grey[800],
};

export const error = {
  lighter: '#F1897A',
  light: '#E35C57',
  main: '#D1252E',
  dark: '#B31B30',
  darker: '#961231',
  contrastText: '#FFFFFF',
};

export const common = {
  black: '#000000',
  white: '#FFFFFF',
};

export const action = {
  hover: alpha(grey[500], 0.08),
  selected: alpha(grey[500], 0.16),
  disabled: alpha(grey[500], 0.8),
  disabledBackground: alpha(grey[500], 0.24),
  focus: alpha(grey[500], 0.24),
  hoverOpacity: 0.08,
  disabledOpacity: 0.48,
};

const base = {
  primary,
  secondary,
  info,
  success,
  warning,
  error,
  grey,
  common,
  divider: alpha(grey[500], 0.2),
  action,
};

// ----------------------------------------------------------------------

export function palette(mode) {
  const light = {
    ...base,
    mode: 'light',
    text: {
      primary: grey[800],
      secondary: grey[600],
      disabled: grey[500],
    },
    background: {
      paper: '#FFFFFF',
      default: '#FFFFFF',
      neutral: grey[200],
    },
    action: {
      ...base.action,
      active: grey[600],
    },
  };

  const dark = {
    ...base,
    mode: 'dark',
    text: {
      primary: '#FFFFFF',
      secondary: grey[500],
      disabled: grey[600],
    },
    background: {
      paper: grey[800],
      default: grey[900],
      neutral: alpha(grey[500], 0.12),
    },
    action: {
      ...base.action,
      active: grey[500],
    },
  };

  return mode === 'light' ? light : dark;
}
