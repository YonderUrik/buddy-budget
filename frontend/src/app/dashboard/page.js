import HomeView from 'src/sections/dashboard/view';
import { APP_NAME } from 'src/config-global';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Home`,
};

export default function Page() {
  return <HomeView />;
}
