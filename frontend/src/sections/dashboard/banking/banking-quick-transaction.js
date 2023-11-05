import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { LoadingButton } from '@mui/lab';
import Slider from '@mui/material/Slider';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import Input, { inputClasses } from '@mui/material/Input';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { InputAdornment, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material';

import axios from 'src/utils/axios';
import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFAutocomplete } from 'src/components/hook-form';

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

  let subcategories = [];
  if (transactionType !== 'transfer') {
    subcategories = categories[transactionType].reduce((acc, category) => {
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
  }

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

  let transactionSchema = null;
  let defaultValues = {};

  if (transactionType === 'transfer') {
    transactionSchema = Yup.object().shape({
      cardName: Yup.string().required('Origin bank account required'),
      cardNameTo: Yup.string().required('Destination bank account required'),
      date: Yup.mixed().nullable().required('Date is required'),
    });

    defaultValues = {
      type: transactionType,
      cardName: '',
      cardNameTo: '',
      amount: 0,
      date: new Date(),
    };
  } else {
    transactionSchema = Yup.object().shape({
      cardName: Yup.string().required('Bank account required'),
      category: Yup.object().required('Category required'),
      date: Yup.mixed().nullable().required('Date is required'),
    });

    defaultValues = {
      type: transactionType,
      cardName: '',
      amount: 0,
      category: null,
      date: new Date(),
    };
  }

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

  const handleChangeSlider = useCallback(
    (event, newValue) => {
      setAmount(newValue);
      methods.setValue('amount', newValue);
    },
    [methods]
  );

  const handleChangeInput = useCallback(
    (event) => {
      setAmount(Number(event.target.value));
      methods.setValue('amount', Number(event.target.value));
    },
    [methods]
  );

  const handleBlur = useCallback(() => {
    if (amount < 0) {
      setAmount(0);
      methods.setValue('amount', 0);
    }
  }, [amount, methods]);

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
      const currentDate = new Date();
      const dataDate = data.date;
      if (
        dataDate.getFullYear() === currentDate.getFullYear() &&
        dataDate.getMonth() === currentDate.getMonth() &&
        dataDate.getDate() === currentDate.getDate()
      ) {
        // Set the "date" field to the current date
        methods.setValue('date', currentDate);
      }
      await axios.post('/api/banking/add-transaction', data);
      enqueueSnackbar('Transaction added');
      reset();
      refreshBanks();
      refreshTransactions();
      setAmount(0);
      methods.setValue('type', transactionType);
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    }
  });

  const handleTransactionType = (event, newType) => {
    if (newType !== null) {
      methods.setValue('type', newType);
      methods.setValue('category', null);
      setTransactionType(newType);
    }
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
                <Iconify icon="solar:arrow-left-down-line-duotone" />
                Income
              </ToggleButton>
              <ToggleButton color="error" value="out">
                <Iconify icon="solar:arrow-right-up-line-duotone" />
                Expense
              </ToggleButton>
              <ToggleButton color="info" value="transfer">
                <Iconify icon="solar:transfer-vertical-bold-duotone" />
                Transfer
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>
              {transactionType === 'transfer' ? 'Select Banks' : 'Select Bank and category'}
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
              options={[...bankOptions, 'External wallet']}
              label={transactionType === 'transfer' ? 'From' : 'Bank'}
            />

            {transactionType === 'transfer' ? (
              <RHFAutocomplete
                sx={{ my: 1 }}
                size="small"
                name="cardNameTo"
                options={[...bankOptions, 'External wallet']}
                label="To"
              />
            ) : (
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
            )}

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
