import PropTypes from 'prop-types';
import ReactApexChart from 'react-apexcharts';

import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------

export default function AnalyticsWidgetSummary({
  title,
  total,
  icon,
  color = 'primary',
  sx,
  ...other
}) {
  const themeSetting = useTheme();

  return (
    <Stack
      sx={{
        bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
        border: (theme) => `dashed 1px ${theme.palette.divider}`,
        // py: 5,
        borderRadius: 2,
        ...sx,
      }}
      {...other}
    >
      <ReactApexChart
        options={{
          chart: {
            height: 200,
            type: 'radialBar',
            offsetY: -10,
          },
          plotOptions: {
            radialBar: {
              startAngle: -135,
              endAngle: 135,
              hollow: {
                margin: 0,
                size: '60%',
                background: 'transparent',
                image: undefined,
                imageOffsetX: 0,
                imageOffsetY: 0,
                position: 'front',
                dropShadow: {
                  enabled: true,
                  top: 3,
                  left: 0,
                  blur: 4,
                  opacity: 0.24,
                },
              },
              track: {
                background: themeSetting.palette.background.default,
                strokeWidth: '60%',
                margin: 0, // margin is in pixels
                dropShadow: {
                  enabled: true,
                  top: -3,
                  left: 0,
                  blur: 100,
                  opacity: 0.1,
                },
              },

              dataLabels: {
                show: true,
                name: {
                  offsetY: -10,
                  show: true,
                  color: themeSetting.palette.primary.main,
                  fontSize: '17px',
                },
                value: {
                  formatter (val) {
                    return parseInt(val);
                  },
                  color: themeSetting.palette.primary.main,
                  fontSize: '36px',
                  show: true,
                },
              },
            },
          },
          fill: {
            colors: total > 100 ? ['transparent'] : [themeSetting.palette.primary.main],
          },
          stroke: {
            dashArray: 5
          },
          labels: [title],
        }}
        series={[total]}
        type="radialBar"
        width="100%"
      />
    </Stack>
  );
}

AnalyticsWidgetSummary.propTypes = {
  color: PropTypes.string,
  icon: PropTypes.oneOfType([PropTypes.element, PropTypes.string]),
  sx: PropTypes.object,
  title: PropTypes.string,
  total: PropTypes.number,
};
