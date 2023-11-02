import { APP_NAME } from 'src/config-global';
import { JwtResetPasswordView } from 'src/sections/auth/jwt';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: New Password`,
};

export default function ModernNewPasswordPage() {
  return <JwtResetPasswordView />;
}
