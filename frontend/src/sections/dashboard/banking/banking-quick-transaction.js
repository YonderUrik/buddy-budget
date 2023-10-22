import PropTypes from 'prop-types';
import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as Yup from 'yup';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Slider from '@mui/material/Slider';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import ListItemText from '@mui/material/ListItemText';
import DialogActions from '@mui/material/DialogActions';
import Input, { inputClasses } from '@mui/material/Input';
import axios from 'src/utils/axios';
import { useSnackbar } from 'src/components/snackbar';
import { useBoolean } from 'src/hooks/use-boolean';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import Carousel, { useCarousel, CarouselArrows } from 'src/components/carousel';
import FormProvider, { RHFAutocomplete } from 'src/components/hook-form';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { LoadingButton } from '@mui/lab';

// ----------------------------------------------------------------------

const STEP = 0.01;

const MIN_AMOUNT = 0;

const MAX_AMOUNT = 2000;

// ----------------------------------------------------------------------

export default function BankingQuickTransaction({
  title,
  subheader,
  currentBalance,
  bankOptions,
  categories,
  refreshBanks,
  refreshTransactions,
  sx,
  ...other
}) {
  const [autoWidth, setAutoWidth] = useState(24);
  const [transactionType, setTransactionType] = useState('out');
  const [amount, setAmount] = useState(0);
  const { enqueueSnackbar } = useSnackbar();
  const subcategories = categories[transactionType].reduce((acc, category) => {
    const categoryLabel = category.category_name;
    const categoryId = category.category_id;
    const subcategoryOptions = category.subcategories.map((subcategory) => ({
      label: subcategory.subcategory_name,
      value: subcategory.subcategory_id,
      category: categoryLabel,
      categoryId,
    }));
    return [...acc, ...subcategoryOptions];
  }, []);

  useEffect(() => {
    if (amount) {
      handleAutoWidth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const handleAutoWidth = useCallback(() => {
    const getNumberLength = amount.toString().length;
    setAutoWidth(getNumberLength * 24);
  }, [amount]);

  const handleChangeSlider = useCallback((event, newValue) => {
    setAmount(newValue);
    methods.setValue('amount', newValue);
  }, []);

  const handleChangeInput = useCallback((event) => {
    setAmount(Number(event.target.value));
    methods.setValue('amount', Number(event.target.value));
  }, []);

  const handleBlur = useCallback(() => {
    if (amount < 0) {
      setAmount(0);
      methods.setValue('amount', 0);
    }
  }, [amount]);

  const transactionSchema = Yup.object().shape({
    cardName: Yup.string().required('Bank account required'),
    category: Yup.object().required('Category required'),
    date: Yup.mixed().nullable().required('Date is required'),
  });

  const defaultValues = {
    type: transactionType,
    cardName: '',
    amount: 0,
    category: null,
    date: new Date(),
  };

  const methods = useForm({
    resolver: yupResolver(transactionSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = methods;

  const renderInput = (
    <Stack spacing={3}>
      <Typography variant="overline" sx={{ color: 'text.secondary' }}>
        insert amount
      </Typography>

      <InputAmount
        amount={amount}
        onBlur={handleBlur}
        autoWidth={autoWidth}
        onChange={handleChangeInput}
      />

      <Slider
        value={typeof amount === 'number' ? amount : 0}
        valueLabelDisplay="auto"
        min={MIN_AMOUNT}
        max={MAX_AMOUNT}
        onChange={handleChangeSlider}
      />

      <Stack direction="row" alignItems="center" sx={{ typography: 'subtitle1' }}>
        <Box component="span" sx={{ flexGrow: 1 }}>
          Your Balance
        </Box>
        {fCurrency(currentBalance)}
      </Stack>

      <LoadingButton
        size="large"
        color="inherit"
        variant="contained"
        disabled={amount === 0}
        type="submit"
        loading={isSubmitting}
      >
        Insert
      </LoadingButton>
    </Stack>
  );

  const onSubmit = handleSubmit(async (data) => {
    try {
      await axios.post('/api/banking/add-transaction', data);
      enqueueSnackbar('Transaction added');
      reset();
      refreshBanks();
      refreshTransactions();
      setAmount(0);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  });

  const handleTransactionType = (event, newType) => {
    methods.setValue('type', newType);
    methods.setValue('category', null);
    setTransactionType(newType);
  };

  return (
    <>
      <Stack
        sx={{
          borderRadius: 2,
          bgcolor: 'background.neutral',
          ...sx,
        }}
        {...other}
      >
        <CardHeader title={title} subheader={subheader} />

        <Stack sx={{ p: 3 }}>
          <Stack sx={{ my: 1 }} direction="row" alignItems="center" justifyContent="space-between">
            <ToggleButtonGroup
              size="small"
              value={transactionType}
              exclusive
              onChange={handleTransactionType}
            >
              <ToggleButton color="success" value="in">
                <Iconify icon="eva:diagonal-arrow-left-down-fill" />
                Income
              </ToggleButton>
              <ToggleButton color="error" value="out">
                <Iconify icon="eva:diagonal-arrow-right-up-fill" />
                Expense
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              Select Bank and category
            </Typography>
          </Stack>
          <FormProvider methods={methods} onSubmit={onSubmit}>
            <Controller
              name="date"
              control={control}
              render={({ field, fieldState: { error } }) => (
                <DatePicker
                  {...field}
                  label="Date"
                  sx={{ my: 1 }}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      error: !!error,
                      helperText: error?.message,
                    },
                  }}
                />
              )}
            />

            <RHFAutocomplete
              sx={{ my: 1 }}
              size="small"
              name="cardName"
              options={bankOptions}
              label="Bank"
            />

            <RHFAutocomplete
              sx={{ my: 1 }}
              label="Category"
              size="small"
              name="category"
              isOptionEqualToValue={(option, value) => option.value === value.value}
              options={subcategories}
              groupBy={(option) => option.category}
              getOptionLabel={(option) => option.label}
            />

            {renderInput}
          </FormProvider>
        </Stack>
      </Stack>
    </>
  );
}

BankingQuickTransaction.propTypes = {
  currentBalance: PropTypes.number,
  subheader: PropTypes.string,
  bankOptions: PropTypes.array,
  refreshBanks: PropTypes.func,
  refreshTransactions: PropTypes.func,
  sx: PropTypes.object,
  categories: PropTypes.object,
  title: PropTypes.string,
};

// ----------------------------------------------------------------------

function InputAmount({ autoWidth, amount, onBlur, onChange, sx, ...other }) {
  return (
    <Stack direction="row" justifyContent="center" spacing={1} sx={sx}>
      <Typography variant="h5">€</Typography>

      <Input
        disableUnderline
        size="small"
        value={amount}
        onChange={onChange}
        onBlur={onBlur}
        inputProps={{
          step: STEP,
          min: MIN_AMOUNT,
          type: 'number',
        }}
        sx={{
          [`& .${inputClasses.input}`]: {
            p: 0,
            typography: 'h3',
            textAlign: 'center',
            width: autoWidth,
          },
        }}
        {...other}
      />
    </Stack>
  );
}

InputAmount.propTypes = {
  amount: PropTypes.number,
  autoWidth: PropTypes.number,
  onBlur: PropTypes.func,
  onChange: PropTypes.func,
  sx: PropTypes.object,
};
