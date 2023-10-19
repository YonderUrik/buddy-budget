import numeral from 'numeral';

// ----------------------------------------------------------------------

export function fNumber(number) {
  return numeral(number).format();
}

export function fCurrency(number) {
  if (typeof number !== 'number') {
    return ''; // Handle invalid input gracefully
  }

  const formattedCurrency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR', // Use 'EUR' for euros
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);

  return formattedCurrency;
}

export function fPercent(number) {
  const format = number ? numeral(Number(number) / 100).format('0.0%') : '';

  return result(format, '.0');
}

export function fShortenNumber(number) {
  const format = number ? numeral(number).format('0.00a') : '';

  return result(format, '.00');
}

export function fData(number) {
  const format = number ? numeral(number).format('0.0 b') : '';

  return result(format, '.0');
}

function result(format, key = '.00') {
  const isInteger = format.includes(key);

  return isInteger ? format.replace(key, '') : format;
}
