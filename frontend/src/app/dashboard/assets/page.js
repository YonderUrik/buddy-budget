import { APP_NAME } from 'src/config-global';

import { OverviewAssetsView } from 'src/sections/dashboard/assets/view';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Assets`,
};

export default function Page() {
  return <OverviewAssetsView />;
}
