import { AccountView } from 'src/sections/dashboard/account/view';
import { APP_NAME } from 'src/config-global';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Account Settings`,
};


export default function AccountPage() {
  return <AccountView />;
}
