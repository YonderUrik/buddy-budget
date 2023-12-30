import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { DemoContainer, DemoItem } from '@mui/x-date-pickers/internals/demo';

import { fShortenNumber } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useBoolean } from 'src/hooks/use-boolean';
import { useSnackbar } from 'src/components/snackbar';

import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import axios from 'src/utils/axios';
import Scrollbar from 'src/components/scrollbar';
import Label from 'src/components/label';
import { DateCalendar } from '@mui/x-date-pickers';

const steps = ['Select asset', 'Insert buy info', 'Confirm'];

export default function AnalyticsAssets({ title, subheader, list, ...other }) {
  const newDialog = useBoolean();
  const [activeStep, setActiveStep] = useState(0);
  const [keywordSelected, setKeywordSelected] = useState('');
  const [buyInfo, setBuyInfo] = useState({
    date: new Date(),
    amount: null,
    price_in: null,
    quantity: null,
  });
  const [assetsOptions, setAssetsOptions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleBuyInfo = (key, value) => {
    const currentBuyInfo = { ...buyInfo };
    currentBuyInfo[key] = value;

    if (key === 'amount') {
      if (currentBuyInfo.price_in !== null) {
        currentBuyInfo.quantity = value / currentBuyInfo.price_in;
      } else if (currentBuyInfo.quantity !== null) {
        currentBuyInfo.price_in = value / currentBuyInfo.quantity;
      }
    }

    if (key === 'quantity') {
      if (currentBuyInfo.price_in !== null) {
        currentBuyInfo.amount = value * currentBuyInfo.price_in;
      } else if (currentBuyInfo.amount !== null) {
        currentBuyInfo.price_in = currentBuyInfo.amount / value;
      }
    }

    if (key === 'price_in') {
      if (currentBuyInfo.quantity !== null) {
        currentBuyInfo.amount = value * currentBuyInfo.quantity;
      } else if (currentBuyInfo.amount !== null) {
        currentBuyInfo.quantity = currentBuyInfo.amount / value;
      }
    }

    setBuyInfo(currentBuyInfo);
  };

  const getKeywordSuggestion = async () => {
    setIsSuggesting(true);
    setAssetsOptions([]);
    setSelectedAsset(null);
    setBuyInfo({
      date: new Date(),
      amount: null,
      price_in: null,
      quantity: null,
    });
    try {
      const response = await axios.post('/api/assets/get-keyword-suggestion', {
        keyword: keywordSelected,
      });
      const { data } = response;
      setAssetsOptions(data);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
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
            textAlign: 'center',
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
      </Box>
      <Dialog maxWidth="sm" fullWidth open={newDialog.value} onClose={newDialog.onFalse}>
        <DialogTitle>Add new asset</DialogTitle>
        <DialogContent>
          {/* Stepper HEADER */}
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label, index) => {
              const stepProps = {};
              const labelProps = {};
              return (
                <Step key={label} {...stepProps}>
                  <StepLabel {...labelProps}>{label}</StepLabel>
                </Step>
              );
            })}
          </Stepper>

          {activeStep === steps.length ? (
            // LAST STEP
            <>
              <Paper
                sx={{
                  p: 3,
                  my: 3,
                  minHeight: 120,
                  bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
                }}
              >
                <Typography sx={{ my: 1 }}>All steps completed - you&apos;re finished</Typography>
              </Paper>
            </>
          ) : (
            <>
              {/* FIRST STEP */}
              {activeStep === 0 && (
                <Paper
                  sx={{
                    p: 3,
                    my: 3,
                    minHeight: 120,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
                  }}
                >
                  <TextField
                    variant="filled"
                    fullWidth
                    helperText="Insert asset name"
                    value={keywordSelected}
                    onChange={(event) => {
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
                        <BestMatchesItems
                          app={app}
                          selectedStock={selectedAsset}
                          handleSelectStock={(asset) => {
                            if (asset.permaTicker === selectedAsset?.permaTicker) {
                              setSelectedAsset(null);
                            } else {
                              setSelectedAsset(asset);
                            }
                          }}
                        />
                      ))}
                    </Stack>
                  </Scrollbar>
                </Paper>
              )}

              {activeStep === 1 && (
                <Paper
                  sx={{
                    p: 3,
                    my: 3,
                    minHeight: 120,
                    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
                  }}
                >
                  <Stack spacing={1}>
                    <DemoItem label="Date">
                      <DateCalendar
                        value={buyInfo.date}
                        onChange={(newValue) => handleBuyInfo('date', newValue)}
                      />
                    </DemoItem>

                    <TextField
                      variant="filled"
                      fullWidth
                      type="number"
                      value={buyInfo.price_info}
                      onChange={(event) => {
                        handleBuyInfo('price_in', event.target.value);
                      }}
                      label="Price in"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€</InputAdornment>,
                      }}
                    />
                    <TextField
                      variant="filled"
                      fullWidth
                      type="number"
                      value={buyInfo.quantity}
                      onChange={(event) => {
                        handleBuyInfo('quantity', event.target.value);
                      }}
                      label="Quantity"
                    />
                    <TextField
                      variant="filled"
                      fullWidth
                      type="number"
                      value={buyInfo.amount}
                      onChange={(event) => {
                        handleBuyInfo('amount', event.target.value);
                      }}
                      label="Amount"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">€</InputAdornment>,
                      }}
                    />
                  </Stack>
                </Paper>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Box sx={{ display: 'flex', mb: 2 }}>
            <Button color="inherit" disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>
              Back
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              disabled={
                (activeStep === 0 && selectedAsset === null) ||
                (activeStep === 1 && Object.values(buyInfo).includes(null))
              }
              variant="contained"
              onClick={handleNext}
            >
              {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

AnalyticsAssets.propTypes = {
  subheader: PropTypes.string,
  title: PropTypes.string,
  selectedStock: PropTypes.object,
  handleSelectStock: PropTypes.func,
};

// ----------------------------------------------------------------------

function BestMatchesItems({ app, selectedStock, handleSelectStock }) {
  const { name, ticker, assetType, countryCode, permaTicker } = app;

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Checkbox
        checked={selectedStock?.permaTicker === permaTicker}
        onChange={() => handleSelectStock(app)}
        inputProps={{ 'aria-label': 'controlled' }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {`${name}`}
        </Typography>

        <Stack
          spacing={1}
          direction="row"
          alignItems="center"
          sx={{ mt: 0.5, color: 'text.secondary' }}
        >
          <Label>{`${countryCode}`}</Label>
          <Label>{`${ticker}`}</Label>
          <Label>{`${assetType}`}</Label>
        </Stack>
      </Box>
    </Stack>
  );
}

BestMatchesItems.propTypes = {
  app: PropTypes.object,
};
