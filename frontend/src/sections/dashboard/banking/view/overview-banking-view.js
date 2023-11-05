'use client';

import { useCallback, useEffect, useState } from 'react';

import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';

import axios from 'src/utils/axios';

import { useSnackbar } from 'src/components/snackbar';
import { useSettingsContext } from 'src/components/settings';

import BankingWidgetSummary from '../banking-widget-summary';
import BankingCurrentBalance from '../banking-current-balance';
import BankingQuickTransaction from '../banking-quick-transaction';
import BankingRecentTransitions from '../banking-recent-transitions';
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { DateRangePicker } from 'react-date-range';
import { Button, Popover } from '@mui/material';
import subMonths from 'date-fns/subMonths';
import startOfMonth from 'date-fns/startOfMonth';
import endOfMonth from 'date-fns/endOfMonth';
import format from 'date-fns/format';
import { formatRange } from 'src/utils/format-time';

// ----------------------------------------------------------------------

export default function OverviewBankingView() {
  const { enqueueSnackbar } = useSnackbar();
  const [bankList, setBankList] = useState([]);
  const [categories, setCategories] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summaryChart, setSummaryChart] = useState(null);
  const [selection, setSelection] = useState({
    startDate: startOfMonth(new Date()),
    endDate: new Date(),
    key: 'selection',
  });
  const settings = useSettingsContext();

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
    try {
      const response = await axios.get('/api/banking/get-banks');
      const { data } = response;
      setBankList(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
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
    try {
      const response = await axios.post('/api/banking/get-summary-chart', {
        startDate: selection.startDate,
        endDate: selection.endDate,
      });
      const { data } = response;
      setSummaryChart(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
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
      <Stack sx={{ my: 1, width: 300 }}>
        <Button aria-describedby={id} variant="outlined" onClick={handleClick}>
          {formatRange(selection.startDate, selection.endDate)}
        </Button>
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

      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            {summaryChart && (
              <BankingWidgetSummary title="Income/Expense" chart={summaryChart} />
            )}
          </Stack>
        </Grid>

        <Grid xs={12} md={6}>
          <BankingCurrentBalance
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

        <Grid xs={12} md={4}>
          <Stack spacing={3}>
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
          </Stack>
        </Grid>

        <Grid xs={12} md={8}>
          <Stack spacing={3}>
            {categories && (
              <BankingRecentTransitions
                title="Recent Transitions"
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
            )}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
