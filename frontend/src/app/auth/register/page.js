import { JwtRegisterView } from 'src/sections/auth/jwt';
import { APP_NAME } from 'src/config-global';

// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Login`,
};

export default function JwtRegisterPage() {
  return <JwtRegisterView />;
}
