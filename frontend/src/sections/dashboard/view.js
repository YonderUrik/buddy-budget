'use client';

import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import { Grid } from '@mui/material';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import axios from 'src/utils/axios';

import { useSettingsContext } from 'src/components/settings';

import BankingNetWorth from './banking/banking-net-worth';
import BankingExpensesCategories from './banking/banking-expenses-categories';

// ----------------------------------------------------------------------

export default function HomeView() {
  const settings = useSettingsContext();

  const [categories, setCategories] = useState([]);
  const [netWorth, setNetWorth] = useState([]);

  const getCategories = useCallback(async () => {
    try {
      const response = await axios.post('/api/banking/get-expenses-category-chart', {});
      const { data } = response;
      setCategories(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const getNetWorth = useCallback(async () => {
    try {
      const response = await axios.post('/api/banking/get-summary-net-worth', {});
      const { data } = response;
      setNetWorth(data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    getCategories();
    getNetWorth();
  }, [getCategories, getNetWorth]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Typography variant="h4"> NetWorth </Typography>

      <Grid sx={{ mt: 2 }} container spacing={2}>
        <Grid item xs={12} md={12}>
          <BankingExpensesCategories title="Expenses Categories" chart={{ series: categories }} />
        </Grid>
        <Grid item xs={12} md={12}>
          <BankingNetWorth
            title="Net Worth"
            chart={{
              series: netWorth,
            }}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
