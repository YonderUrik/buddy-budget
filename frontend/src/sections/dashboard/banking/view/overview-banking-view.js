'use client';

import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { useCallback, useEffect, useState } from 'react';

import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import { useTheme, alpha } from '@mui/material/styles';

import axios from 'src/utils/axios';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings'; // theme css file
import format from 'date-fns/format';
import subMonths from 'date-fns/subMonths';
import endOfMonth from 'date-fns/endOfMonth';
import startOfMonth from 'date-fns/startOfMonth';
import { DateRangePicker } from 'react-date-range';

import {
  Backdrop,
  Button,
  ButtonGroup,
  CircularProgress,
  Dialog,
  Popover,
  Tooltip,
} from '@mui/material';

import { useBoolean } from 'src/hooks/use-boolean';

import { formatRange } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { bgGradient } from 'src/theme/css';

import Iconify from 'src/components/iconify';

import BankingRecentTransitions from '../banking-recent-transitions'; // main style file

import BankingWidgetSummary from '../banking-widget-summary';
import BankingCurrentBalance from '../banking-current-balance';
import BankingQuickTransaction from '../banking-quick-transaction';

// ----------------------------------------------------------------------

export default function OverviewBankingView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [bankList, setBankList] = useState([]);
  const [categories, setCategories] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summaryChart, setSummaryChart] = useState(null);
  const transactionOpen = useBoolean();
  const [summaryChartLoading, setSummaryChartLoading] = useState(false);
  const [bankListLoading, setBankListLoading] = useState(false);
  const [selection, setSelection] = useState({
    startDate: startOfMonth(new Date()),
    endDate: new Date(),
    key: 'selection',
  });
  const settings = useSettingsContext();

  const sumOutAmounts = transactions
    .filter((transaction) => transaction.type === 'out')
    .reduce((total, transaction) => total + transaction.amount, 0);

  const getTransactions = useCallback(async () => {
    try {
      const response = await axios.post('/api/banking/get-transactions', {
        startDate: selection.startDate,
        endDate: selection.endDate,
      });
      const { data } = response;
      setTransactions(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, [enqueueSnackbar, selection]);

  const getBankList = useCallback(async () => {
    setBankListLoading(true);
    try {
      const response = await axios.get('/api/banking/get-banks');
      const { data } = response;
      setBankList(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setBankListLoading(false);
    }
  }, [enqueueSnackbar]);

  const getCategories = useCallback(async () => {
    try {
      const response = await axios.get('/api/banking/get-categories');
      const { data } = response;
      setCategories(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const getSummaryChart = useCallback(async () => {
    setSummaryChartLoading(true);
    try {
      const response = await axios.post('/api/banking/get-summary-chart', {
        startDate: selection.startDate,
        endDate: selection.endDate,
      });
      const { data } = response;
      setSummaryChart(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setSummaryChartLoading(false);
    }
  }, [enqueueSnackbar, selection]);

  useEffect(() => {
    getBankList();
  }, [getBankList]);

  useEffect(() => {
    getCategories();
  }, [getCategories]);

  useEffect(() => {
    getTransactions();
  }, [getTransactions]);

  useEffect(() => {
    getSummaryChart();
  }, [getSummaryChart]);

  const refreshBanks = () => {
    getBankList();
    getTransactions();
  };

  const refreshTransactions = () => {
    getTransactions();
    getSummaryChart();
  };

  const [anchorEl, setAnchorEl] = useState(null);

  const handleSelect = (ranges) => {
    setSelection(ranges.selection);
  };

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? 'date-range-popover' : undefined;

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Stack direction="row" spacing={2}>
        <Stack sx={{ my: 1, width: 160 }}>
          <Button variant="contained" color="primary" onClick={transactionOpen.onTrue}>
            <Iconify icon="mingcute:add-circle-fill" />
            Add transaction
          </Button>
          <Dialog
            maxWidth="sm"
            fullWidth
            open={transactionOpen.value}
            onClose={transactionOpen.onFalse}
          >
            {categories && bankList && (
              <BankingQuickTransaction
                refreshBanks={() => refreshBanks()}
                refreshTransactions={() => refreshTransactions()}
                currentBalance={bankList[0]?.balance || 0}
                bankOptions={bankList
                  .filter((item) => item.cardName !== 'Total')
                  .map((item) => item.cardName)}
                categories={categories}
                title="Quick Transaction"
              />
            )}
          </Dialog>
        </Stack>
        <Stack sx={{ my: 1, width: 300 }}>
          <ButtonGroup variant="outlined">
            <Button aria-describedby={id} variant="outlined" onClick={handleClick}>
              {formatRange(selection.startDate, selection.endDate)}
            </Button>
            <Tooltip title="Reset range">
              <Button
                variant="outlined"
                onClick={() =>
                  setSelection({
                    startDate: startOfMonth(new Date()),
                    endDate: new Date(),
                    key: 'selection',
                  })
                }
              >
                <Iconify icon="mingcute:refresh-3-line" />
              </Button>
            </Tooltip>
          </ButtonGroup>
          <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <DateRangePicker ranges={[selection]} onChange={handleSelect} />
          </Popover>
        </Stack>
      </Stack>

      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            {summaryChartLoading || !summaryChart ? (
              <Stack
                sx={{
                  ...bgGradient({
                    direction: '135deg',
                    startColor: alpha(theme.palette.background.neutral, 1),
                    endColor: alpha(theme.palette.background.neutral, 1),
                  }),
                  width: 1,
                  height: 280,
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                  color: `info.darker`,
                  backgroundColor: 'common.white',
                  alignContent: 'center',
                  alignItems: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress color="primary" />
              </Stack>
            ) : (
              <BankingWidgetSummary title="Income/Expense" chart={summaryChart} />
            )}
          </Stack>
        </Grid>

        <Grid xs={12} md={6}>
          <BankingCurrentBalance
            isLoading={bankListLoading}
            refreshBanks={() => refreshBanks()}
            list={
              bankList.length > 0
                ? bankList
                : [
                    {
                      _id: -1,
                      balance: 0,
                      lastUpdate: '',
                      cardName: 'You have not yet added a bank account',
                    },
                  ]
            }
          />
        </Grid>

        <Grid xs={12} md={12}>
          <Stack spacing={2}>
            <BankingRecentTransitions
              title="Recent Transitions"
              subheader={`Total spent : ${fCurrency(sumOutAmounts)}`}
              tableData={transactions}
              categories={categories}
              refreshBanks={() => refreshBanks()}
              refreshTransactions={() => refreshTransactions()}
              tableLabels={[
                { id: 'cardName', label: 'Bank' },
                { id: 'date', label: 'Date' },
                { id: 'amount', label: 'Amount' },
                { id: 'type', label: 'Type' },
                { id: 'categoryId', label: 'Category' },
                { id: '' },
              ]}
            />
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
