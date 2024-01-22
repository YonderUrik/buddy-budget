import { orderBy } from 'lodash';
import PropTypes from 'prop-types';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import { DateCalendar } from '@mui/x-date-pickers';
import { DemoContainer, DemoItem } from '@mui/x-date-pickers/internals/demo';
import {
  Autocomplete,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  ListItemText,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
} from '@mui/material';

import { paths } from 'src/routes/paths';

import { useBoolean } from 'src/hooks/use-boolean';

import axios from 'src/utils/axios';
import { fDate } from 'src/utils/format-time';
import { fPercent, fShortenNumber } from 'src/utils/format-number';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import TextMaxLine from 'src/components/text-max-line';
import { usePopover } from 'src/components/custom-popover';
import CustomPopover from 'src/components/custom-popover/custom-popover';

const steps = ['Select asset', 'Insert buy info', 'Confirm'];

const sortOptions = [
  { value: 'current_value', label: 'Value asc', sort_type: 'asc' },
  { value: 'current_value', label: 'Value desc', sort_type: 'desc' },
  { value: 'percentage', label: 'Performance asc', sort_type: 'asc' },
  { value: 'percentage', label: 'Performance desc', sort_type: 'desc' },
  { value: 'longName', label: 'Name asc', sort_type: 'asc' },
  { value: 'longName', label: 'Name desc', sort_type: 'desc' },
];

