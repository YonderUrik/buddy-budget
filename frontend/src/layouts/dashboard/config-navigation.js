import { useMemo } from 'react';

import { paths } from 'src/routes/paths';

import { APP_NAME } from 'src/config-global';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------

const icon = (name) => <Iconify icon={name} sx={{ width: 1, height: 1 }} />;

// ----------------------------------------------------------------------

export function useNavData() {
  const data = useMemo(
    () => [
      // OVERVIEW
      // ----------------------------------------------------------------------
      {
        subheader: APP_NAME,
        items: [
          {
            title: 'Net Worth',
            path: paths.app.root,
            icon: icon('noto:bar-chart'),
          },
          {
            title: 'Banking',
            path: paths.app.banking,
            icon: icon('noto:bank'),
          },
          {
            title: 'Assets',
            path: paths.app.assets,
            icon: icon('noto:money-bag'),
          },
        ],
      },
    ],
    []
  );

  return data;
}
