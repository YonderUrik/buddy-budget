import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
} from '@mui/material';

import { useBoolean } from 'src/hooks/use-boolean';

import axios from 'src/utils/axios';
import { fShortenNumber } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';

export default function AnalyticsAssets({ title, subheader, list, ...other }) {
  const newDialog = useBoolean();

  const [keywordSelected, setKeywordSelected] = useState('');

  const [assetsOptions, setAssetsOptions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const getKeywordSuggestion = async () => {
    setIsSuggesting(true);
    console.log(keywordSelected);
    try {
      const response = await axios.post('/api/assets/get-keyword-suggestion', {
        keyword: keywordSelected,
      });
      const { data } = response;
      setAssetsOptions(data.bestMatches);
      console.log(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setIsSuggesting(false);
    }
  };

  return (
    <Card {...other}>
      <CardHeader title={title} subheader={subheader} />

      <Box display="grid" gap={2} gridTemplateColumns="repeat(5, 1fr)" sx={{ p: 3 }}>
        <Paper
          onClick={newDialog.onTrue}
          variant="outlined"
          sx={{
            py: 2.5,
            textAlign: 'center',
            p: 3,
            borderRadius: 2,
            bgcolor: 'unset',
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'background.paper',
              boxShadow: (theme) => theme.customShadows.z20,
            },
          }}
        >
          <Iconify icon="mingcute:add-circle-fill" width={32} />

          <Typography variant="h6" sx={{ mt: 0.5 }}>
            Add new
          </Typography>
        </Paper>
        {list.map((site) => (
          <Paper key={site.label} variant="outlined" sx={{ py: 2.5, textAlign: 'center' }}>
            <Iconify
              icon={site.icon}
              color={
                (site.value === 'facebook' && '#1877F2') ||
                (site.value === 'google' && '#DF3E30') ||
                (site.value === 'linkedin' && '#006097') ||
                (site.value === 'twitter' && '#1C9CEA') ||
                ''
              }
              width={32}
            />

            <Typography variant="h6" sx={{ mt: 0.5 }}>
              {fShortenNumber(site.total)}
            </Typography>

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {site.label}
            </Typography>
          </Paper>
        ))}
      </Box>
      <Dialog maxWidth="sm" fullWidth open={newDialog.value} onClose={newDialog.onFalse}>
        <DialogTitle>Add new asset</DialogTitle>
        <DialogContent>
          <TextField
            variant="filled"
            fullWidth
            helperText="Insert asset name or symobl"
            value={keywordSelected}
            onChange={(event) => {
              console.log('newValue', event.target.value);
              setKeywordSelected(event.target.value);
            }}
            label="Asset Names"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => getKeywordSuggestion()}>
                    <Iconify icon="material-symbols:search" width={24} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {isSuggesting && <LinearProgress />}

          <Scrollbar>
            <Stack spacing={3} sx={{ p: 3, minWidth: 360 }}>
              {assetsOptions.map((app) => (
                <BestMatchesItems app={app} />
              ))}
            </Stack>
          </Scrollbar>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={newDialog.onFalse}>
            Close
          </Button>
          <Button variant="contained" color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

AnalyticsAssets.propTypes = {
  list: PropTypes.array,
  subheader: PropTypes.string,
  title: PropTypes.string,
};

// ----------------------------------------------------------------------

function BestMatchesItems({ app }) {
  const { shortcut, system, price, ratingNumber, totalReviews, name } = app;

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      {/* <Avatar
        variant="rounded"
        sx={{
          width: 48,
          height: 48,
          bgcolor: 'background.neutral',
        }}
      >
        <Box component="img" src={shortcut} sx={{ width: 24, height: 24 }} />
      </Avatar> */}

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {`(${app['1. symbol']}) ${app['2. name']}`}
        </Typography>

        <Stack direction="row" alignItems="center" sx={{ mt: 0.5, color: 'text.secondary' }}>
          <Iconify width={14} icon={`mdi:currency-${app['8. currency'].toLowerCase()}`} />
          <Typography variant="caption" sx={{ ml: 0.5, mr: 1 }}>
            {`${app['8. currency']}`}
          </Typography>

          <Label>{app['3. type']}</Label>
        </Stack>
      </Box>

      {/* <Stack alignItems="flex-end">
        <Rating readOnly size="small" precision={0.5} name="reviews" value={ratingNumber} />
        <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
          {fShortenNumber(totalReviews)} reviews
        </Typography>
      </Stack> */}
    </Stack>
  );
}

BestMatchesItems.propTypes = {
  app: PropTypes.object,
};
