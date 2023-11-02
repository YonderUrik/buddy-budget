import { APP_NAME } from 'src/config-global';
import { JwtRegisterView } from 'src/sections/auth/jwt';

// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Login`,
};

export default function JwtRegisterPage() {
  return <JwtRegisterView />;
}
