import { APP_NAME } from 'src/config-global';

import { JwtLoginView } from 'src/sections/auth/jwt';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Login`,
};

export default function LoginPage() {
  return <JwtLoginView />;
}
