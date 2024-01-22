'use client';

import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import { useResponsive } from 'src/hooks/use-responsive';

import { useSettingsContext } from 'src/components/settings'; // theme css file

import {
  Card,
  LinearProgress,
  useTheme,
  alpha,
  Grid,
  Container,
  ListItemText,
  Stack,
  Box,
  CardHeader,
  CircularProgress,
  Typography,
  Avatar,
} from '@mui/material';

import axios from 'src/utils/axios';
import { fDate } from 'src/utils/format-time';
import { fNumber, fPercent } from 'src/utils/format-number';

import Chart from 'src/components/chart';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

export default function SingleAssetView({ symbol }) {
  const [symbolInfo, setSymbolinfo] = useState({});
  const [symbolInfoLoading, setSymbolInfoLoading] = useState(false);

  const [symbolHistory, setSymbolHistory] = useState([]);
  const [symbolHistoryLoading, setSymbolHistoryLoading] = useState(false);

  const [transactionHistory, setTransactionHistory] = useState([]);
  const [transactionHistoryLoading, setTransactionHistoryLoading] = useState(false);

  const settings = useSettingsContext();
  const { enqueueSnackbar } = useSnackbar();

  const themeSettings = useTheme();

  const smUp = useResponsive('up', 'sm');

  const getSymbolInfo = useCallback(async () => {
    setSymbolInfoLoading(true);
    try {
      const response = await axios.post('/api/assets/get-symbol-info', { symbol });
      const { data } = response;
      console.log(data);
      setSymbolinfo(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setSymbolInfoLoading(false);
    }
  }, [symbol, enqueueSnackbar]);

  const getSymbolHistory = useCallback(async () => {
    setSymbolHistoryLoading(true);
    try {
      const response = await axios.post('/api/assets/get-symbol-history', { symbol });
      const { data } = response;
      setSymbolHistory(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setSymbolHistoryLoading(false);
    }
  }, [symbol, enqueueSnackbar]);

  const getTransactionHistory = useCallback(async () => {
    setTransactionHistoryLoading(true);
    try {
      const response = await axios.post('/api/assets/get-transaction-history', { symbol });
      const { data } = response;
      console.log(data);
      setTransactionHistory(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setTransactionHistoryLoading(false);
    }
  }, [symbol, enqueueSnackbar]);

  useEffect(() => {
    getSymbolInfo();
    getSymbolHistory();
    getTransactionHistory();
  }, [getSymbolHistory, getTransactionHistory, getSymbolInfo]);

  const last_percentage = symbolInfo?.open && symbolInfo?.ask ? (symbolInfo.ask - symbolInfo.open) / symbolInfo.open : 0;

  // Format data for Candlestick Chart
  const formattedData = symbolHistory.map((item) => ({
    x: new Date(item.Date).getTime(),
    y: [item.Open.toFixed(2), item.High.toFixed(2), item.Low.toFixed(2), item.Close.toFixed(2)],
  }));

  const buyPoints = transactionHistory.map((transaction) => ({
    x: new Date(transaction.date).getTime(),
    y: transaction.price_in,
  }));

  // ApexCharts options and series
  const chartOptions = {
    chart: {
      toolbar: { show: true },
      zoom: { enabled: true },
      animations: { enabled: true },
      foreColor: themeSettings.palette.text.disabled,
      fontFamily: themeSettings.typography.fontFamily,
    },
    states: {
      hover: {
        filter: {
          type: 'lighten',
          value: 0.04,
        },
      },
      active: {
        filter: {
          type: 'darken',
          value: 0.88,
        },
      },
    },
    fill: {
      opacity: 1,
      gradient: {
        type: 'vertical',
        shadeIntensity: 0,
        opacityFrom: 0.4,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    // Grid
    grid: {
      strokeDashArray: 3,
      borderColor: themeSettings.palette.divider,
      xaxis: {
        lines: {
          show: false,
        },
      },
    },
    xaxis: {
      type: 'datetime',
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    markers: {
      size: 0,
      strokeColors: themeSettings.palette.background.paper,
    },
    title: {
      text: symbolInfo?.longName,
      align: 'center',
    },
    responsive: [
      {
        // sm
        breakpoint: themeSettings.breakpoints.values.sm,
        options: {
          plotOptions: { bar: { columnWidth: '40%' } },
        },
      },
      {
        // md
        breakpoint: themeSettings.breakpoints.values.md,
        options: {
          plotOptions: { bar: { columnWidth: '32%' } },
        },
      },
    ],
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Grid spacing={2} container>
        {/* ASSET INFO */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              width: 1,
              height: 300,
              borderRadius: 2,
              p: 2,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              border: (theme) => `dashed 1px ${theme.palette.divider}`,
            }}
          >
            <CardHeader
              sx={{ m: 0, p: 0 }}
              title="Info"
              action={symbolInfoLoading && <CircularProgress />}
            />
            <ListItemText primary={symbolInfo?.longName} secondary={symbolInfo?.description} />
            {symbolInfo?.legalType && (
              <ListItemText primary="Legal type:" secondary={symbolInfo?.legalType} />
            )}
            {last_percentage ? (
              <ListItemText
                primary="Last trade:"
                secondary={
                  <Stack direction="row">
                    {symbolInfo?.ask} {symbolInfo?.currency}
                    <Iconify
                      color={last_percentage < 0 ? 'error.main' : 'success.main'}
                      icon={last_percentage < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'}
                    />
                    <Box
                      color={last_percentage < 0 ? 'error.main' : 'success.main'}
                      // sx={{ typography: 'subtitle2' }}
                    >
                      {last_percentage > 0 && '+'}
                      {fPercent(last_percentage * 100)} than open
                    </Box>
                  </Stack>
                }
              />
            ) : null}
          </Card>
        </Grid>
        {/* ASSET TRANSACTIONS */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              width: 1,
              borderRadius: 2,
              height: 300,
              p: 2,
              bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
              border: (theme) => `dashed 1px ${theme.palette.divider}`,
            }}
          >
            <CardHeader
              sx={{ m: 0, p: 0 }}
              title="Transactions"
              action={transactionHistoryLoading && <CircularProgress />}
            />
            <Scrollbar>
              <Stack sx={{ my: 2 }} spacing={1}>
                {transactionHistory.map((transaction) => (
                  <TransactionItem transaction={transaction} currency={symbolInfo?.currency} />
                ))}
              </Stack>
            </Scrollbar>
          </Card>
        </Grid>
      </Grid>
      {/* ASSET HISTORY */}
      <Card
        sx={{
          mt: 2,
          p: 0,
          width: 1,
          borderRadius: 2,
          bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
          border: (theme) => `dashed 1px ${theme.palette.divider}`,
        }}
      >
        {symbolHistoryLoading && <LinearProgress />}
        <Chart
          options={chartOptions}
          series={[
            {
              data: formattedData,
            },
            // {
            //   data: buyPoints,
            //   type: 'scatter', // Use scatter type for markers
            //   marker: {
            //     size: 50, // Adjust marker size as needed
            //     symbol: 'triangle-up', // You can choose a different marker symbol
            //     fillColors: ['#00ff00'], // Marker color
            //     strokeColors: ['#000000'], // Marker border color
            //   },
            // },
          ]}
          type="candlestick"
          height={smUp ? 720 : 480}
          width="100%"
        />
      </Card>
    </Container>
  );
}

SingleAssetView.propTypes = {
  symbol: PropTypes.string,
};

function TransactionItem({ transaction, currency }) {
  const { date, amount, quantity, price_in, type } = transaction;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={2}
      sx={{ border: (theme) => `dashed 1px ${theme.palette.divider}`, p: 1, borderRadius: 2 }}
    >
      <Avatar
        variant="rounded"
        sx={{
          width: 48,
          height: 48,
          bgcolor: 'background.neutral',
        }}
      >
        <Iconify
          width={24}
          icon={type === 'sell' ? 'icons8:buy' : 'icons8:buy'}
          color={type === 'sell' ? 'error.main' : 'success.main'}
        />
      </Avatar>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {fDate(date)}
        </Typography>

        <Stack direction="row" alignItems="center" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {type === 'sell' ? '-' : '+'}

          <Typography variant="caption" sx={{ ml: 0.5, mr: 1 }}>
            {quantity}
          </Typography>

          <Label>
            {fNumber(price_in)} {currency} x stock
          </Label>
        </Stack>
      </Box>

      <Stack alignItems="flex-end">
        <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {amount} {currency} spent
        </Typography>
      </Stack>
    </Stack>
  );
}

TransactionItem.propTypes = {
  transaction: PropTypes.object,
  currency: PropTypes.string,
};
