import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useCallback, useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { LoadingButton } from '@mui/lab';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import { useBoolean } from 'src/hooks/use-boolean';

import axios from 'src/utils/axios';
import { fToNow } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import { bgGradient } from 'src/theme/css';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import FormProvider, { RHFTextField } from 'src/components/hook-form';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import Carousel, { useCarousel, CarouselDots } from 'src/components/carousel';
// ----------------------------------------------------------------------

export default function BankingCurrentBalance({ list, refreshBanks, sx }) {
  const theme = useTheme();
  const currency = useBoolean();

  const carousel = useCarousel({
    fade: true,
    speed: 100,
    ...CarouselDots({
      sx: {
        right: 16,
        bottom: 16,
        position: 'absolute',
        color: 'primary.light',
      },
    }),
  });

  return (
    <Box
      sx={{
        ...bgGradient({
          color: alpha(theme.palette.grey[800], 0.8),
          imgUrl: '/assets/background/overlay_bank_account.jpg',
        }),
        height: '100%',
        borderRadius: 2,
        position: 'relative',
        color: 'common.white',
        '.slick-slider, .slick-list, .slick-track, .slick-slide > div': {
          height: 1,
        },
        '&:before, &:after': {
          left: 0,
          mx: 2.5,
          right: 0,
          zIndex: -2,
          height: 200,
          bottom: -16,
          content: "''",
          opacity: 0.16,
          borderRadius: 2,
          bgcolor: 'grey.600',
          position: 'absolute',
        },
        '&:after': {
          mx: 1,
          bottom: -8,
          opacity: 0.24,
        },
        ...sx,
      }}
    >
      <Carousel {...carousel.carouselSettings}>
        {list.map((card) => (
          <CardItem
            key={card.cardName}
            card={card}
            currencyBool={currency.value}
            currenyToggle={currency.onToggle}
            refreshBanks={() => refreshBanks()}
          />
        ))}
      </Carousel>
    </Box>
  );
}

BankingCurrentBalance.propTypes = {
  list: PropTypes.array,
  refreshBanks: PropTypes.func,
  sx: PropTypes.object,
};

// ----------------------------------------------------------------------

NewEditBank.propTypes = {
  refreshBanks: PropTypes.func,
  currentBank: PropTypes.object,
};
function NewEditBank({ currentBank, refreshBanks }) {
  const dialog = useBoolean();
  const { enqueueSnackbar } = useSnackbar();

  const bankSchema = Yup.object().shape({
    cardName: Yup.string().required('Bank name required'),
    balance: Yup.number().min(0).required('Current balance required'),
  });

  const defaultValues = {
    cardName: currentBank?.cardName || '',
    balance: currentBank?.balance || 0,
  };

  const methods = useForm({
    resolver: yupResolver(bankSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentBank) {
        const newData = {
          cardName: data.cardName,
          balance: data.balance,
          oldBank: currentBank.cardName,
        };
        await axios.post('/api/banking/edit-bank', newData);
        enqueueSnackbar('New account successfully added');
        reset();
        dialog.onFalse();
        refreshBanks();
      } else {
        await axios.post('/api/banking/add-bank', data);
        enqueueSnackbar('New account successfully added');
        reset();
        dialog.onFalse();
        refreshBanks();
      }
    } catch (error) {
      enqueueSnackbar(error || error.message, { variant: 'error' });
    }
  });

  return (
    <>
      <MenuItem onClick={dialog.onTrue}>
        <Iconify icon={currentBank ? 'solar:pen-bold' : 'solar:add-circle-bold'} />
        {currentBank ? 'Edit' : 'Add new bank'}
      </MenuItem>
      <Dialog fullWidth maxWidth="sm" open={dialog.value} onClose={dialog.onFalse}>
        <FormProvider methods={methods} onSubmit={onSubmit}>
          <DialogTitle>{currentBank ? 'Edit bank account' : 'Add new bank account'}</DialogTitle>
          <DialogContent>
            <Stack sx={{ my: 2 }} spacing={2.5}>
              <RHFTextField name="cardName" label="Bank Name" />
            </Stack>
            <Stack sx={{ my: 2 }} spacing={2.5}>
              <RHFTextField type="number" name="balance" label="Current Balance" />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" color="inherit" onClick={dialog.onFalse}>
              Close
            </Button>
            <LoadingButton
              fullWidth
              color="success"
              type="submit"
              variant="contained"
              loading={isSubmitting}
              endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
              sx={{ justifyContent: 'space-between', pl: 2, pr: 1.5 }}
            >
              {currentBank ? 'Edit Bank' : 'Add Bank'}
            </LoadingButton>
          </DialogActions>
        </FormProvider>
      </Dialog>
    </>
  );
}

