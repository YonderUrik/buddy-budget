// import { useEffect, useRef } from 'react';
// import PropTypes from 'prop-types';
// import Box from '@mui/material/Box';
// import Stack from '@mui/material/Stack';
// import Typography from '@mui/material/Typography';
// import { alpha, useTheme } from '@mui/material/styles';
// import { fPercent, fCurrency } from 'src/utils/format-number';
// import { bgGradient } from 'src/theme/css';
// import Iconify from 'src/components/iconify';
// import Chart, { useChart } from 'src/components/chart';
// import EmptyContent from 'src/components/empty-content';

// // ----------------------------------------------------------------------

// export default function BankingWidgetSummary({ title, chart, sx, ...other }) {
//   const theme = useTheme();

//   const seriesRef = useRef([]);
//   const chartOptionsRef = useRef({});
//   const lastMonthIncomeRef = useRef(0);
//   const lastMonthExpenseRef = useRef(0);
//   const savingRateRef = useRef(0);
//   const colorRef = useRef('info');
//   const iconRef = useRef('fluent-mdl2:unknown-solid');

//   useEffect(() => {
//     if (chart) {
//       const { labels, options } = chart;
//       const series = chart.series; // Set the series based on the chart prop

//       const chartOptions = useChart({
//         colors: [theme.palette.success.main, theme.palette.error.main],
//         chart: {
//           sparkline: {
//             enabled: true,
//           },
//         },
//         dataLabels: {
//           enabled: true,
//           position: 'inside',
//           style: {
//             colors: ['secondary'],
//           },
//           background: {
//             enabled: true,
//           },
//           formatter: function (val, opt) {
//             if (val === 0) {
//               return '';
//             }
//             return `€ ${val}`;
//           },
//           offsetY: 10,
//         },
//         fill: {
//           type: series.map((i) => i.fill),
//         },
//         labels,
//         xaxis: {
//           show: 'datetime',
//         },
//         yaxis: {
//           labels: {
//             show: false,
//           },
//         },
//         grid: {
//           show: true,
//         },
//         tooltip: {
//           shared: true,
//           intersect: false,
//           y: {
//             formatter: (value) => {
//               if (typeof value !== 'undefined') {
//                 return `€ ${value.toFixed(0)}`;
//               }
//               return value;
//             },
//           },
//         },
//         ...options,
//       });

//       const lastMonthIncome = series[0].data.reduce((total, income) => total + income, 0);
//       const lastMonthExpense = series[1].data.reduce((total, income) => total + income, 0);
//       const savingRate = ((lastMonthIncome - lastMonthExpense) / lastMonthIncome) * 100;

//       let color = 'info';
//       let icon = 'fluent-mdl2:unknown-solid';

//       if (savingRate > 20) {
//         color = 'success';
//         icon = 'fluent:emoji-48-filled';
//       } else if (savingRate > 0) {
//         color = 'warning';
//         icon = 'fluent:emoji-meh-24-filled';
//       } else if (savingRate < 0) {
//         icon = 'fluent:emoji-sad-20-filled';
//         color = 'error';
//       }

//       // Update the refs with the new values
//       seriesRef.current = series;
//       chartOptionsRef.current = chartOptions;
//       lastMonthIncomeRef.current = lastMonthIncome;
//       lastMonthExpenseRef.current = lastMonthExpense;
//       savingRateRef.current = savingRate;
//       colorRef.current = color;
//       iconRef.current = icon;
//     }
//   }, [chart, theme.palette.success.main, theme.palette.error.main]);

//   return (
//     <Stack
//       spacing={2}
//       sx={{
//         ...bgGradient({
//           direction: '135deg',
//           startColor: alpha(theme.palette[colorRef].light, 0.2),
//           endColor: alpha(theme.palette[colorRef].main, 0.2),
//         }),
//         width: 1,
//         borderRadius: 2,
//         overflow: 'hidden',
//         position: 'relative',
//         color: `${colorRef}.darker`,
//         backgroundColor: 'common.white',
//         ...sx,
//       }}
//       {...other}
//     >
//       <Iconify
//         icon={iconRef}
//         sx={{
//           p: 1.5,
//           top: 24,
//           right: 24,
//           width: 52,
//           height: 52,
//           borderRadius: '50%',
//           position: 'absolute',
//           color: `${colorRef}.lighter`,
//           bgcolor: `${colorRef}.dark`,
//         }}
//       />

//       <Stack spacing={1} sx={{ p: 3 }}>
//         <Typography variant="subtitle2">{title}</Typography>

//         <Typography variant="h4">{fCurrency(lastMonthIncomeRef - lastMonthExpenseRef)}</Typography>

//         <Stack
//           spacing={0.5}
//           direction="row"
//           flexWrap="wrap"
//           alignItems="center"
//           sx={{ typography: 'body2' }}
//         >
//           <Iconify icon={savingRateRef < 0 ? 'eva:trending-down-fill' : 'eva:trending-up-fill'} />

//           <Box sx={{ typography: 'subtitle2' }}>
//             {savingRateRef > 0 && '+'}
//             {fPercent(savingRateRef)}
//           </Box>

//           <Box sx={{ opacity: 0.8 }}>saving rate this month</Box>
//         </Stack>
//       </Stack>

//       {chart ? (
//         <Chart
//           sx={{ m: 1, pt: 1 }}
//           dir="ltr"
//           type="bar"
//           series={seriesRef}
//           options={chartOptionsRef}
//           width="100%"
//           height={200}
//         />
//       ) : (
//         <EmptyContent sx={{ mb: 2 }} title="No data" />
//       )}
//     </Stack>
//   );
// }

// BankingWidgetSummary.propTypes = {
//   chart: PropTypes.object,
//   sx: PropTypes.object,
//   title: PropTypes.string,
// };
