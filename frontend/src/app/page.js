import { APP_NAME } from 'src/config-global';
import { HomeView } from 'src/sections/home/view';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME} : Home`,
};

export default function HomePage() {
  return <HomeView />;
}
