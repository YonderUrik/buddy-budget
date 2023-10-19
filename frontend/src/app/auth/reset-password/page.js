import { JwtResetPasswordView } from 'src/sections/auth/jwt';
import { APP_NAME } from 'src/config-global';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: New Password`,
};

export default function ModernNewPasswordPage() {
  return <JwtResetPasswordView />;
}
