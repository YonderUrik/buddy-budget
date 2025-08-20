export const formatCurrency = (amount: number, currency: string = 'EUR') => {
   const absAmount = Math.abs(amount);
   
   if (absAmount >= 1000000) {
      return new Intl.NumberFormat(undefined, {
         style: 'currency',
         currency: currency || 'EUR',
         minimumFractionDigits: 1,
         maximumFractionDigits: 1,
         notation: 'compact',
         compactDisplay: 'short'
      }).format(amount);
   }

   return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
   }).format(amount);
}