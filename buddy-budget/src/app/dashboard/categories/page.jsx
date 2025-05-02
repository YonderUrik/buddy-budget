'use client'

import React, { useState, useEffect } from "react"
import { useCategories } from "@/providers/categories-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
   Trash2,
   Plus,
   Pencil,
   TrendingUp,
   TrendingDown,
   Sparkles,
   ShoppingBag,
   Tag,
   Loader2
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog"
import ColorPicker from "@/components/selectors/color-picker"
import IconPicker from "@/components/selectors/icon-picker"
import { expenseIcons, incomeIcons } from "@/lib/config"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function CategoriesPage() {
   const { categories, isLoading, error, createCategory, updateCategory, deleteCategory } = useCategories()
   const { t } = useTranslation()

   const [activeTab, setActiveTab] = useState("expense")
   const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
   const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
   const [isProcessing, setIsProcessing] = useState(false)
   const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState(Date.now())
   const [categoryToEdit, setCategoryToEdit] = useState(null)
   const [categoryData, setCategoryData] = useState({
      name: "",
      type: "expense",
      color: "#2563eb",
      icon: "shopping-bag",
   })

   // Reset form when changing tabs
   useEffect(() => {
      setCategoryData((prev) => ({
         ...prev,
         type: activeTab,
         icon: activeTab === "income" ? "dollar-sign" : "shopping-bag",
      }))
   }, [activeTab])

   // Reset form when opening dialog
   useEffect(() => {
      if (isAddDialogOpen) {
         setCategoryData({
            name: "",
            type: activeTab,
            color: "#2563eb",
            icon: activeTab === "income" ? "dollar-sign" : "shopping-bag",
         })
      }
   }, [isAddDialogOpen, activeTab])

   // Set form data when editing
   useEffect(() => {
      if (categoryToEdit) {
         setCategoryData({
            id: categoryToEdit.id,
            name: categoryToEdit.name,
            type: categoryToEdit.type,
            color: categoryToEdit.color,
            icon: categoryToEdit.icon,
         })
      }
   }, [categoryToEdit])

   // Get filtered categories for current tab
   const filteredCategories = categories.filter((category) => category.type === activeTab)

   // Handler for adding a new category
   const handleAddCategory = async () => {
      if (categoryData.name.trim() === "") return

      try {
         setIsProcessing(true)
         await createCategory({
            name: categoryData.name,
            type: categoryData.type,
            color: categoryData.color,
            icon: categoryData.icon,
         })

         setIsAddDialogOpen(false)
         setLastUpdateTimestamp(Date.now())

         toast.success(t("categories.categoryAdded"))
      } catch (err) {
         toast.error(t("common.error"))
      } finally {
         setIsProcessing(false)
      }
   }

   // Handler for updating a category
   const handleUpdateCategory = async () => {
      if (categoryData.name.trim() === "") return

      try {
         setIsProcessing(true)
         await updateCategory({
            id: categoryData.id,
            name: categoryData.name,
            type: categoryData.type,
            color: categoryData.color,
            icon: categoryData.icon,
         })

         setIsEditDialogOpen(false)
         setCategoryToEdit(null)
         setLastUpdateTimestamp(Date.now())
         toast.success(t("categories.categoryUpdated"))
      } catch (err) {
         toast.error(t("common.error"))
      } finally {
         setIsProcessing(false)
      }
   }

   // Handler for deleting a category
   const handleDeleteCategory = async (id) => {
      try {
         await deleteCategory(id)
         setLastUpdateTimestamp(Date.now())
         toast.success(t("categories.categoryDeleted"))
      } catch (err) {
         toast.error(t("common.error"))
      }
   }

   // Get the appropriate icon component
   const getIconComponent = (iconName, size = 4) => {
      const icons = [...expenseIcons, ...incomeIcons]
      const icon = icons.find((i) => i.value === iconName)

      if (!icon) {
         return <ShoppingBag className={`h-${size} w-${size}`} />
      }

      return React.cloneElement(icon.icon, {
         className: `h-${size} w-${size}`,
      })
   }

   // Animation variants
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

   // Render empty state
   const renderEmptyState = () => (
      <motion.div
         className="text-center py-8 border border-dashed rounded-lg"
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         key={`empty-${activeTab}-${lastUpdateTimestamp}`}
      >
         <p className="text-gray-500 mb-4">
            {t("categories.noCategories", { type: activeTab === "income" ? t("common.income") : t("common.expenses") })}
         </p>
         <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
         >
            <Plus className="h-4 w-4 mr-2" />
            {t("onboarding_categories.addCategory")}
         </Button>
      </motion.div>
   )

   // Render category items
   const renderCategoryItems = () => {
      if (filteredCategories.length === 0) {
         return renderEmptyState()
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
                  <div className="flex space-x-1">
                     <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 onClick={() => {
                                    setCategoryToEdit(category)
                                    setIsEditDialogOpen(true)
                                 }}
                                 className="text-gray-400 hover:text-blue-500 transition-colors"
                              >
                                 <Pencil className="h-4 w-4" />
                              </Button>
                           </TooltipTrigger>
                           <TooltipContent>
                              <p>{t("categories.editCategory")}</p>
                           </TooltipContent>
                        </Tooltip>
                     </TooltipProvider>

                     <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Button
                                 variant="ghost"
                                 size="icon"
                                 onClick={() => handleDeleteCategory(category.id)}
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
                  </div>
               </motion.div>
            ))}
         </motion.div>
      )
   }

   if (isLoading && categories.length === 0) {
      return (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-lg">{t("common.loading")}</span>
         </div>
      )
   }

   return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6"
         >
            <h1 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-2">
               {t("sidebar.categories")}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
               {t("onboarding_categories.categoryDesc")}
            </p>
         </motion.div>

         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                  {renderCategoryItems()}
               </TabsContent>
            </AnimatePresence>
         </Tabs>

         <motion.div
            className="mt-6 flex justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
         >
            <Button
               onClick={() => setIsAddDialogOpen(true)}
               className="bg-blue-600 hover:bg-blue-700 text-white"
            >
               <Plus className="h-4 w-4 mr-2" />
               {t("onboarding_categories.addCategory")}
            </Button>
         </motion.div>

         {/* Add Category Dialog */}
         <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
               <DialogHeader>
                  <DialogTitle>
                     {t("onboarding_categories.addNew")} {activeTab === "income" ? t("common.income") : t("common.expenses")} {t("common.category")}
                  </DialogTitle>
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
                        value={categoryData.name}
                        onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
                        className="transition-all focus-within:ring-blue-500"
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.categoryNameDesc")}</p>
                  </div>

                  <div className="space-y-2">
                     <Label>{t("common.icon")}</Label>
                     <IconPicker
                        currentValue={categoryData.icon}
                        icons={currentIcons}
                        setValue={(value) => setCategoryData({ ...categoryData, icon: value })}
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.iconDesc")}</p>
                  </div>

                  <div className="space-y-2">
                     <Label>{t("common.color")}</Label>
                     <ColorPicker
                        currentValue={categoryData.color}
                        setValue={(value) => setCategoryData({ ...categoryData, color: value })}
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.colorDesc")}</p>
                  </div>
               </div>
               <DialogFooter>
                  <Button
                     onClick={handleAddCategory}
                     disabled={!categoryData.name.trim() || isProcessing}
                     className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                     {isProcessing ? (
                        <>
                           <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("common.processing")}
                        </>
                     ) : (
                        <>
                           <Plus className="h-4 w-4 mr-2" /> {t("common.add")} {t("common.category")}
                        </>
                     )}
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>

         {/* Edit Category Dialog */}
         <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
               <DialogHeader>
                  <DialogTitle>
                     {t("categories.editCategory")}
                  </DialogTitle>
                  <DialogDescription>
                     {t("categories.editCategoryDesc")}
                  </DialogDescription>
               </DialogHeader>
               <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                     <Label htmlFor="edit-category-name">{t("onboarding_categories.categoryName")}</Label>
                     <Input
                        id="edit-category-name"
                        placeholder={t("onboarding_categories.exampleCategoryDesc")}
                        value={categoryData.name}
                        onChange={(e) => setCategoryData({ ...categoryData, name: e.target.value })}
                        className="transition-all focus-within:ring-blue-500"
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.categoryNameDesc")}</p>
                  </div>

                  <div className="space-y-2">
                     <Label>{t("common.icon")}</Label>
                     <IconPicker
                        currentValue={categoryData.icon}
                        icons={activeTab === "income" ? incomeIcons : expenseIcons}
                        setValue={(value) => setCategoryData({ ...categoryData, icon: value })}
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.iconDesc")}</p>
                  </div>

                  <div className="space-y-2">
                     <Label>{t("common.color")}</Label>
                     <ColorPicker
                        currentValue={categoryData.color}
                        setValue={(value) => setCategoryData({ ...categoryData, color: value })}
                     />
                     <p className="text-xs text-gray-500">{t("onboarding_categories.colorDesc")}</p>
                  </div>
               </div>
               <DialogFooter>
                  <Button
                     onClick={handleUpdateCategory}
                     disabled={!categoryData.name.trim() || isProcessing}
                     className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                     {isProcessing ? (
                        <>
                           <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("common.processing")}
                        </>
                     ) : (
                        <>
                           {t("categories.updateCategory")}
                        </>
                     )}
                  </Button>
               </DialogFooter>
            </DialogContent>
         </Dialog>
      </div>
   )
}