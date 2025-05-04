'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

const AccountsContext = createContext({
   accounts: [],
   isLoading: false,
   error: null,
   refreshAccounts: async () => { },
   createAccount: async () => { },
   updateAccount: async () => { },
   deleteAccount: async () => { },
})

export function AccountsProvider({ children }) {
   const [accounts, setAccounts] = useState([])
   const [isLoading, setIsLoading] = useState(true)
   const [error, setError] = useState(null)

   const refreshAccounts = useCallback(async () => {
      try {
         setIsLoading(true)
         setError(null)

         const { data } = await axios.get('/api/accounts')
         setAccounts(data)
         return data
      } catch (err) {
         setError(err.message)
         console.error('Error fetching accounts:', err)
         return []
      } finally {
         setIsLoading(false)
      }
   }, [])

   const createAccount = useCallback(async (account) => {
      try {
         const { data } = await axios.post('/api/accounts', account)
         setAccounts((prev) => [...prev, data])
         return data
      } catch (err) {
         setError(err.message)
         console.error('Error creating account:', err)
         return null
      } finally {
         setIsLoading(false)
      }
   }, [])

   const updateAccount = useCallback(async (account) => {
      try {
         const { data } = await axios.put(`/api/accounts`, account)
         setAccounts((prev) => prev.map((a) => a.id === account.id ? data : a))
         return data
      } catch (err) {
         setError(err.message)
         console.error('Error updating account:', err)
         return null
      } finally {
         setIsLoading(false)
      }
   }, [])

   const deleteAccount = useCallback(async (id) => {
      try {
         await axios.delete(`/api/accounts`, { data: { id } })
         setAccounts((prev) => prev.filter((a) => a.id !== id))
         return true
      } catch (err) {
         setError(err.message)
         console.error('Error deleting account:', err)
         return false
      }
   }, [])

   useEffect(() => {
      refreshAccounts()
   }, [refreshAccounts])

   const value = {
      accounts,
      isLoading,
      error,
      refreshAccounts,
      createAccount,
      updateAccount,
      deleteAccount,
   }

   return (
      <AccountsContext.Provider value={value}>
         {children}
      </AccountsContext.Provider>
   )
}

export function useAccounts() {
   const context = useContext(AccountsContext)

   if (context === undefined) {
      throw new Error('useAccounts must be used within a AccountsProvider')
   }

   return context
}