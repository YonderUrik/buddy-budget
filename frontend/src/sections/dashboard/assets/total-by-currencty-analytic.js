import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { fCurrency, fShortenNumber } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

export default function TotalByCurrency({ title, invested, icon, percent, price }) {
  return (
    <Stack
      spacing={2.5}
      direction="row"
      alignItems="center"
      justifyContent="center"
      sx={{ width: 1, minWidth: 200 }}
    >
      <Stack alignItems="center" justifyContent="center" sx={{ position: 'relative' }}>
        <Iconify
          icon={`cryptocurrency-color:${title.toLowerCase()}`}
          width={32}
          sx={{ position: 'absolute' }}
        />

        <CircularProgress
          variant="determinate"
          value={0}
          size={56}
          thickness={2}
          sx={{ opacity: 0.48 }}
        />

        <CircularProgress
          variant="determinate"
          value={100}
          size={56}
          thickness={3}
          sx={{
            top: 0,
            left: 0,
            opacity: 0.48,
            position: 'absolute',
            color: (theme) => alpha(theme.palette.grey[500], 0.16),
          }}
        />
      </Stack>

      <Typography variant="subtitle1">{title}</Typography>
      <Stack spacing={1}>
        <Box component="span" sx={{ color: 'text.disabled', typography: 'body2' }}>
          {fShortenNumber(invested)} invested
        </Box>
        <Typography variant="subtitle2">{fShortenNumber(price)} current</Typography>
      </Stack>
    </Stack>
  );
}

TotalByCurrency.propTypes = {
  icon: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
  percent: PropTypes.number,
  price: PropTypes.number,
  title: PropTypes.string,
  invested: PropTypes.number,
};
