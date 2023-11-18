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

export default function BankingNetWorth({ title, subheader, chart, ...other }) {
  const thema = useTheme();
  const smUp = useResponsive('up', 'sm');
  const { series, options } = chart;

  const chartOptions = useChart({
    colors: [
      thema.palette.primary.main,
      thema.palette.secondary.main,
      thema.palette.success.main,
      thema.palette.info.main,
      thema.palette.warning.main,
      thema.palette.error.main,
    ],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
    },
    tooltip: {
      enabled: true, // Ensure tooltips are enabled
      x: {
        format: 'dd MMM yyyy',
      },
      y: {
        formatter: (value) => `€${value.toFixed(2)}`,
      },
    },
    legend: {
      show:false,
      position: 'top',
      horizontalAlign: 'left',
    },
    xaxis: {
      type: 'datetime',
    },
    yaxis: {
      type: 'numeric',
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
          type="area" // Set the chart type to "area" for a stacked area chart
          series={series}
          options={chartOptions}
          width="100%"
          height={smUp ? 520 : 280}
        />
      </Box>
    </Card>
  );
}

BankingNetWorth.propTypes = {
  chart: PropTypes.object,
  subheader: PropTypes.string,
  title: PropTypes.string,
};
