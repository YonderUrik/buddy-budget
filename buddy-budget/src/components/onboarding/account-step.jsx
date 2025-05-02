"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Plus, Wallet, CreditCard, Building, Landmark, PiggyBank, DollarSign, ArrowLeft } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
import { accountTypes, currencies, accountIcons, formatCurrency } from "@/lib/config"
import { useTranslation } from "react-i18next"
import IconPicker from "../selectors/icon-picker"
import ColorPicker from "../selectors/color-picker"


export function AccountsStep({ accounts, setAccounts, userPreferences, onNext, onBack }) {
  const { t, i18n } = useTranslation()
  const [newAccount, setNewAccount] = useState({
    name: "",
    value: 0,
    type: "checking",
    currency: userPreferences.primaryCurrency,
    icon: "wallet",
    color: "#2563eb",
  })




  const addAccount = () => {
    if (newAccount.name.trim() === "") return

    setAccounts([
      ...accounts,
      {
        ...newAccount,
        id: Date.now().toString(),
      },
    ])

    // Reset form
    setNewAccount({
      name: "",
      value: 0,
      type: "checking",
      currency: userPreferences.primaryCurrency,
      icon: "wallet",
      color: "#2563eb",
    })
  }

  const removeAccount = (id) => {
    setAccounts(accounts.filter((account) => account.id !== id))
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

  return (
    <div>
      {/* HEADER */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h2 className="text-2xl font-semibold mb-2 text-blue-600 dark:text-blue-400">{t("onboarding_accounts.title")}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {t("onboarding_accounts.desc")}
        </p>
      </motion.div>

      {/* ACCOUNTS */}
      <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="visible">
        <AnimatePresence>
          {accounts.length > 0 && (
            <motion.div className="space-y-4" variants={itemVariants} exit={{ opacity: 0, height: 0 }}>
              <h3 className="font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                {t("onboarding_accounts.yourAccounts")}
              </h3>
              <div className="grid gap-3">
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
                            {accountTypes(t).find((t) => t.value === account.type)?.label} • {account.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-medium">
                          {formatCurrency(account.value, account.currency, i18n.language)}
                        </p>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAccount(account.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t("onboarding_accounts.removeAccount")}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="space-y-4 border-t dark:border-gray-800 pt-6" variants={itemVariants}>
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-500" />
              {t("onboarding_accounts.addAccount")}
            </h3>
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-4 w-4 mr-2" /> {t("onboarding_accounts.addAccount")}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{t("onboarding_accounts.addNewAccount")}</DialogTitle>
                  <DialogDescription>
                    {t("onboarding_accounts.addNewAccountDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="account-name">{t("onboarding_accounts.accountName")}</Label>
                      <Input
                        id="account-name"
                        placeholder="e.g., Chase Checking"
                        value={newAccount.name}
                        onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                        className="transition-all focus-within:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-value">{t("onboarding_accounts.currentBalance")}</Label>
                      <Input
                        id="account-value"
                        type="number"
                        placeholder="0.00"
                        value={newAccount.value === 0 ? "" : newAccount.value}
                        onChange={(e) =>
                          setNewAccount({ ...newAccount, value: Number.parseFloat(e.target.value) || 0 })
                        }
                        className="transition-all focus-within:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-type">{t("onboarding_accounts.accountType")}</Label>
                      <Select
                        value={newAccount.type}
                        onValueChange={(value) => setNewAccount({ ...newAccount, type: value })}
                      >
                        <SelectTrigger id="account-type" className="focus-visible:ring-blue-500/50">
                          <SelectValue placeholder={t("onboarding_accounts.selectAccountType")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accountTypes(t).map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("onboarding_accounts.chooseAccountType")}</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="account-currency">{t("common.currency")}</Label>
                      <Select
                        value={newAccount.currency}
                        onValueChange={(value) => setNewAccount({ ...newAccount, currency: value })}
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("onboarding_accounts.selectCurrencyDesc")}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("common.icon")}</Label>
                    <IconPicker
                      currentValue={newAccount.icon}
                      icons={accountIcons}
                      setValue={(value) => setNewAccount({ ...newAccount, icon: value })}
                    />
                    <p className="text-xs text-gray-500">{t("onboarding_accounts.iconDesc")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("common.color")}</Label>
                    <ColorPicker
                      currentValue={newAccount.color}
                      setValue={(value) => setNewAccount({ ...newAccount, color: value })}
                    />
                    <p className="text-xs text-gray-500">{t("onboarding_accounts.colorDesc")}</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={addAccount}
                    disabled={!newAccount.name.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" /> {t("onboarding_accounts.addAccount")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {accounts.length === 0 && (
            <motion.div
              className="text-center py-8 border border-dashed rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-gray-500 mb-4">{t("onboarding_accounts.noAccounts")}</p>
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      {/* FOOTER */}
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

