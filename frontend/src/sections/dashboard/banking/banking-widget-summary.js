import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { fPercent, fCurrency } from 'src/utils/format-number';

import { bgGradient } from 'src/theme/css';

import Iconify from 'src/components/iconify';
import Chart, { useChart } from 'src/components/chart';
import EmptyContent from 'src/components/empty-content';

// ----------------------------------------------------------------------

export default function BankingWidgetSummary({ title, chart, sx, ...other }) {
  const theme = useTheme();

  let series = [];
  let chartOptions = {};
  let lastMonthExpense = 0;
  let lastMonthIncome = 0;
  let savingRate = 0;
  let color = 'info';
  let icon = 'fluent-mdl2:unknown-solid';
  const { labels, options } = chart;
  series = chart.series; // Set the series based on the chart prop

  lastMonthIncome = series[0].data.reduce((total, income) => total + income, 0);
  lastMonthExpense = series[1].data.reduce((total, income) => total + income, 0);
  savingRate = ((lastMonthIncome - lastMonthExpense) / lastMonthIncome) * 100;

  if (savingRate > 20) {
    color = 'success';
    icon = 'fluent:emoji-48-filled';
  } else if (savingRate > 0) {
    color = 'warning';
    icon = 'fluent:emoji-meh-24-filled';
  } else if (savingRate < 0) {
    icon = 'fluent:emoji-sad-20-filled';
    color = 'error';
  }

  chartOptions = useChart({
    colors: [theme.palette[color].dark],
    labels,
    chart: {
      sparkline: {
        enabled: true,
      },
    },
    xaxis: {
      labels: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        show: false,
      },
    },
    legend: {
      show: false,
    },
    grid: {
      show: false,
    },
    tooltip: {
      marker: {
        show: false,
      },
      y: {
        formatter: (value) => fCurrency(value),
        title: {
          formatter: () => '',
        },
      },
    },
    // dataLabels: {
    //   enabled: true,
    //   position: 'inside',
    //   style: {
    //     colors: [theme.palette.grey[300]],
    //   },
    //   background: {
    //     enabled: true,
    //     foreColor: theme.palette.primary.main,
    //   },
    //   formatter(val, opt) {
    //     if (val === 0) {
    //       return '';
    //     }
    //     return `€ ${val}`;
    //   },
    // },
    ...options,
  });

  return (
    <Stack
      sx={{
        ...bgGradient({
          direction: '135deg',
          startColor: alpha(theme.palette[color].main, 0.2),
          endColor: alpha(theme.palette[color].darker, 0.2),
        }),
        width: 1,
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative',
        color: `${color}.darker`,
        backgroundColor: 'common.white',
        ...sx,
      }}
      {...other}
    >
      <Iconify
        icon={icon}
        sx={{
          p: 1.5,
          top: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: '50%',
          position: 'absolute',
          color: `${color}.lighter`,
          bgcolor: `${color}.main`,
        }}
      />

      <Stack spacing={1} sx={{ p: 3 }}>
        <Typography variant="subtitle2">{title}</Typography>

        <Typography variant="h3">
          {' '}
          {savingRate > 0 && '+'}
          {fCurrency(lastMonthIncome - lastMonthExpense)}
        </Typography>

        <Stack
          spacing={0.5}
          direction="row"
          flexWrap="wrap"
          alignItems="center"
          sx={{ typography: 'body2' }}
        >
          <Iconify icon={savingRate < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'} />

          <Box sx={{ typography: 'subtitle2' }}>
            {savingRate > 0 && '+'}
            {fPercent(savingRate)}
          </Box>

          <Box sx={{ opacity: 0.8 }}>saving rate</Box>
        </Stack>
      </Stack>

      {chart ? (
        <Chart
          sx={{ m: 0, p: 0 }}
          dir="ltr"
          type="area"
          series={[series[1]] || []}
          options={chartOptions}
          width="100%"
          height={120}
        />
      ) : null}
    </Stack>
  );
}

BankingWidgetSummary.propTypes = {
  chart: PropTypes.object,
  sx: PropTypes.object,
  title: PropTypes.string,
};
