'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import axios from 'axios'

// Create categories context
const CategoriesContext = createContext({
  categories: [],
  isLoading: false,
  error: null,
  refreshCategories: async () => {},
  createCategory: async () => {},
  updateCategory: async () => {},
  deleteCategory: async () => {},
})

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch all categories
  const refreshCategories = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data } = await axios.get('/api/categories')
      setCategories(data)
      return data
    } catch (err) {
      setError(err.message)
      console.error('Error fetching categories:', err)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Create a new category
  const createCategory = useCallback(async (categoryData) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: newCategory } = await axios.post('/api/categories', categoryData)
      setCategories(prev => [...prev, newCategory])
      return newCategory
    } catch (err) {
      setError(err.message)
      console.error('Error creating category:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Update an existing category
  const updateCategory = useCallback(async (categoryData) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: updatedCategory } = await axios.put('/api/categories', categoryData)
      setCategories(prev => 
        prev.map(cat => cat.id === updatedCategory.id ? updatedCategory : cat)
      )
      return updatedCategory
    } catch (err) {
      setError(err.message)
      console.error('Error updating category:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Delete a category
  const deleteCategory = useCallback(async (categoryId) => {
    try {
      setIsLoading(true)
      setError(null)
      
      await axios.delete(`/api/categories?id=${categoryId}`)
      setCategories(prev => prev.filter(cat => cat.id !== categoryId))
      return true
    } catch (err) {
      setError(err.message)
      console.error('Error deleting category:', err)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load categories on initial mount
  useEffect(() => {
    refreshCategories()
  }, [refreshCategories])

  const value = {
    categories,
    isLoading,
    error,
    refreshCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  }

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  )
}

// Hook for using the categories context
export function useCategories() {
  const context = useContext(CategoriesContext)
  
  if (context === undefined) {
    throw new Error('useCategories must be used within a CategoriesProvider')
  }
  
  return context
}
