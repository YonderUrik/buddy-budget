'use client';

import { useCallback, useEffect, useState } from 'react';

import { alpha } from '@mui/material/styles';
import { Card, Container, Divider, Grid, LinearProgress, Stack } from '@mui/material';

import axios from 'src/utils/axios';

import Scrollbar from 'src/components/scrollbar';
import { useSettingsContext } from 'src/components/settings';

import AnalyticsAssets from '../assets-analytics';
import TotalByCurrency from '../total-by-currencty-analytic'; // theme css file

export default function OverviewAssetsView() {
  const [assetsList, setAssetsList] = useState([]);
  const [assetsIsLoading, setAssetsIsLoading] = useState(false);
  const settings = useSettingsContext();

  const getAssetsList = useCallback(async () => {
    setAssetsIsLoading(true);
    try {
      const response = await axios.post('/api/assets/get-assets');

      const { data } = response;

      setAssetsList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setAssetsIsLoading(false);
    }
  }, []);

  // Function to group by currency and calculate sum of total_invested and current_value
  const groupByCurrency = assetsList.reduce((acc, obj) => {
    const { currency, total_invested, current_value } = obj;

    if (!acc[currency]) {
      acc[currency] = {
        totalInvestedSum: total_invested,
        currentValueSum: current_value,
      };
    } else {
      acc[currency].totalInvestedSum += total_invested;
      acc[currency].currentValueSum += current_value;
    }

    return acc;
  }, {});

  useEffect(() => {
    getAssetsList();
  }, [getAssetsList]);
  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <Grid xs={12} md={6} lg={4}>
        {assetsIsLoading && <LinearProgress />}

        <Card
          sx={{
            mb: { xs: 1, md: 1 },
            bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
            border: (theme) => `dashed 1px ${theme.palette.divider}`,
          }}
        >
          <Scrollbar>
            <Stack
              direction="row"
              divider={<Divider orientation="vertical" flexItem sx={{ borderStyle: 'dashed' }} />}
              sx={{ py: 1 }}
            >
              {Object.keys(groupByCurrency).map((currency, index) => (
                <TotalByCurrency
                  key={`currencty-ground-index-${index}`}
                  title={currency}
                  price={groupByCurrency[currency].currentValueSum}
                  invested={groupByCurrency[currency].totalInvestedSum}
                />
              ))}
            </Stack>
          </Scrollbar>
        </Card>
        <AnalyticsAssets
          title="Your assets"
          list={assetsList}
          refreshAssetsList={() => getAssetsList()}
          sx={{
            bgcolor: (theme) => alpha(theme.palette.grey[500], 0.04),
            border: (theme) => `dashed 1px ${theme.palette.divider}`,
          }}
        />
      </Grid>
    </Container>
  );
}
