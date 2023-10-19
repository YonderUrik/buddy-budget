'use client';

import * as Yup from 'yup';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useSearchParams } from 'src/routes/hooks';
import { useBoolean } from 'src/hooks/use-boolean';
import { useRouter } from 'src/routes/hooks';
import { SentIcon } from 'src/assets/icons';
import axios, { endpoints } from 'src/utils/axios';

import Iconify from 'src/components/iconify';
import FormProvider, { RHFCode, RHFTextField } from 'src/components/hook-form';
import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { Alert } from '@mui/material';

// ----------------------------------------------------------------------

export default function JwtResetPasswordView() {
  const password = useBoolean();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState('');
  const email = searchParams.get('email');
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      if (countdown > 0) {
        setCountdown(countdown - 1);
      }
    }, 1000); // Update the countdown every 1 second

    return () => {
      clearInterval(countdownInterval);
    };
  }, [countdown]);

  const NewPasswordSchema = Yup.object().shape({
    code: Yup.string().min(6, 'Code must be at least 6 characters').required('Code is required'),
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    password: Yup.string()
      .min(6, 'Password must be at least 6 characters')
      .matches(
        /^(?=.*[!@#$%^&*])/,
        'Password must contain at least one special character [!@#$%^&*]'
      )
      .matches(/^(?=.*[0-9])/, 'Password must contain at least one number')
      .matches(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter')
      .required('Password is required'),
    confirmPassword: Yup.string()
      .required('Confirm password is required')
      .oneOf([Yup.ref('password')], 'Passwords must match'),
  });

  const defaultValues = {
    code: '',
    email: email,
    password: '',
    confirmPassword: '',
  };

  const methods = useForm({
    mode: 'onChange',
    resolver: yupResolver(NewPasswordSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    try {
      setMsg(null);
      await axios.post(endpoints.auth.resetPassword, { data });
      enqueueSnackbar('Password setted');
      router.push(paths.auth.jwt.login);
    } catch (error) {
      setMsg({ msg: error.message || error, variant: 'error' });
    }
  });

  const requestNewCode = async () => {
    try {
      setMsg(null);
      await axios.post(endpoints.auth.forgotPassword, { email });
      setMsg({ msg: 'We have proceeded to send a new code', variant: 'success' });
    } catch (error) {
      setMsg({ msg: error.message || error, variant: 'error' });
    }
  };

  const checkUserReset = useCallback(async () => {
    try {
      setMsg(null);
      await axios.post(endpoints.auth.checkUserReset, {
        email,
      });
    } catch (error) {
      router.push(paths.auth.jwt.login);
    }
  }, [email]);

  useEffect(() => {
    checkUserReset();
  }, [checkUserReset]);

  const renderForm = (
    <Stack spacing={3} alignItems="center">
      <RHFTextField disabled name="email" label="Email" InputLabelProps={{ shrink: true }} />

      <RHFCode name="code" />

      <RHFTextField
        name="password"
        label="Password"
        type={password.value ? 'text' : 'password'}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={password.onToggle} edge="end">
                <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <RHFTextField
        name="confirmPassword"
        label="Confirm New Password"
        type={password.value ? 'text' : 'password'}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={password.onToggle} edge="end">
                <Iconify icon={password.value ? 'solar:eye-bold' : 'solar:eye-closed-bold'} />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <LoadingButton
        fullWidth
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
      >
        Update Password
      </LoadingButton>

      {countdown > 0 ? (
        // Render the countdown
        <Typography variant="body2">
          {`Wait `}
          <Link
            variant="subtitle2"
            sx={{
              cursor: 'pointer',
            }}
          >
            {countdown}
          </Link>
          {` seconds before requesting a new code`}
        </Typography>
      ) : (
        // Render the components after the countdown
        <Typography variant="body2">
          {`Don't have a code? `}
          <Link
            onClick={() => requestNewCode()}
            variant="subtitle2"
            sx={{
              cursor: 'pointer',
            }}
          >
            Resend code
          </Link>
        </Typography>
      )}

      {/* <Typography variant="body2">
        {`Don’t have a code? `}
        <Link
          variant="subtitle2"
          sx={{
            cursor: 'pointer',
          }}
        >
          Resend code
        </Link>
      </Typography> */}

      <Link
        component={RouterLink}
        href={paths.auth.jwt.login}
        color="inherit"
        variant="subtitle2"
        sx={{
          alignItems: 'center',
          display: 'inline-flex',
        }}
      >
        <Iconify icon="eva:arrow-ios-back-fill" width={16} />
        Return to sign in
      </Link>
    </Stack>
  );

  const renderHead = (
    <>
      <SentIcon sx={{ height: 96 }} />

      <Stack spacing={1} sx={{ my: 5 }}>
        <Typography variant="h3">Request sent successfully!</Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          We&apos;ve sent a 6-digit confirmation email to your email.
          <br />
          Please enter the code in below box and set you new password.
        </Typography>
      </Stack>
    </>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      {renderHead}
      {!!msg && (
        <Alert sx={{ my: 2 }} severity={msg.variant}>
          {msg.msg}
        </Alert>
      )}
      {renderForm}
    </FormProvider>
  );
}
