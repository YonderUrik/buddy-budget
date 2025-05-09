"use client"

import { useState, useEffect } from "react"
import { useAccounts } from "@/providers/accounts-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Pencil, Wallet, Loader2 } from "lucide-react"
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@/components/ui/dialog"
import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
   AlertDialogTrigger
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
export default function AccountsPage() {
   const { accounts, isLoading, error, refreshAccounts, createAccount, updateAccount, deleteAccount } = useAccounts()
   const { refreshWealthSnapshots } = useWealth()
   const { t, i18n } = useTranslation()
   const { data: session } = useSession()
   const [isEditMode, setIsEditMode] = useState(false)
   const [isModalOpen, setIsModalOpen] = useState(false)
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
      setIsModalOpen(false)
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
      setIsModalOpen(true)
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
      <div className="container max-w-4xl mx-auto p-6">
         <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400" >{t("sidebar.accounts")}</h1>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
               <DialogTrigger asChild>
                  <Button
                     className="bg-blue-600 hover:bg-blue-700 text-white"
                     onClick={() => {
                        setIsEditMode(false)
                        setCurrentAccount({
                           name: "",
                           value: 0,
                           type: "checking",
                           currency: session?.user?.primaryCurrency,
                           icon: "wallet",
                           color: "#2563eb",
                        })
                     }}
                  >
                     <Plus className="h-4 w-4 mr-2" /> {t("common.addAccount")}
                  </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                     <DialogTitle>{isEditMode ? t("common.editAccount") : t("common.addAccount")}</DialogTitle>
                     <DialogDescription>
                        {isEditMode ? "Update your account details" : "Create a new account to track your finances"}
                     </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                     <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                           <Label htmlFor="account-name">{t("common.accountName")}</Label>
                           <Input
                              id="account-name"
                              placeholder="e.g., Chase Checking"
                              value={currentAccount.name}
                              onChange={(e) => setCurrentAccount({ ...currentAccount, name: e.target.value })}
                              className="transition-all focus-within:ring-blue-500"
                           />
                        </div>

                        <div className="space-y-2">
                           <Label htmlFor="account-value">{t("common.currentBalance")}</Label>
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
                           <Label htmlFor="account-type">{t("common.accountType")}</Label>
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
                              <Label htmlFor="account-currency">{t("common.currency")}</Label>
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
                        <Label>{t("common.icon")}</Label>
                        <IconPicker
                           currentValue={currentAccount.icon}
                           icons={accountIcons}
                           setValue={(value) => setCurrentAccount({ ...currentAccount, icon: value })}
                        />
                     </div>

                     <div className="space-y-2">
                        <Label>{t("common.color")}</Label>
                        <ColorPicker
                           currentValue={currentAccount.color}
                           setValue={(value) => setCurrentAccount({ ...currentAccount, color: value })}
                        />
                     </div>
                  </div>
                  <DialogFooter className="flex gap-2">
                     {isEditMode && (
                        <Button variant="outline" onClick={resetForm}>
                           {t("common.cancelDelete")}
                        </Button>
                     )}
                     <Button
                        onClick={handleSubmit}
                        disabled={!currentAccount.name.trim() || isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
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
                  </DialogFooter>
               </DialogContent>
            </Dialog>
         </div>

         {error && (
            <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-md text-red-700">
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

         <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
            {accounts && accounts.length > 0 ? (
               <motion.div className="grid gap-3" variants={itemVariants}>
                  <AnimatePresence>
                     {accounts.map((account) => (
                        <motion.div
                           key={account.id}
                           className="flex items-center justify-between p-4 border rounded-lg dark:border-gray-800"
                           style={{ borderLeftColor: account.color, borderLeftWidth: "4px" }}
                           initial={{ opacity: 0, x: -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           exit={{ opacity: 0, x: 20 }}
                           transition={{ duration: 0.2 }}
                           layout
                        >
                           <div className="flex items-center gap-3">
                              <div
                                 className="w-10 h-10 rounded-full flex items-center justify-center"
                                 style={{ backgroundColor: account.color + "20" }}
                              >
                                 {getIconComponent(account.icon)}
                              </div>
                              <div>
                                 <p className="font-medium">{account.name}</p>
                                 <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {accountTypes(t).find((t) => t.value === account.type)?.label || account.type} • {account.currency || 'USD'}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-4">
                              <p className="font-medium">
                                 {formatCurrency(account.value || 0, account.currency || 'USD', i18n.language)}
                              </p>
                              <div className="flex gap-2">
                                 <TooltipProvider>
                                    <Tooltip>
                                       <TooltipTrigger asChild>
                                          <Button
                                             variant="ghost"
                                             size="icon"
                                             onClick={() => handleEdit(account)}
                                             className="text-gray-400 hover:text-blue-500 transition-colors"
                                          >
                                             <Pencil className="h-4 w-4" />
                                          </Button>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                          <p>{t("common.editAccount")}</p>
                                       </TooltipContent>
                                    </Tooltip>
                                 </TooltipProvider>
                                 <TooltipProvider>
                                    <Tooltip>
                                       <TooltipTrigger asChild>
                                          <Button
                                             variant="ghost"
                                             size="icon"
                                             onClick={() => confirmDelete(account)}
                                             className="text-gray-400 hover:text-red-500 transition-colors"
                                          >
                                             <Trash2 className="h-4 w-4" />
                                          </Button>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                          <p>{t("common.deleteAccount")}</p>
                                       </TooltipContent>
                                    </Tooltip>
                                 </TooltipProvider>
                              </div>
                           </div>
                        </motion.div>
                     ))}
                  </AnimatePresence>
               </motion.div>
            ) : (
               <motion.div
                  className="text-center py-8 border border-dashed rounded-lg"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
               >
                  <p className="text-gray-500 mb-4">{t("common.noAccountsYet")}</p>
               </motion.div>
            )}
         </motion.div>
      </div>
   )
}