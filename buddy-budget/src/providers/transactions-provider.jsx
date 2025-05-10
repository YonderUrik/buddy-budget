'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const TransactionsContext = createContext({
   transactions: [],
   isLoading: false,
   error: null,
   refreshTransactions: async () => { },
   createTransaction: async () => { },
   page: 1,
   setPage: () => { },
   daysPerPage: 10,
   setDaysPerPage: () => { },
   totalDays: 0,
   totalPages: 0,
   daysOnThisPage: 0,
   searchTerm: '',
   setSearchTerm: () => { },
   filters: {},
   setFilters: () => { },
   clearFilters: () => { },
})

export function TransactionsProvider({ children }) {
   const [transactions, setTransactions] = useState([]);
   const [totalDays, setTotalDays] = useState(0);
   const [totalPages, setTotalPages] = useState(0);
   const [daysOnThisPage, setDaysOnThisPage] = useState(0);
   const [isLoading, setIsLoading] = useState(true);
   const [error, setError] = useState(null);
   const [page, setPage] = useState(1);
   const [daysPerPage, setDaysPerPage] = useState(10);
   const [searchTerm, setSearchTerm] = useState('');
   const [filters, setFilters] = useState({
      type: [],
      categoryId: [],
      sourceAccountId: [],
      dateFrom: null,
      dateTo: null,
   });

   const clearFilters = useCallback(() => {
      setFilters({
         type: [],
         categoryId: [],
         sourceAccountId: [],
         dateFrom: null,
         dateTo: null,
      });
      setSearchTerm('');
   }, []);

   const refreshTransactions = useCallback(async () => {
      try {
         setIsLoading(true);
         setError(null);

         // Prepare date params - ensure proper date format for API
         let dateFromParam = undefined;
         let dateToParam = undefined;

         if (filters.dateFrom) {
            dateFromParam = filters.dateFrom.toISOString();
         }
         
         if (filters.dateTo) {
            dateToParam = filters.dateTo.toISOString();
         }

         const response = await axios.get('/api/transactions', {
            params: {
               page,
               daysPerPage,
               searchTerm: searchTerm || undefined,
               type: filters.type.length ? filters.type.join(',') : undefined,
               categoryId: filters.categoryId.length ? filters.categoryId.join(',') : undefined,
               sourceAccountId: filters.sourceAccountId.length ? filters.sourceAccountId.join(',') : undefined,
               dateFrom: dateFromParam,
               dateTo: dateToParam,
            },
         });

         const { groupedTransactions, totalPages, totalDays, daysOnThisPage } = response.data;

         setTransactions(groupedTransactions);
         setTotalDays(totalDays);
         setTotalPages(totalPages);
         setDaysOnThisPage(daysOnThisPage);
      } catch (err) {
         setError(err.message);
         console.error('Error fetching transactions:', err);
         return [];
      } finally {
         setIsLoading(false);
      }
   }, [page, daysPerPage, searchTerm, filters]);

   const createTransaction = useCallback(async (transaction) => {
      try {
         const { data } = await axios.post('/api/transactions', transaction);
         refreshTransactions();
         return data;
      } catch (err) {
         setError(err.message);
         console.error('Error creating transaction:', err);
         return null;
      }
   }, [refreshTransactions]);

   useEffect(() => {
      refreshTransactions();
   }, [refreshTransactions, page, daysPerPage, searchTerm, filters]);

   const value = {
      transactions,
      isLoading,
      error,
      refreshTransactions,
      createTransaction,
      page,
      setPage,
      daysPerPage,
      setDaysPerPage,
      totalDays,
      totalPages,
      daysOnThisPage,
      searchTerm,
      setSearchTerm,
      filters,
      setFilters,
      clearFilters,
   }

   return (
      <TransactionsContext.Provider value={value}>
         {children}
      </TransactionsContext.Provider>
   )
}

export function useTransactions() {
   const context = useContext(TransactionsContext);

   if (context === undefined) {
      throw new Error('useTransactions must be used within a TransactionsProvider');
   }

   return context;
}