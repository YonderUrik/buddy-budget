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
  1000 : '#0B1019',
};

export const primary = {
  lighter: '#FDF4D7',
  light: '#F7D186',
  main: '#E69C37',
  dark: '#A55F1B',
  darker: '#6E330A',
  contrastText: '#FFFFFF',
};

export const secondary = {
  lighter: '#D3D4F8',
  light: '#787BDA',
  main: '#222485',
  dark: '#11125F',
  darker: '#06073F',
  contrastText: '#FFFFFF',
};

export const info = {
  lighter: '#D8F6FE',
  light: '#89D8FE',
  main: '#3CA9FC',
  dark: '#1E63B5',
  darker: '#0B3178',
  contrastText: '#FFFFFF',
};

export const success = {
  lighter: '#D3FCD2',
  light: '#77ED8B',
  main: '#22C55E',
  dark: '#118D57',
  darker: '#065E49',
  contrastText: '#FFFFFF',
};

export const warning = {
  lighter: '#FFF9CD',
  light: '#FFE969',
  main: '#FFD105',
  dark: '#B78F02',
  darker: '#7A5A00',
  contrastText: grey[800],
};

export const error = {
  lighter: '#FDE6D6',
  light: '#F6A084',
  main: '#E34234',
  dark: '#A31A25',
  darker: '#6C0922',
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
      paper: grey[900],
      default: grey[1000],
      neutral: alpha(grey[500], 0.12),
    },
    action: {
      ...base.action,
      active: grey[500],
    },
  };

  return mode === 'light' ? light : dark;
}