function CardItem({ card, refreshBanks, currencyBool, currenyToggle }) {
  const { _id, balance, cardName, lastUpdate } = card;
  const { enqueueSnackbar } = useSnackbar();
  const popover = usePopover();
  const confirmDelete = useBoolean();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await axios.post('/api/banking/delete-bank', { cardName });
      enqueueSnackbar('Bank account deleted');
      confirmDelete.onFalse();
      popover.onClose();
      refreshBanks();
    } catch (error) {
      enqueueSnackbar(error || error.message, { variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  }, [popover, enqueueSnackbar, cardName, confirmDelete, refreshBanks]);

  return (
    <>
      <Stack justifyContent="space-between" sx={{ height: 1, p: 3 }}>
        <IconButton
          color="inherit"
          onClick={popover.onOpen}
          sx={{
            top: 8,
            right: 8,
            zIndex: 9,
            opacity: 0.48,
            position: 'absolute',
            ...(popover.open && {
              opacity: 1,
            }),
          }}
        >
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>

        <div>
          <Typography sx={{ mb: 2, typography: 'subtitle2', opacity: 0.48 }}>
            Current Balance
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ typography: 'h3' }}>
              {currencyBool ? '********' : fCurrency(balance)}
            </Typography>

            <IconButton color="inherit" onClick={currenyToggle} sx={{ opacity: 1 }}>
              <Iconify icon={currencyBool ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
            </IconButton>
          </Stack>
        </div>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          sx={{ typography: 'subtitle1' }}
        >
          <Typography sx={{ mb: 4, typography: 'subtitle2', opacity: 0.48 }}>
            Bank Name :{' '}
          </Typography>
          <Typography sx={{ ml: 1, typography: 'subtitle1' }}>{cardName}</Typography>
        </Stack>
        {_id === -1 && <NewEditBank refreshBanks={() => refreshBanks()} />}

        {_id !== -1 && (
          <Stack direction="row" spacing={5}>
            <Stack spacing={1}>
              <Typography sx={{ typography: 'caption', opacity: 0.48 }}>Last Update</Typography>
              <Typography sx={{ typography: 'subtitle1' }}>
                {fToNow(`${lastUpdate} UTC`) || lastUpdate}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Stack>

      <CustomPopover open={popover.open} onClose={popover.onClose} sx={{ width: 160 }}>
        <NewEditBank refreshBanks={() => refreshBanks()} />
        {_id && _id !== -1 && (
          <>
            <NewEditBank currentBank={card} refreshBanks={() => refreshBanks()} />
            <MenuItem onClick={confirmDelete.onTrue} sx={{ color: 'error.main' }}>
              <Iconify icon="solar:trash-bin-trash-bold" />
              Delete
            </MenuItem>
          </>
        )}
      </CustomPopover>

      <ConfirmDialog
        open={confirmDelete.value}
        onClose={confirmDelete.onFalse}
        title={`Delete ${cardName}`}
        content="Are you sure want to delete this bank? If you confirm, all transactions and data linked to this account will be deleted and cannot be recovered."
        action={
          <LoadingButton
            loading={isDeleting}
            variant="contained"
            color="error"
            onClick={handleDelete}
          >
            Delete
          </LoadingButton>
        }
      />
    </>
  );
}

CardItem.propTypes = {
  card: PropTypes.object,
  refreshBanks: PropTypes.func,
  currencyBool: PropTypes.bool,
  currenyToggle: PropTypes.func,
};
