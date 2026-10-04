/** Fully synthetic, internally reconciled annual statements for integration tests. */
export function brokerSeries(year: 2023 | 2024, account = "U90000001"): string {
  const first = year === 2023;
  const cash = first ? 999 : 1108;
  return [
    'Statement,Header,Field Name,Field Value',
    'Statement,Data,BrokerName,Interactive Brokers Ireland Limited',
    'Statement,Data,Title,Activity Statement',
    `Statement,Data,Period,"January 1, ${year} - December 31, ${year}"`,
    'Account Information,Header,Field Name,Field Value',
    `Account Information,Data,Account,${account}`,
    'Account Information,Data,Base Currency,EUR',
    'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,Proceeds,Comm/Fee,Basis,Code',
    first ? 'Trades,Data,Order,Stocks,EUR,PARENT,"2023-01-02, 10:00:00",10,100,-1000,-1,1001,O' : 'Trades,Data,Order,Stocks,EUR,CHILD,"2024-02-02, 10:00:00",-2,55,110,-1,-100,C',
    ...(first ? ['Deposits & Withdrawals,Header,Currency,Settle Date,Description,Amount', 'Deposits & Withdrawals,Data,EUR,2023-01-01,Deposit,2000'] : [
      'Corporate Actions,Header,Asset Category,Currency,Report Date,Date/Time,Description,Quantity,Proceeds,Value,Realized P/L,Code',
      'Corporate Actions,Data,Stocks,EUR,2024-02-01,"2024-02-01, 00:00:00","PARENT(US9000000011) Spinoff 1 for 5 (CHILD, Synthetic Child, US9000000029)",2,0,0,0,',
    ]),
    'Financial Instrument Information,Header,Asset Category,Symbol,Description,Security ID',
    'Financial Instrument Information,Data,Stocks,PARENT,Synthetic Parent,US9000000011',
    'Financial Instrument Information,Data,Stocks,CHILD,Synthetic Child,US9000000029',
    'Open Positions,Header,DataDiscriminator,Asset Category,Currency,Symbol,Quantity,Cost Basis,Close Price,Value,Unrealized P/L',
    `Open Positions,Data,Summary,Stocks,EUR,PARENT,10,${first ? 1001 : 901},100,1000,${first ? -1 : 99}`,
    'Cash Report,Header,Currency Summary,Currency,Total',
    `Cash Report,Data,Starting Cash,EUR,${first ? 0 : 999}`,
    'Cash Report,Data,Commissions,EUR,-1',
    `Cash Report,Data,Ending Cash,EUR,${cash}`,
    'Net Asset Value,Header,Asset Class,Prior Total,Current Total',
    `Net Asset Value,Data,Cash,${first ? 0 : 999},${cash}`,
    `Net Asset Value,Data,Stock,${first ? 0 : 1000},1000`,
    `Net Asset Value,Data,Total,${first ? 0 : 1999},${cash + 1000}`,
  ].join('\n');
}
