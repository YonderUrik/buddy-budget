import PropTypes from 'prop-types';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';
import startOfMonth from 'date-fns/startOfMonth';

import { useResponsive } from 'src/hooks/use-responsive';

import Chart, { useChart } from 'src/components/chart';
import { Button, ButtonBase, IconButton, MenuItem, Popover, Tooltip } from '@mui/material';
import Iconify from 'src/components/iconify';
import { useCallback, useEffect, useState } from 'react';
import { DateRangePicker } from 'react-date-range';
import { usePopover } from 'src/components/custom-popover';
import CustomPopover from 'src/components/custom-popover/custom-popover';
import axios from 'src/utils/axios';

// ----------------------------------------------------------------------

export const monthOptions = [
  { label: 'All year', value: -1 },
  { label: 'Jan', value: 1 },
  { label: 'Feb', value: 2 },
  { label: 'Mar', value: 3 },
  { label: 'Apr', value: 4 },
  { label: 'May', value: 5 },
  { label: 'Jun', value: 6 },
  { label: 'Jul', value: 7 },
  { label: 'Aug', value: 8 },
  { label: 'Sep', value: 9 },
  { label: 'Oct', value: 10 },
  { label: 'Nov', value: 11 },
  { label: 'Dec', value: 12 },
];

export default function BankingExpensesCategories({
  title,
  subheader,
  chart,
  categoryMonthSelected,
  categoryYearSelected,
  handleChangeMonth,
  handleChangeYear,
  ...other
}) {
  const thema = useTheme();

  const smUp = useResponsive('up', 'sm');

  const { series } = chart;

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
      show: smUp ? true : false,
      formatter(seriesName, opts) {
        const total = opts.w.globals.series[opts.seriesIndex].reduce((acc, val) => acc + val, 0);
        return `${seriesName} : €${total.toFixed(2)}`;
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
      shared: false,
      followCursor: true,
      x: {
        show: false,
      },
      y: {
        formatter: function (value, { series, seriesIndex, dataPointIndex, w }) {
          return `€${value.toFixed(2)}`;
        },
      },
      marker: {
        show: true,
      },
    },
    title: {
      text: 'Expenses Categories',
      align: 'center',
    },
  });

  const [yearOptions, setYearOptions] = useState([]);

  const getYearOptions = useCallback(async () => {
    try {
      const response = await axios.post('/api/banking/get-distinct-user-data-year');
      const { data } = response;
      setYearOptions(data);
    } catch (error) {
      console.error('error on extracting year options');
    }
  }, []);

  useEffect(() => {
    getYearOptions();
  }, [getYearOptions]);

  const popoverMonth = usePopover();
  const popoverYear = usePopover();

  return (
    <Card
      sx={{
        borderRadius: 1,
        border: (theme) => `dashed 1px ${theme.palette.divider}`,
      }}
      {...other}
    >
      <CardHeader
        sx={{ pb: 0, pt: 1, pl: 1 }}
        action={
          <>
            {/* MONTH */}
            <ButtonBase
              onClick={popoverMonth.onOpen}
              sx={{
                pl: 1,
                py: 0.5,
                pr: 0.5,
                borderRadius: 1,
                typography: 'subtitle2',
                bgcolor: 'background.neutral',
              }}
            >
              {monthOptions.find((month) => month.value === categoryMonthSelected).label}

              <Iconify
                width={16}
                icon={
                  popoverMonth.open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                }
                sx={{ ml: 0.5 }}
              />
            </ButtonBase>
            <CustomPopover
              open={popoverMonth.open}
              onClose={popoverMonth.onClose}
              sx={{ width: 140 }}
            >
              {monthOptions.map((option) => (
                <MenuItem
                  key={option.label}
                  selected={option.value === categoryMonthSelected}
                  onClick={() => {
                    popoverMonth.onClose();
                    handleChangeMonth(option.value);
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </CustomPopover>
            {/* YEAR */}
            <ButtonBase
              onClick={popoverYear.onOpen}
              sx={{
                pl: 1,
                py: 0.5,
                pr: 0.5,
                borderRadius: 1,
                typography: 'subtitle2',
                bgcolor: 'background.neutral',
              }}
            >
              {yearOptions.find((year) => year === categoryYearSelected)}

              <Iconify
                width={16}
                icon={
                  popoverYear.open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                }
                sx={{ ml: 0.5 }}
              />
            </ButtonBase>
            <CustomPopover
              open={popoverYear.open}
              onClose={popoverYear.onClose}
              sx={{ width: 140 }}
            >
              {yearOptions.map((option) => (
                <MenuItem
                  key={option}
                  selected={option === categoryYearSelected}
                  onClick={() => {
                    popoverYear.onClose();
                    handleChangeYear(option);
                  }}
                >
                  {option}
                </MenuItem>
              ))}
            </CustomPopover>
          </>
        }
      />
      <Box
        sx={{
          p: 0,
          m: 1,
          '& .apexcharts-legend': {
            m: 'auto',
            flexWrap: { sm: 'wrap' },
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
  categoryMonthSelected: PropTypes.number,
  categoryYearSelected: PropTypes.number,
  handleChangeMonth: PropTypes.func,
  handleChangeYear: PropTypes.func,
};
