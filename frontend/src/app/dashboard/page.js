import { APP_NAME } from 'src/config-global';

import HomeView from 'src/sections/dashboard/view';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: NetWorth`,
};

export default function Page() {
  return <HomeView />;
}
