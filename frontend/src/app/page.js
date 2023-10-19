import { HomeView } from 'src/sections/home/view';
import { APP_NAME } from 'src/config-global';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME} : Home`,
};

export default function HomePage() {
  return <HomeView />;
}
