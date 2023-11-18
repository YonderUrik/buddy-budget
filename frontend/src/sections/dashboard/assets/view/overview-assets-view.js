'use client';

import { Grid } from '@mui/material';
import AnalyticsAssets from '../assets-analytics';

export default function OverviewAssetsView() {
  return (
    <Grid xs={12} md={6} lg={4}>
      <AnalyticsAssets title="Your assets" list={[]} />
    </Grid>
  );
}
