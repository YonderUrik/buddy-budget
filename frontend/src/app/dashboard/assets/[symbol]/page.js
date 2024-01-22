import PropTypes from 'prop-types';

import { APP_NAME } from 'src/config-global';

import { SingleAssetView } from 'src/sections/dashboard/assets/view';
// ----------------------------------------------------------------------

export const metadata = {
  title: `${APP_NAME}: Asset view`,
};

export default function Page({params}) {
  const { symbol } = params

  return <SingleAssetView symbol={symbol} />;
}

Page.propTypes = {
  params: PropTypes.shape({
    symbol: PropTypes.string,
  }),
};

