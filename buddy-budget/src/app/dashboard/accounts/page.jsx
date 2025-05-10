"use client"

import { useState, useEffect } from "react"
import { useAccounts } from "@/providers/accounts-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Pencil, Wallet, Loader2, ChevronRight, CreditCard } from "lucide-react"
import {
   Drawer,
   DrawerContent,
   DrawerHeader,
   DrawerTitle,
   DrawerTrigger,
} from "@/components/ui/drawer"
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { accountTypes, accountIcons, formatCurrency, currencies } from "@/lib/config"
import { useTranslation } from "react-i18next"
import IconPicker from "@/components/selectors/icon-picker"
import ColorPicker from "@/components/selectors/color-picker"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useWealth } from "@/providers/wealth-provider"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export default function AccountsPage() {
   const { accounts, isLoading, error, refreshAccounts, createAccount, updateAccount, deleteAccount } = useAccounts()
   const { refreshWealthSnapshots } = useWealth()
   const { t, i18n } = useTranslation()
   const { data: session } = useSession()
   const [isEditMode, setIsEditMode] = useState(false)
   const [isDrawerOpen, setIsDrawerOpen] = useState(false)
   const [drawerDirection, setDrawerDirection] = useState("bottom")
   const [isSubmitting, setIsSubmitting] = useState(false)
   const [accountToDelete, setAccountToDelete] = useState(null)
   const [currentAccount, setCurrentAccount] = useState({
      name: "",
      value: 0,
      type: "checking",
      currency: session?.user?.primaryCurrency,
      icon: "wallet",
      color: "#2563eb",
   })

   // Calculate total balance
   const totalBalance = accounts?.reduce((sum, account) => {
      // Simple conversion - in a real app, would need proper currency conversion
      return sum + (account.value || 0);
   }, 0);

   useEffect(() => {
      setCurrentAccount((prev) => ({
         ...prev,
         currency: session?.user?.primaryCurrency,
      }))
   }, [session?.user?.primaryCurrency])

   const resetForm = () => {
      setCurrentAccount({
         name: "",
         value: 0,
         type: "checking",
         currency: session?.user?.primaryCurrency,
         icon: "wallet",
         color: "#2563eb",
      })
      setIsEditMode(false)
      setIsDrawerOpen(false)
   }

   const handleSubmit = async () => {
      try {
         if (currentAccount.name.trim() === "") return
         setIsSubmitting(true)

         if (isEditMode && currentAccount.id) {
            const result = await updateAccount({
               id: currentAccount.id,
               name: currentAccount.name,
               type: currentAccount.type,
               icon: currentAccount.icon,
               color: currentAccount.color,
               value: currentAccount.value || 0
            })

            if (!result) {
               toast.error(t("common.failedToUpdateAccount"))
               return
            }

            refreshWealthSnapshots()
            toast.success(t("common.accountUpdatedSuccess"))
         } else {
            const result = await createAccount({
               name: currentAccount.name,
               type: currentAccount.type,
               icon: currentAccount.icon,
               color: currentAccount.color,
               value: currentAccount.value || 0,
               currency: currentAccount.currency
            })

            if (!result) {
               toast.error(t("common.failedToCreateAccount"))
               return
            }

            refreshWealthSnapshots()
            toast.success(t("common.accountCreatedSuccess"))
         }

         resetForm()
      } catch (err) {
         toast.error(t("common.error"))
      } finally {
         setIsSubmitting(false)
      }
   }

   const handleEdit = (account) => {
      setCurrentAccount({
         id: account.id,
         name: account.name,
         type: account.type,
         icon: account.icon,
         color: account.color,
         value: account.value || 0,
         currency: account.currency
      })
      setIsEditMode(true)
      
      // Detect if device is mobile or desktop
      const isMobile = window.innerWidth < 768;
      setDrawerDirection(isMobile ? "bottom" : "right");
      
      setIsDrawerOpen(true)
   }

   const openDrawerWithDefaults = () => {
      setIsEditMode(false)
      setCurrentAccount({
         name: "",
         value: 0,
         type: "checking",
         currency: session?.user?.primaryCurrency,
         icon: "wallet",
         color: "#2563eb",
      })
      
      // Detect if device is mobile or desktop
      const isMobile = window.innerWidth < 768;
      setDrawerDirection(isMobile ? "bottom" : "right");
      
      setIsDrawerOpen(true)
   }

   const confirmDelete = (account) => {
      setAccountToDelete(account)
   }

   const handleDelete = async () => {
      if (!accountToDelete) return

      try {
         const result = await deleteAccount(accountToDelete.id)
         if (result) {
            toast.success(t("common.accountDeletedSuccess"))
            refreshWealthSnapshots()
         } else {
            toast.error(t("common.accountDeleteFailed"))
         }
      } catch (err) {
         toast.error(err.message || t("common.error"))
      } finally {
         setAccountToDelete(null)
      }
   }

   const getIconComponent = (iconName) => {
      const icon = accountIcons.find((i) => i.value === iconName)
      return icon ? icon.icon : <Wallet className="h-5 w-5" />
   }

   const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
         opacity: 1,
         transition: {
            staggerChildren: 0.1,
         },
      },
   }

   const itemVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
         opacity: 1,
         y: 0,
         transition: { duration: 0.3 },
      },
   }

   if (isLoading) {
      return (
         <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
         </div>
      )
   }

   return (
      <div className="container mx-auto p-4 md:p-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} direction={drawerDirection}>
               <DrawerTrigger asChild>
                  <Button
                     className="bg-blue-600 hover:bg-blue-700 text-white w-full md:w-auto"
                     onClick={openDrawerWithDefaults}
                  >
                     <Plus className="h-4 w-4 mr-2" /> {t("common.addAccount")}
                  </Button>
               </DrawerTrigger>
               <DrawerContent className="px-4 pb-4">
                  <DrawerHeader className="border-b pb-4 mb-2">
                     <DrawerTitle className="text-xl font-bold">{isEditMode ? t("common.editAccount") : t("common.addAccount")}</DrawerTitle>
                  </DrawerHeader>
                  <div className="overflow-y-auto max-h-[75vh] py-4 space-y-6">
                     <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                           <Label htmlFor="account-name" className="text-sm font-medium">{t("common.accountName")}</Label>
                           <Input
                              id="account-name"
                              placeholder="e.g., Chase Checking"
                              value={currentAccount.name}
                              onChange={(e) => setCurrentAccount({ ...currentAccount, name: e.target.value })}
                              className="transition-all focus-within:ring-blue-500"
                           />
                        </div>

                        <div className="space-y-2">
                           <Label htmlFor="account-value" className="text-sm font-medium">{t("common.currentBalance")}</Label>
                           <Input
                              id="account-value"
                              type="number"
                              placeholder="0.00"
                              value={currentAccount.value === 0 ? "" : currentAccount.value}
                              onChange={(e) =>
                                 setCurrentAccount({ ...currentAccount, value: Number.parseFloat(e.target.value) || 0 })
                              }
                              className="transition-all focus-within:ring-blue-500"
                           />
                        </div>

                        <div className="space-y-2">
                           <Label htmlFor="account-type" className="text-sm font-medium">{t("common.accountType")}</Label>
                           <Select
                              value={currentAccount.type}
                              onValueChange={(value) => setCurrentAccount({ ...currentAccount, type: value })}
                           >
                              <SelectTrigger id="account-type" className="focus-visible:ring-blue-500/50">
                                 <SelectValue placeholder="Select account type" />
                              </SelectTrigger>
                              <SelectContent>
                                 {accountTypes(t).map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                       {type.label}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </div>

                        {!isEditMode && (
                           <div className="space-y-2">
                              <Label htmlFor="account-currency" className="text-sm font-medium">{t("common.currency")}</Label>
                              <Select
                                 value={currentAccount.currency}
                                 onValueChange={(value) => setCurrentAccount({ ...currentAccount, currency: value })}
                              >
                                 <SelectTrigger id="account-currency" className="focus-visible:ring-blue-500/50">
                                    <SelectValue placeholder={t("common.selectCurrency")} />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {currencies.map((currency) => (
                                       <SelectItem key={currency.code} value={currency.code}>
                                          {currency.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        )}
                     </div>

                     <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("common.icon")}</Label>
                        <IconPicker
                           currentValue={currentAccount.icon}
                           icons={accountIcons}
                           setValue={(value) => setCurrentAccount({ ...currentAccount, icon: value })}
                        />
                     </div>

                     <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("common.color")}</Label>
                        <ColorPicker
                           currentValue={currentAccount.color}
                           setValue={(value) => setCurrentAccount({ ...currentAccount, color: value })}
                        />
                     </div>
                     
                     <Button
                        onClick={handleSubmit}
                        disabled={!currentAccount.name.trim() || isSubmitting}
                        className="w-full mt-6 py-6 text-base bg-blue-600 hover:bg-blue-700 text-white"
                     >
                        {isSubmitting ? (
                           <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {isEditMode ? t("common.updating") : t("common.processing")}
                           </>
                        ) : (
                           <>{isEditMode ? t("common.updateAccount") : t("common.addAccount")}</>
                        )}
                     </Button>
                  </div>
               </DrawerContent>
            </Drawer>
         </div>

         {error && (
            <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-md text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
               {t("common.error")}: {error.message || "Something went wrong while loading accounts"}
            </div>
         )}

         {/* Delete confirmation dialog */}
         <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
            <AlertDialogContent>
               <AlertDialogHeader>
                  <AlertDialogTitle>{t("common.confirmDeleteAccount")}</AlertDialogTitle>
                  <AlertDialogDescription>
                     {t("common.confirmDeleteAccountDesc")}
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancelDelete")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                     {t("common.confirmDelete")}
                  </AlertDialogAction>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>

         <motion.div variants={containerVariants} initial="hidden" animate="visible">
            {accounts && accounts.length > 0 ? (
               <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                     {accounts.map((account) => (
                        <motion.div
                           key={account.id}
                           className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700"
                           initial={{ opacity: 0, y: 20 }}
                           animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, x: -20 }}
                           transition={{ duration: 0.2 }}
                           whileHover={{ y: -4 }}
                           layout
                        >
                           <div 
                              className="h-2 w-full" 
                              style={{ backgroundColor: account.color }}
                           />
                           <div className="p-5">
                              <div className="flex justify-between items-start">
                                 <div className="flex items-center gap-3">
                                    <div
                                       className="w-10 h-10 rounded-full flex items-center justify-center"
                                       style={{ backgroundColor: account.color + "20", color: account.color }}
                                    >
                                       {getIconComponent(account.icon)}
                                    </div>
                                    <div>
                                       <h3 className="font-semibold text-lg">{account.name}</h3>
                                       <div className="flex items-center mt-1">
                                          <span 
                                             className="text-xs px-2 py-0.5 rounded-full" 
                                             style={{ 
                                                backgroundColor: account.color + "15", 
                                                color: account.color 
                                             }}
                                          >
                                             {accountTypes(t).find((t) => t.value === account.type)?.label || account.type}
                                          </span>
                                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                             {account.currency || 'USD'}
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex flex-col items-end">
                                    <span className="text-xl font-bold">
                                       {formatCurrency(account.value || 0, account.currency || 'USD', i18n.language)}
                                    </span>
                                 </div>
                              </div>

                              <div className="flex justify-end gap-2 mt-5">
                                 <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(account)}
                                    className="text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                                 >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    {t("common.edit")}
                                 </Button>
                                 <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => confirmDelete(account)}
                                    className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/30"
                                 >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                                    {t("common.delete")}
                                 </Button>
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </AnimatePresence>
               </div>
            ) : (
               <motion.div
                  className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border dark:border-gray-700 shadow-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
               >
                  <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 mb-4">
                     <CreditCard className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-medium mb-2">{t("common.noAccountsYet")}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">{t("common.addYourFirstAccount")}</p>
                  <Button onClick={openDrawerWithDefaults} className="bg-blue-600 hover:bg-blue-700 text-white">
                     <Plus className="h-4 w-4 mr-2" /> {t("common.addAccount")}
                  </Button>
               </motion.div>
            )}
         </motion.div>
      </div>
   )
}