export default function AnalyticsAssets({ title, subheader, list, refreshAssetsList, ...other }) {
  const newDialog = useBoolean();
  const [activeStep, setActiveStep] = useState(0);
  const [keywordSelected, setKeywordSelected] = useState('');
  const [buyInfo, setBuyInfo] = useState({
    date: new Date(),
    amount: null,
    price_in: null,
    quantity: null,
    fee: 0,
  });
  const [assetsOptions, setAssetsOptions] = useState({});
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleBuyInfo = (key, value) => {
    const currentBuyInfo = { ...buyInfo };
    if (key === 'date') {
      currentBuyInfo[key] = value;
    } else {
      currentBuyInfo[key] = parseFloat(value);
    }

    if (key === 'amount') {
      if (currentBuyInfo.price_in) {
        currentBuyInfo.quantity = value / currentBuyInfo.price_in;
      } else if (currentBuyInfo.quantity) {
        currentBuyInfo.price_in = value / currentBuyInfo.quantity;
      }
    }

    if (key === 'quantity') {
      if (currentBuyInfo.price_in) {
        currentBuyInfo.amount = value * currentBuyInfo.price_in;
      } else if (currentBuyInfo.amount) {
        currentBuyInfo.price_in = currentBuyInfo.amount / value;
      }
    }

    if (key === 'price_in') {
      if (currentBuyInfo.quantity) {
        currentBuyInfo.amount = value * currentBuyInfo.quantity;
      } else if (currentBuyInfo.amount) {
        currentBuyInfo.quantity = currentBuyInfo.amount / value;
      }
    }

    setBuyInfo(currentBuyInfo);
  };

  const getKeywordSuggestion = async () => {
    setIsSuggesting(true);
    setAssetsOptions({});
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

  const handleConfirm = async () => {
    try {
      await axios.post('/api/assets/add-new-asset', {
        selectedAsset,
        buyInfo,
      });
      enqueueSnackbar('Asset added successfully');
      resetSteps();
      refreshAssetsList();
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  };

  const resetSteps = () => {
    newDialog.onFalse();
    setActiveStep(0);
    setKeywordSelected('');
    setSelectedAsset(null);
    setAssetsOptions({});
    setBuyInfo({
      date: new Date(),
      amount: null,
      price_in: null,
      quantity: null,
      fee: 0,
    });
  };

  const sortPopover = usePopover();
  const [sortBy, setSortBy] = useState({ value: 'current_value', sort_type: 'desc' });

  const dataFiltered = applyFilter({
    inputData: list,
    sortBy,
  });

  return (
    <Card {...other}>
      <CardHeader
        title={title}
        subheader={subheader}
        action={
          <>
            <Button
              disableRipple
              color="inherit"
              onClick={sortPopover.onOpen}
              endIcon={
                <Iconify
                  icon={
                    sortPopover.open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
                  }
                />
              }
              sx={{ fontWeight: 'fontWeightSemiBold' }}
            >
              Sort By:
              <Box
                component="span"
                sx={{
                  ml: 0.5,
                  fontWeight: 'fontWeightBold',
                  textTransform: 'capitalize',
                }}
              >
                {
                  sortOptions.find(
                    (item) => item.value === sortBy.value && item.sort_type === sortBy.sort_type
                  ).label
                }
              </Box>
            </Button>

            <CustomPopover
              open={sortPopover.open}
              onClose={sortPopover.onClose}
              sx={{ width: 140 }}
            >
              {sortOptions.map((option) => (
                <MenuItem
                  key={`${option.value}-${option.sort_type}`}
                  selected={option.value === sortBy.value && option.sort_type === sortBy.sort_type}
                  onClick={() => {
                    sortPopover.onClose();
                    setSortBy(option);
                  }}
                >
                  {option.label}
                </MenuItem>
              ))}
            </CustomPopover>
          </>
        }
      />

      <Box
        gap={2}
        sx={{
          p: 3,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', md: 'repeat(5, 1fr)' },
        }}
      >
        <Paper
          onClick={newDialog.onTrue}
          variant="outlined"
          sx={{
            py: 2.5,
            textAlign: 'center',
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
        {dataFiltered.map((assetInfo) => (
          <AssetInfo asset={assetInfo} />
        ))}
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

          {activeStep === steps.length - 1 ? (
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
                <Typography sx={{ my: 1 }}>All steps completed</Typography>
                <Typography sx={{ my: 1 }}>
                  You are adding <b>{buyInfo?.quantity}</b> stock of{' '}
                  <b>{selectedAsset?.longName}</b> bought on <b>{fDate(buyInfo?.date)}</b> at a
                  price of{' '}
                  {
                    <b>
                      {buyInfo?.price_in}
                      {selectedAsset?.currency}
                    </b>
                  }{' '}
                  for a total of{' '}
                  <b>
                    {buyInfo?.amount}
                    {selectedAsset?.currency}
                  </b>
                  plus{' '}
                  {
                    <b>
                      {buyInfo?.fee}
                      {selectedAsset?.currency}
                    </b>
                  }{' '}
                  of fees
                </Typography>
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
                    helperText="Insert asset symbol"
                    value={keywordSelected}
                    onChange={(event) => {
                      setKeywordSelected(event.target.value);
                    }}
                    label="Asset symbol"
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
                      {Object.keys(assetsOptions).length > 0 && (
                        <BestMatchesItems
                          app={assetsOptions}
                          selectedStock={selectedAsset}
                          handleSelectStock={(asset) => {
                            if (asset.symbol === selectedAsset?.symbol) {
                              setSelectedAsset(null);
                            } else {
                              setSelectedAsset(asset);
                            }
                          }}
                        />
                      )}
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
                      value={buyInfo.price_in}
                      onChange={(event) => {
                        handleBuyInfo('price_in', event.target.value);
                      }}
                      label="Price in"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {selectedAsset?.currency}
                          </InputAdornment>
                        ),
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
                        startAdornment: (
                          <InputAdornment position="start">
                            {selectedAsset?.currency}
                          </InputAdornment>
                        ),
                      }}
                    />
                    <TextField
                      variant="filled"
                      fullWidth
                      type="number"
                      value={buyInfo.fee}
                      onChange={(event) => {
                        handleBuyInfo('fee', event.target.value);
                      }}
                      label="Fee"
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            {selectedAsset?.currency}
                          </InputAdornment>
                        ),
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
              onClick={activeStep === steps.length - 1 ? handleConfirm : handleNext}
            >
              {activeStep === steps.length - 1 ? 'Confirm' : 'Next'}
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
  list: PropTypes.array,
  refreshAssetsList: PropTypes.func,
  handleSelectStock: PropTypes.func,
};

AssetInfo.propTypes = {
  asset: PropTypes.object,
};
function AssetInfo({ asset }) {
  const {
    symbol,
    longName,
    quantity,
    current_value,
    total_invested,
    pmc,
    percentage,
    Date,
    currency,
    quoteType,
  } = asset;

  const router = useRouter();
  return (
    <Stack
      component={Paper}
      variant="outlined"
      onClick={() => router.push(paths.app.single_asset(symbol))}
      spacing={1}
      alignItems="flex-start"
      sx={{
        p: 2.5,
        maxWidth: 500,
        borderRadius: 2,
        bgcolor: 'unset',
        cursor: 'pointer',
        position: 'relative',
        '&:hover': {
          boxShadow: (theme) => theme.customShadows.z20,
        },
      }}
    >
      {/* ACTIONS */}
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          top: 8,
          right: 8,
          position: 'absolute',
        }}
      >
        {/* <IconButton>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton> */}
      </Stack>

      {/* INFO */}

      <Tooltip title={longName}>
        <TextMaxLine persistent line={1} variant="subtitle2" sx={{ width: 1, mb: 0.5 }}>
          {longName}
        </TextMaxLine>
      </Tooltip>

      <ListItemText
        primary={
          <Tooltip title="Current value">{`${currency} ${fShortenNumber(current_value)}`}</Tooltip>
        }
        secondary={
          <>
            {/* Percentage */}
            <Stack direction="row">
              <Iconify
                color={percentage < 0 ? 'error.main' : 'success.main'}
                icon={percentage < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'}
              />

              <Box
                color={percentage < 0 ? 'error.main' : 'success.main'}
                // sx={{ typography: 'subtitle2' }}
              >
                {percentage > 0 && '+'}
                {fPercent(percentage * 100)}
              </Box>
            </Stack>
            <Box
              component="span"
              sx={{
                mx: 0.75,
                width: 2,
                height: 2,
                borderRadius: '50%',
                bgcolor: 'currentColor',
              }}
            />
            {/* Quantity */}
            <Stack direction="row">
              Qt.
              <Box>{fShortenNumber(quantity)}</Box>
            </Stack>
            <Box
              component="span"
              sx={{
                mx: 0.75,
                width: 2,
                height: 2,
                borderRadius: '50%',
                bgcolor: 'currentColor',
              }}
            />
            {/* PMC */}
            <Stack direction="row">
              <Box>{quoteType}</Box>
            </Stack>
            {/* {folder.totalFiles} files */}
          </>
        }
        secondaryTypographyProps={{
          mt: 0.5,
          component: 'span',
          alignItems: 'center',
          typography: 'caption',
          color: 'text.disabled',
          display: 'inline-flex',
        }}
      />
    </Stack>
    // </Paper>
  );
}

// ----------------------------------------------------------------------

function BestMatchesItems({ app, selectedStock, handleSelectStock }) {
  const { symbol, longName, quoteType, currency, exchange, sector } = app;

  return (
    <Stack direction="row" alignItems="center" spacing={2}>
      <Checkbox
        checked={selectedStock?.symbol === symbol}
        onChange={() => handleSelectStock(app)}
        inputProps={{ 'aria-label': 'controlled' }}
      />
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap>
          {`${longName}`}
        </Typography>

        <Stack
          spacing={1}
          direction="row"
          alignItems="center"
          sx={{ mt: 0.5, color: 'text.secondary' }}
        >
          <Label>{`${quoteType}`}</Label>
          <Label>{`${currency}`}</Label>
          <Label>{`${exchange}`}</Label>
        </Stack>
      </Box>
    </Stack>
  );
}

BestMatchesItems.propTypes = {
  app: PropTypes.object,
  selectedStock: PropTypes.object,
  handleSelectStock: PropTypes.func,
};

const applyFilter = ({ inputData, sortBy }) => {
  // SORT BY
  inputData = orderBy(inputData, [sortBy.value], [sortBy.sort_type]);
  return inputData;
};
