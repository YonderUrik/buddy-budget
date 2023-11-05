import { format, getTime, formatDistanceToNow, formatDistance } from 'date-fns';

// ----------------------------------------------------------------------

export function fDate(date, newFormat) {
  const fm = newFormat || 'dd MMM yyyy';

  return date ? format(new Date(date), fm) : '';
}

export function fDateTime(date, newFormat) {
  const fm = newFormat || 'dd MMM yyyy p';

  return date ? format(new Date(date), fm) : '';
}

export function fTimestamp(date) {
  return date ? getTime(new Date(date)) : '';
}

export function fToNow(date) {
  try {
    return date
      ? formatDistanceToNow(new Date(date), {
          addSuffix: true,
        })
      : '';
  } catch (error) {
    console.error(error);
    return date;
  }
}

export function formatRange(startDate, endDate) {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  const startFormatted = startDate.toLocaleDateString(undefined, options);
  const endFormatted = endDate.toLocaleDateString(undefined, options);
  
  return `from ${startFormatted} to ${endFormatted}`;
}

