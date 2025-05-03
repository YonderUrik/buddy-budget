'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const WealthContext = createContext({
   wealthSnapshots: [],
   isLoading: false,
   error: null,
   refreshWealthSnapshots: async () => { },
})

export function WealthProvider({ children }) {
   const [wealthSnapshots, setWealthSnapshots] = useState([])
   const [isLoading, setIsLoading] = useState(true)
   const [error, setError] = useState(null)
   const [limit, setLimit] = useState(2)
   const [skip, setSkip] = useState(0)
   const [sortBy, setSortBy] = useState('timestamp')
   const [sortOrder, setSortOrder] = useState('asc')
   const [fromDate, setFromDate] = useState(null)
   const [toDate, setToDate] = useState(null)

   const refreshWealthSnapshots = useCallback(async () => {
      try {
         setIsLoading(true)
         setError(null)

         const { data } = await axios.get('/api/wealth-snapshots', {
            params: {
               limit,
               skip,
               sortBy,
               sortOrder,
               fromDate,
               toDate
            }
         })

         setWealthSnapshots(data)
         return data
      } catch (err) {
         setError(err.message)
         console.error('Error fetching wealth snapshots:', err)
         return []
      } finally {
         setIsLoading(false)
      }
   }, [limit, skip, sortBy, sortOrder, fromDate, toDate])

   useEffect(() => {
      refreshWealthSnapshots()
   }, [refreshWealthSnapshots])

   const value = {
      wealthSnapshots,
      isLoading,
      error,
      refreshWealthSnapshots,
      limit,
      setLimit,
      skip,
      setSkip,
      sortBy,
      setSortBy,
      sortOrder,
      setSortOrder,
      fromDate,
      setFromDate,
      toDate,
      setToDate
   }

   return (
      <WealthContext.Provider value={value}>
         {children}
      </WealthContext.Provider>
   )
}

export function useWealth() {
   const context = useContext(WealthContext)

   if (context === undefined) {
      throw new Error('useWealth must be used within a WealthProvider')
   }

   return context
}
