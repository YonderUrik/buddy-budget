import yahooFinance from 'yahoo-finance2';

export async function getExchangeRates(fromCurrency, toCurrency) {
   
   const quote = await yahooFinance.quote(fromCurrency + toCurrency + '=X')
   const exchangeRate = parseFloat(quote.regularMarketPrice)

   return exchangeRate
}