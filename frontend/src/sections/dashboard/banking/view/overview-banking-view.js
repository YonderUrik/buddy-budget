'use client';

import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Unstable_Grid2';

import { useSettingsContext } from 'src/components/settings';

import BankingContacts from '../banking-contacts';
import BankingQuickTransaction from '../banking-quick-transaction';
import BankingInviteFriends from '../banking-invite-friends';
import BankingWidgetSummary from '../banking-widget-summary';
import BankingCurrentBalance from '../banking-current-balance';
import BankingBalanceStatistics from '../banking-balance-statistics';
import BankingRecentTransitions from '../banking-recent-transitions';
import BankingExpensesCategories from '../banking-expenses-categories';
import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'src/components/snackbar';
import axios from 'src/utils/axios';

// ----------------------------------------------------------------------

export default function OverviewBankingView() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const [bankList, setBankList] = useState([]);
  const [categories, setCategories] = useState(null);
  const [bankIsLoading, setBankIsLoading] = useState(false);

  const settings = useSettingsContext();

  const getBankList = useCallback(async () => {
    setBankIsLoading(true);
    try {
      const response = await axios.get('/api/banking/get-banks');
      const { data } = response;
      setBankList(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setBankIsLoading(false);
    }
  }, []);

  const getCategories = useCallback(async () => {
    setBankIsLoading(true);
    try {
      const response = await axios.get('/api/banking/get-categories');
      const { data } = response;
      setCategories(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setBankIsLoading(false);
    }
  }, []);

  useEffect(() => {
    getBankList();
    getCategories();
  }, [getBankList, getCategories]);

  const refreshBanks = () => {
    getBankList();
  };

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Grid container spacing={3}>
        <Grid xs={12} md={7}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
            {/* <BankingWidgetSummary
              title="Income"
              icon="eva:diagonal-arrow-left-down-fill"
              percent={2.6}
              total={18765}
              chart={{
                series: [
                  { x: 2010, y: 88 },
                  { x: 2011, y: 120 },
                  { x: 2012, y: 156 },
                  { x: 2013, y: 123 },
                  { x: 2014, y: 88 },
                  { x: 2015, y: 66 },
                  { x: 2016, y: 45 },
                  { x: 2017, y: 29 },
                  { x: 2018, y: 45 },
                  { x: 2019, y: 88 },
                  { x: 2020, y: 132 },
                  { x: 2021, y: 146 },
                  { x: 2022, y: 169 },
                  { x: 2023, y: 184 },
                ],
              }}
            /> */}

            {/* <BankingWidgetSummary
              title="Expenses"
              color="warning"
              icon="eva:diagonal-arrow-right-up-fill"
              percent={-0.5}
              total={8938}
              chart={{
                series: [
                  { x: 2010, y: 88 },
                  { x: 2011, y: 120 },
                  { x: 2012, y: 156 },
                  { x: 2013, y: 123 },
                  { x: 2014, y: 88 },
                  { x: 2015, y: 166 },
                  { x: 2016, y: 145 },
                  { x: 2017, y: 129 },
                  { x: 2018, y: 145 },
                  { x: 2019, y: 188 },
                  { x: 2020, y: 132 },
                  { x: 2021, y: 146 },
                  { x: 2022, y: 169 },
                  { x: 2023, y: 184 },
                ],
              }}
            /> */}
          </Stack>
        </Grid>

        <Grid xs={12} md={5}>
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

        <Grid xs={12} md={8}>
          <Stack spacing={3}>
            {/* <BankingBalanceStatistics
              title="Balance Statistics"
              subheader="(+43% Income | +12% Expense) than last year"
              chart={{
                categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
                series: [
                  {
                    type: 'Week',
                    data: [
                      {
                        name: 'Income',
                        data: [10, 41, 35, 151, 49, 62, 69, 91, 48],
                      },
                      {
                        name: 'Expenses',
                        data: [10, 34, 13, 56, 77, 88, 99, 77, 45],
                      },
                    ],
                  },
                  {
                    type: 'Month',
                    data: [
                      {
                        name: 'Income',
                        data: [148, 91, 69, 62, 49, 51, 35, 41, 10],
                      },
                      {
                        name: 'Expenses',
                        data: [45, 77, 99, 88, 77, 56, 13, 34, 10],
                      },
                    ],
                  },
                  {
                    type: 'Year',
                    data: [
                      {
                        name: 'Income',
                        data: [76, 42, 29, 41, 27, 138, 117, 86, 63],
                      },
                      {
                        name: 'Expenses',
                        data: [80, 55, 34, 114, 80, 130, 15, 28, 55],
                      },
                    ],
                  },
                ],
              }}
            /> */}

            {/* <BankingExpensesCategories
              title="Expenses Categories"
              chart={{
                series: [
                  { label: 'Category 1', value: 14 },
                  { label: 'Category 2', value: 23 },
                  { label: 'Category 3', value: 21 },
                  { label: 'Category 4', value: 17 },
                  { label: 'Category 5', value: 15 },
                  { label: 'Category 6', value: 10 },
                  { label: 'Category 7', value: 12 },
                  { label: 'Category 8', value: 17 },
                  { label: 'Category 9', value: 21 },
                ],
                colors: [
                  theme.palette.primary.main,
                  theme.palette.warning.dark,
                  theme.palette.success.darker,
                  theme.palette.error.main,
                  theme.palette.info.dark,
                  theme.palette.info.darker,
                  theme.palette.success.main,
                  theme.palette.warning.main,
                  theme.palette.info.main,
                ],
              }}
            /> */}

            {/* <BankingRecentTransitions
              title="Recent Transitions"
              tableData={[]}
              tableLabels={[
                { id: 'description', label: 'Description' },
                { id: 'date', label: 'Date' },
                { id: 'amount', label: 'Amount' },
                { id: 'status', label: 'Status' },
                { id: '' },
              ]}
            /> */}
          </Stack>
        </Grid>

        <Grid xs={12} md={4}>
          <Stack spacing={3}>
            {categories && bankList && (
              <BankingQuickTransaction
                refreshBanks={() => refreshBanks()}
                currentBalance={bankList[0]?.balance || 0}
                bankOptions={bankList
                  .filter((item) => item.cardName !== 'Total')
                  .map((item) => item.cardName)}
                categories={categories}
                title="Quick Transaction"
              />
            )}

            {/* <BankingContacts
              title="Contacts"
              subheader="You have 122 contacts"
              list={_bankingContacts.slice(-5)}
            /> */}

            {/* <BankingInviteFriends
              price="$50"
              title={`Invite friends \n and earn`}
              description="Praesent egestas tristique nibh. Duis lobortis massa imperdiet quam."
              img="/assets/illustrations/characters/character_11.png"
            /> */}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
