import { APP_NAME } from 'src/config-global';
import { OverviewBankingView } from 'src/sections/dashboard/banking/view';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Banking`,
};

export default function Page() {
  return <OverviewBankingView />;
}
