// Synthetic transactions only. Never commit a personal broker export.
export const trHeaders = ['datetime','date','account_type','category','type','asset_class','name','symbol','shares','price','amount','fee','tax','currency','original_amount','original_currency','fx_rate','description','transaction_id','counterparty_name','counterparty_iban','payment_reference','mcc_code'];
export const trRows: Record<string, string>[] = [
  { type: 'CUSTOMER_INPAYMENT', amount: '1000' },
  { category: 'TRADING', type: 'BUY', asset_class: 'CRYPTO', name: 'Ethereum', symbol: 'ETH', shares: '0.1', price: '2000', amount: '-200', fee: '-1' },
  { category: 'TRADING', type: 'SELL', asset_class: 'CRYPTO', name: 'Ethereum', symbol: 'ETH', shares: '-0.000002', price: '2000', amount: '0.00', fee: '-1' },
  { type: 'CARD_TRANSACTION', name: 'Example shop, ltd', amount: '-25', mcc_code: '5411' },
  { type: 'CARD_TRANSACTION_INTERNATIONAL', name: 'Other shop', amount: '-10', original_amount: '-11', original_currency: 'USD', fx_rate: '1.1' },
  { type: 'INTEREST_PAYMENT', amount: '10', tax: '-2.60' },
  { type: 'CARD_TRANSACTION', name: 'Refund', amount: '5' },
  { type: 'TAX_OPTIMIZATION', amount: '0', tax: '-1' },
];
/** Render the same CSV columns as a Transaction export with synthetic, stable IDs. */
export function tradeRepublicCsv(rows = trRows) {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
  return [trHeaders, ...rows.map((r, i) => {
    const row: Record<string, string> = { datetime: '2024-01-01T10:00:00Z', date: '2024-01-01', account_type: 'DEFAULT', category: 'CASH', currency: 'EUR', transaction_id: `synthetic-${i}`, ...r };
    return trHeaders.map((h) => row[h] ?? '');
  })].map((r) => r.map(quote).join(',')).join('\n');
}
