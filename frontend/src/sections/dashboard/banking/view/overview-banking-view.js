'use client';

import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';
import { useSettingsContext } from 'src/components/settings';
import BankingQuickTransaction from '../banking-quick-transaction';
import BankingWidgetSummary from '../banking-widget-summary';
import BankingCurrentBalance from '../banking-current-balance';
import BankingRecentTransitions from '../banking-recent-transitions';
import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'src/components/snackbar';
import axios from 'src/utils/axios';

// ----------------------------------------------------------------------

export default function OverviewBankingView() {
  const { enqueueSnackbar } = useSnackbar();
  const [bankList, setBankList] = useState([]);
  const [categories, setCategories] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summaryChart, setSummaryChart] = useState(null);

  const settings = useSettingsContext();

  const getTransactions = useCallback(async () => {
    try {
      const response = await axios.get('/api/banking/get-transactions');
      const { data } = response;
      setTransactions(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, []);

  const getBankList = useCallback(async () => {
    try {
      const response = await axios.get('/api/banking/get-banks');
      const { data } = response;
      setBankList(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, []);

  const getCategories = useCallback(async () => {
    try {
      const response = await axios.get('/api/banking/get-categories');
      const { data } = response;
      setCategories(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, []);

  const getSummaryChart = useCallback(async () => {
    try {
      const response = await axios.get('/api/banking/get-summary-chart');
      const { data } = response;
      console.log(data);
      setSummaryChart(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  }, []);

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
  };

  const refreshTransactions = () => {
    getTransactions();
    getSummaryChart();
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Grid container spacing={3}>
        <Grid xs={12} md={6}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            <BankingWidgetSummary
              title="Income/Expense of this month"
              chart={summaryChart}
            />
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
