import PropTypes from 'prop-types';
import ApexCharts from 'react-apexcharts';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import { useTheme, alpha } from '@mui/material/styles';

import { useResponsive } from 'src/hooks/use-responsive';

import Chart, { useChart } from 'src/components/chart';

// ----------------------------------------------------------------------

export default function BankingExpensesCategories({ title, subheader, chart, ...other }) {
  const thema = useTheme();

  const smUp = useResponsive('up', 'sm');

  const { colors, series, options } = chart;

  const chartOptions = useChart({
    colors: [
      thema.palette.primary.main,
      thema.palette.secondary.main,
      thema.palette.success.main,
      thema.palette.info.main,
      thema.palette.warning.main,
      thema.palette.error.main,
    ],
    legend: {
      show: true,
      position: 'bottom',
      formatter (seriesName, opts) {
        const total = opts.w.globals.series[opts.seriesIndex].reduce((acc, val) => acc + val, 0);
        return `${seriesName} (Sum: €${total.toFixed(2)})`; // Adjust the formatting as needed
      },
    },
    dataLabels: {
      enabled: true,
      dropShadow: {
        enabled: false,
      },
    },
    tooltip: {
      fillSeriesColor: false,
    },
    ...options,
  });

  return (
    <Card
      sx={{
        width: 1,
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
        border: (theme) => `dashed 1px ${theme.palette.divider}`,
      }}
      {...other}
    >
      <CardHeader title={title} subheader={subheader} />

      <Box
        sx={{
          p: 0,
          m: 2,
          '& .apexcharts-legend': {
            m: 'auto',
            height: { sm: 160 },
            flexWrap: { sm: 'wrap' },
            width: { xs: 240, sm: '50%' },
          },
          '& .apexcharts-datalabels-group': {
            display: 'none',
          },
        }}
      >
        <Chart
          sx={{ p: 0, m: 0 }}
          type="treemap"
          series={series}
          options={chartOptions}
          width="100%"
          height={smUp ? 520 : 280}
        />
      </Box>
    </Card>
  );
}

BankingExpensesCategories.propTypes = {
  chart: PropTypes.object,
  subheader: PropTypes.string,
  title: PropTypes.string,
};
