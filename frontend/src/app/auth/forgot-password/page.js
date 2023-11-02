import { APP_NAME } from 'src/config-global';
import { JwtForgotPasswordView } from 'src/sections/auth/jwt';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Forgot Password`,
};

export default function ModernForgotPasswordPage() {
  return <JwtForgotPasswordView />;
}
