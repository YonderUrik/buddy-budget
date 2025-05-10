import yahooFinance from 'yahoo-finance2';

export async function getExchangeRates(fromCurrency, toCurrency, date=null) {
   let exchangeRate;
   
   if (date) {
      // Get historical exchange rate for the specific date
      const options = { 
         period1: date, // date is already a Date object
         period2: new Date(date.getTime() + 24 * 60 * 60 * 1000) // Next day
      };

      console.log(" Exchange rates options", options);
      
      const result = await yahooFinance.historical(fromCurrency + toCurrency + '=X', options);
      
      if (result && result.length > 0) {
         // Use the closing price from the historical data
         exchangeRate = parseFloat(result[0].close);
      } else {
         // Fallback to current rate if historical data is not available
         const quote = await yahooFinance.quote(fromCurrency + toCurrency + '=X');
         exchangeRate = parseFloat(quote.regularMarketPrice);
      }
   } else {
      // Get current exchange rate
      const quote = await yahooFinance.quote(fromCurrency + toCurrency + '=X');
      exchangeRate = parseFloat(quote.regularMarketPrice);
   }

   return exchangeRate;
}