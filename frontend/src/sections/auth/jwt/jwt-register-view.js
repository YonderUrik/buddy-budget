'use client';

import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';

import Link from '@mui/material/Link';
import { Alert } from '@mui/material';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import InputAdornment from '@mui/material/InputAdornment';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { useBoolean } from 'src/hooks/use-boolean';

import axios from 'src/utils/axios';

import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export default function JwtRegisterView() {
  const password = useBoolean();
  const [errorMsg, setErrorMsg] = useState('');
  const { enqueueSnackbar } = useSnackbar();

  const router = useRouter();
  const RegisterSchema = Yup.object().shape({
    firstName: Yup.string().required('First name required'),
    lastName: Yup.string().required('Last name required'),
    email: Yup.string().required('Email is required').email('Email must be a valid email address'),
    password: Yup.string()
      .required('Password is required')
      .matches(/^(?=.*[!@#%^&*])/, 'Password must contain at least one special character [!@#%^&*]')
      .matches(/^(?=.*[0-9])/, 'Password must contain at least one number')
      .matches(/^(?=.*[A-Z])/, 'Password must contain at least one uppercase letter'),
  });

  const defaultValues = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  };

  const methods = useForm({
    resolver: yupResolver(RegisterSchema),
    defaultValues,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async (data) => {
    setErrorMsg('');
    try {
      await axios.post('/api/auth/register', data);
      enqueueSnackbar('Successfully registered user');
      router.push(paths.auth.jwt.login);
    } catch (error) {
      setErrorMsg(typeof error === 'string' ? error : error.message);
    }
  });

  const renderHead = (
    <Stack spacing={2} sx={{ mb: 5, position: 'relative' }}>
      <Typography variant="h4">Get started</Typography>

      <Stack direction="row" spacing={0.5}>
        <Typography variant="body2"> Already have an account? </Typography>

        <Link href={paths.auth.jwt.login} component={RouterLink} variant="subtitle2">
          Sign in
        </Link>
      </Stack>
    </Stack>
  );

  const renderTerms = (
    <Typography
      component="div"
      sx={{
        color: 'text.secondary',
        mt: 2.5,
        typography: 'caption',
        textAlign: 'center',
      }}
    >
      {'By signing up, I agree to '}
      <Terms />
      <CookiePolicyComponent />
      {' and '}
      {/* <Link underline="always" color="text.primary">
        Privacy Policy
      </Link> */}
      <PrivacyPolicyComponent />
    </Typography>
  );

  const renderForm = (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <RHFTextField name="firstName" label="First name" />
        <RHFTextField name="lastName" label="Last name" />
      </Stack>

      <RHFTextField name="email" label="Email address" />

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

      <LoadingButton
        fullWidth
        color="inherit"
        size="large"
        type="submit"
        variant="contained"
        loading={isSubmitting}
        endIcon={<Iconify icon="eva:arrow-ios-forward-fill" />}
        sx={{ justifyContent: 'space-between', pl: 2, pr: 1.5 }}
      >
        Create account
      </LoadingButton>
    </Stack>
  );

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      {renderHead}

      {!!errorMsg && (
        <Alert sx={{ my: 2 }} severity="error">
          {errorMsg}
        </Alert>
      )}

      {renderForm}

      {renderTerms}
    </FormProvider>
  );
}

function PrivacyPolicyComponent() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.iubenda.com/iubenda.js';
    script.async = true;
    script.onload = () => {
      // The Iubenda script has loaded, you can perform any additional logic here
    };
    document.body.appendChild(script);
  }, []);

  return (
    <a
      href="https://www.iubenda.com/privacy-policy/84137518"
      className="iubenda-black iubenda-noiframe iubenda-embed iubenda-noiframe"
      title="Privacy Policy"
    >
      Privacy Policy
    </a>
  );
}

ExternalLinkWithScript.propTypes = {
  linkUrl: PropTypes.string.isRequired,
  linkTitle: PropTypes.string.isRequired,
};

function ExternalLinkWithScript({ linkUrl, linkTitle }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.iubenda.com/iubenda.js';
    script.async = true;
    script.onload = () => {
      // The Iubenda script has loaded, you can perform any additional logic here
    };
    document.body.appendChild(script);
  }, []);

  return (
    <a
      href={linkUrl}
      className="iubenda-black iubenda-noiframe iubenda-embed iubenda-noiframe"
      title={linkTitle}
    >
      {linkTitle}
    </a>
  );
}

function CookiePolicyComponent() {
  return (
    <ExternalLinkWithScript
      linkUrl="https://www.iubenda.com/privacy-policy/84137518/cookie-policy"
      linkTitle="Cookie Policy"
    />
  );
}

function Terms() {
  return (
    <ExternalLinkWithScript
      linkUrl="https://www.iubenda.com/terms-and-conditions/84137518"
      linkTitle="Terms and Conditions"
    />
  );
}
