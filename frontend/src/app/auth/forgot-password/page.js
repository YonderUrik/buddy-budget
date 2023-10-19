import { JwtForgotPasswordView } from 'src/sections/auth/jwt';
import { APP_NAME } from 'src/config-global';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Forgot Password`,
};

export default function ModernForgotPasswordPage() {
  return <JwtForgotPasswordView />;
}
