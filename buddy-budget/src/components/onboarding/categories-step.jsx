"use client"

import React, { useMemo } from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Trash2,
  Plus,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShoppingBag,
  Tag,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import ColorPicker from "../selectors/color-picker"
import IconPicker from "../selectors/icon-picker"
import { defaultExpenseCategories, defaultIncomeCategories, expenseIcons, incomeIcons } from "@/lib/config"
import { useTranslation } from "react-i18next"
export function CategoriesStep({ categories, setCategories, onNext, onBack }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState("expense")
  const [newCategory, setNewCategory] = useState({
    name: "",
    type: "expense",
    color: "#2563eb",
    icon: "shopping-bag", // Default icon
  })
  // Add a state to track when categories were last updated
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now())

  // Update new category type when tab changes
  useEffect(() => {
    setNewCategory((prev) => ({
      ...prev,
      type: activeTab,
      // Set default icon based on type
      icon: activeTab === "income" ? "dollar-sign" : "shopping-bag",
    }))
  }, [activeTab])

  // Add effect to update timestamp when categories change
  useEffect(() => {
    // This effect will run whenever the categories prop changes
    setLastUpdateTimestamp(Date.now());
  }, [categories]);

  // New function to add both expense and income default categories
  const addAllDefaultCategories = () => {
    // First add expense categories
    const expenseTimestamp = Date.now()
    const newExpenseCategories = defaultExpenseCategories.map((cat, index) => ({
      id: `default-expense-${index}-${expenseTimestamp}`,
      name: t(`categories.${cat.name}`, { defaultValue: cat.name }),
      type: 'expense',
      color: cat.color,
      icon: cat.icon,
    }))

    // Then add income categories
    const incomeTimestamp = Date.now() + 1 // ensure different timestamp
    const newIncomeCategories = defaultIncomeCategories.map((cat, index) => ({
      id: `default-income-${index}-${incomeTimestamp}`,
      name: t(`categories.${cat.name}`, { defaultValue: cat.name }),
      type: 'income',
      color: cat.color,
      icon: cat.icon,
    }))

    // Combine both category types
    const allNewCategories = [...newExpenseCategories, ...newIncomeCategories]

    // Filter out any existing categories with the same name and type
    const filteredNewCategories = allNewCategories.filter(
      (newCat) =>
        !categories.some((existingCat) => existingCat.name === newCat.name && existingCat.type === newCat.type),
    )

    if (filteredNewCategories.length > 0) {
      // Use the callback version of setCategories to ensure we're working with the latest state
      setCategories(prevCategories => {
        // Create a new array with all categories to ensure React detects the change
        return [...prevCategories, ...filteredNewCategories];
      });
      
      // Force an immediate update by updating the state
      setLastUpdateTimestamp(Date.now());
    }
  }

  const addCategory = () => {
    if (newCategory.name.trim() === "") return

    setCategories(prevCategories => [
      ...prevCategories,
      {
        ...newCategory,
        type: activeTab,
        id: `custom-${Date.now()}`,
      },
    ]);

    // Force an immediate update
    setLastUpdateTimestamp(Date.now());

    // Reset form
    setNewCategory({
      name: "",
      type: activeTab,
      color: "#2563eb",
      icon: activeTab === "income" ? "dollar-sign" : "shopping-bag",
    })
  }

  const removeCategory = (id) => {
    setCategories(prevCategories => prevCategories.filter(category => category.id !== id));
    
    // Force an immediate update
    setLastUpdateTimestamp(Date.now());
  }

  // Get categories for the active tab - force refresh when lastUpdateTimestamp changes
  const filteredCategories = categories.filter((category) => category.type === activeTab);

  // Get the appropriate icon component
  const getIconComponent = (iconName, size = 4) => {
    const icons = [...expenseIcons, ...incomeIcons]
    const icon = icons.find((i) => i.value === iconName)

    if (!icon) {
      // Default icon if not found
      return <ShoppingBag className={`h-${size} w-${size}`} />
    }

    // Clone the icon element with the new size
    return React.cloneElement(icon.icon, {
      className: `h-${size} w-${size}`,
    })
  }


  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2 },
    },
  }

  // Get the current icons based on active tab
  const currentIcons = activeTab === "income" ? incomeIcons : expenseIcons

  // Render category items
  const renderCategoryItems = useMemo(() => {
    if (filteredCategories.length === 0) {
      return (
        <motion.div
          className="text-center py-8 border border-dashed rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          key={`empty-${activeTab}-${lastUpdateTimestamp}`}
        >
          <p className="text-gray-500 mb-4">No {activeTab} {t("common.categories")}</p>
          <Button
            onClick={addAllDefaultCategories}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {t("onboarding_categories.addDefaultCategories")}
          </Button>
        </motion.div>
      )
    }

    return (
      <motion.div 
        className="grid gap-3" 
        variants={containerVariants} 
        initial="hidden" 
        animate="visible"
        key={`categories-${activeTab}-${lastUpdateTimestamp}`}
      >
        {filteredCategories.map((category) => (
          <motion.div
            key={category.id}
            className="flex items-center justify-between p-3 border rounded-lg"
            style={{ borderLeftColor: category.color, borderLeftWidth: "4px" }}
            variants={itemVariants}
            layout
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: category.color + "20" }}
              >
                {getIconComponent(category.icon, 5)}
              </div>
              <p>{category.name}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCategory(category.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("onboarding_categories.removeCategory")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ))}
      </motion.div>
    )
  }, [filteredCategories, lastUpdateTimestamp])

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-2xl font-semibold mb-2 text-blue-600 dark:text-blue-400">
          {t("onboarding_categories.categoryTitle")}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t("onboarding_categories.categoryDesc")}
        </p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger
            value="expense"
            className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 flex items-center gap-2"
          >
            <TrendingDown className="h-4 w-4" />
            {t("common.expenses")}
          </TabsTrigger>
          <TabsTrigger
            value="income"
            className="data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900/50 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 flex items-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            {t("common.income")}
          </TabsTrigger>
        </TabsList>

        <AnimatePresence mode="wait">
          <TabsContent 
            value={activeTab} 
            className="space-y-6 pt-2"
            key={`${activeTab}-${categories.length}-${lastUpdateTimestamp}`}
          >
            {renderCategoryItems}
          </TabsContent>
        </AnimatePresence>
      </Tabs>

      <motion.div
        className="space-y-4 border-t pt-6 mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Tag className="h-4 w-4 text-blue-500" />
            {activeTab === "income" ? t("common.income") : t("common.expenses")} {t("common.categories")}
          </h3>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" /> {t("onboarding_categories.addCategory")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{t("onboarding_categories.addNew")} {activeTab === "income" ? t("common.income") : t("common.expenses")} {t("common.category")}</DialogTitle>
                <DialogDescription>
                  {t("onboarding_categories.categoryDesc")}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="category-name">{t("onboarding_categories.categoryName")}</Label>
                  <Input
                    id="category-name"
                    placeholder={t("onboarding_categories.exampleCategoryDesc")}
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="transition-all focus-within:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500">{t("onboarding_categories.categoryNameDesc")}</p>
                </div>

                {/* Icon Selection */}
                <div className="space-y-2">
                  <Label>{t("common.icon")}</Label>
                  <IconPicker
                    currentValue={newCategory.icon}
                    icons={currentIcons}
                    setValue={(value) => setNewCategory({ ...newCategory, icon: value })}
                  />
                  <p className="text-xs text-gray-500">{t("onboarding_categories.iconDesc")}</p>
                </div>

                {/* Color Selection */}
                <div className="space-y-2">
                  <Label>{t("common.color")}</Label>
                  <ColorPicker
                    currentValue={newCategory.color}
                    setValue={(value) => setNewCategory({ ...newCategory, color: value })}
                  />
                  <p className="text-xs text-gray-500">{t("onboarding_categories.colorDesc")}</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={addCategory}
                  disabled={!newCategory.name.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" /> {t("common.add")} {activeTab === "income" ? t("common.income") : t("common.expenses")} {t("common.category")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div
        className="flex justify-between pt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </Button>
        <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700 text-white">
          {t("common.continue")}
        </Button>
      </motion.div>
    </div>
  )
}

