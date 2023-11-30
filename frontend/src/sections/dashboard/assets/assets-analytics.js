import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';

import { fShortenNumber } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

export default function AnalyticsAssets({ title, subheader, list, ...other }) {
  return (
    <Card {...other}>
      <CardHeader title={title} subheader={subheader} />

      <Box display="grid" gap={2} gridTemplateColumns="repeat(5, 1fr)" sx={{ p: 3 }}>
        <Paper
          variant="outlined"
          sx={{
            py: 2.5,
            textAlign: 'center',
            p: 3,
            borderRadius: 2,
            bgcolor: 'unset',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'background.paper',
              boxShadow: (theme) => theme.customShadows.z20,
            },
          }}
        >
          <Iconify icon="mingcute:add-circle-fill" width={32} />

          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Add new
          </Typography>

          {/* <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {site.label}
          </Typography> */}
        </Paper>
        {list.map((site) => (
          <Paper key={site.label} variant="outlined" sx={{ py: 2.5, textAlign: 'center' }}>
            <Iconify
              icon={site.icon}
              color={
                (site.value === 'facebook' && '#1877F2') ||
                (site.value === 'google' && '#DF3E30') ||
                (site.value === 'linkedin' && '#006097') ||
                (site.value === 'twitter' && '#1C9CEA') ||
                ''
              }
              width={32}
            />

            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {fShortenNumber(site.total)}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {site.label}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Card>
  );
}

AnalyticsAssets.propTypes = {
  list: PropTypes.array,
  subheader: PropTypes.string,
  title: PropTypes.string,
};
