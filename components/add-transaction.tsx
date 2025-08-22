'use client';

import { useState, useEffect, useMemo } from 'react';
import {
   Card,
   CardBody,
   Button,
   Input,
   Select,
   SelectItem,
   DatePicker,
   Textarea,
   Spinner
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { today, getLocalTimeZone } from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import { transactionTypes } from './transactions';

interface Account {
   id: string;
   name: string;
   type: string;
   currency: string;
   provider: string;
   icon: string;
   color: string;
}

interface Category {
   id: string;
   name: string;
   icon: string;
   color: string;
   type: string;
}

interface TransactionFormData {
   amount: string;
   accountId: string;
   description: string;
   merchantName: string;
   categoryId: string;
   date: any;
   type: string;
}

export default function AddTransaction({ onSuccess }: { onSuccess?: () => void }) {
   const [formData, setFormData] = useState<TransactionFormData>({
      amount: '',
      accountId: '',
      description: '',
      merchantName: '',
      categoryId: '',
      date: today(getLocalTimeZone()),
      type: 'expense'
   });

   const [accounts, setAccounts] = useState<Account[]>([]);
   const [categories, setCategories] = useState<Category[]>([]);
   const [loading, setLoading] = useState(false);
   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState<string | null>(null);

   const filteredCategories = useMemo(() => {
      if (formData.type === 'transfer') return [];
      return categories.filter(category => {
         // Filter categories by type if they have a type field
         if (category.type && formData.type !== 'transfer') {
            return category.type === formData.type || category.type === 'both';
         }
         return true;
      });
   }, [categories, formData.type]);

   useEffect(() => {
      fetchAccounts();
      fetchCategories();
   }, []);

   const fetchAccounts = async () => {
      setLoading(true);
      try {
         const response = await fetch('/api/accounts?includeTransactions=false');
         if (response.ok) {
            const data = await response.json();
            // Filter only manual (non-linked) accounts
            const manualAccounts = data.filter((account: Account) => account.provider === 'manual');
            setAccounts(manualAccounts);
         }
      } catch (error) {
         console.error('Failed to fetch accounts:', error);
      } finally {
         setLoading(false);
      }
   };

   const fetchCategories = async () => {
      try {
         const response = await fetch('/api/categories');
         if (response.ok) {
            const data = await response.json();
            setCategories(data || []);
         }
      } catch (error) {
         console.error('Failed to fetch categories:', error);
      }
   };

   const handleInputChange = (field: keyof TransactionFormData, value: string | any) => {
      setFormData(prev => ({
         ...prev,
         [field]: value
      }));
      setError(null);
   };

   const validateForm = (): string | null => {
      if (!formData.amount || parseFloat(formData.amount) === 0) {
         return 'Amount is required';
      }
      if (!formData.accountId) {
         return 'Please select an account';
      }
      if (!formData.description && !formData.merchantName) {
         return 'Please provide either a description or merchant name';
      }
      if (!formData.date) {
         return 'Please select a date';
      }
      return null;
   };

   const handleSubmit = async () => {
      const validationError = validateForm();
      if (validationError) {
         setError(validationError);
         return;
      }

      setSubmitting(true);
      setError(null);

      try {
         const selectedAccount = accounts.find(a => a.id === formData.accountId);
         const amount = parseFloat(formData.amount);

         // Convert amount based on transaction type
         let finalAmount: number;
         if (formData.type === 'expense') {
            finalAmount = -Math.abs(amount);
         } else if (formData.type === 'income') {
            finalAmount = Math.abs(amount);
         } else { // transfer
            // For transfers, keep the amount as entered (could be positive or negative)
            finalAmount = amount;
         }

         // Convert date to JavaScript Date
         const transactionDate = new Date(
            formData.date.year,
            formData.date.month - 1,
            formData.date.day
         );

         const payload = {
            amount: finalAmount,
            currency: selectedAccount?.currency || 'USD',
            accountId: formData.accountId,
            description: formData.description || null,
            merchantName: formData.merchantName || null,
            categoryId: formData.categoryId || null,
            date: transactionDate.toISOString(),
            type: formData.type,
            provider: 'manual'
         };

         const response = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
         });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create transaction');
         }

         // Reset form
         setFormData({
            amount: '',
            accountId: '',
            description: '',
            merchantName: '',
            categoryId: '',
            date: today(getLocalTimeZone()),
            type: 'expense'
         });

         onSuccess?.();

      } catch (error) {
         setError(error instanceof Error ? error.message : 'Failed to create transaction');
      } finally {
         setSubmitting(false);
      }
   };

   if (loading) {
      return (
         <Card>
            <CardBody>
               <div className="flex justify-center items-center py-8">
                  <Spinner size="md" color="primary" />
                  <span className="ml-4">Loading accounts...</span>
               </div>
            </CardBody>
         </Card>
      );
   }

   if (accounts.length === 0) {
      return (
         <Card>
            <CardBody>
               <div className="text-center py-8">
                  <Icon icon="mdi:alert-circle" className="w-12 h-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Manual Accounts Found</h3>
                  <p className="text-default-500 mb-4">
                     You need to create a manual account first before adding transactions.
                  </p>
               </div>
            </CardBody>
         </Card>
      );
   }

   return (
      <div className="w-full space-y-4">
         {error && (
            <Card className="border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20">
               <CardBody className="py-3">
                  <div className="flex items-center gap-2">
                     <Icon icon="mdi:alert-circle" className="w-5 h-5 text-danger" />
                     <span className="text-danger text-sm">{error}</span>
                  </div>
               </CardBody>
            </Card>
         )}

         {/* Transaction Type */}
         <Select
            label="Transaction Type"
            selectedKeys={[formData.type]}
            onSelectionChange={(keys) => {
               const value = Array.from(keys)[0] as 'expense' | 'income' | 'transfer';
               if (!value) {
                  return
               }

               handleInputChange('type', value);
               // Reset category when type changes
               handleInputChange('categoryId', '');
            }}
            size="md"
            isRequired
            renderValue={() => {
               const type = transactionTypes.find(t => t.value === formData.type);
               return (
                  <div className="flex items-center gap-2">
                     <Icon icon={type?.icon || "mdi:wallet-outline"} className={`text-${type?.color} text-sm`} />
                     {type?.label}
                  </div>
               );
            }}
         >
            <SelectItem key="expense">
               <div className="flex items-center gap-2">
                  <Icon icon="mdi:arrow-down" className="w-4 h-4 text-danger" />
                  Expense
               </div>
            </SelectItem>
            <SelectItem key="income">
               <div className="flex items-center gap-2">
                  <Icon icon="mdi:arrow-up" className="w-4 h-4 text-success" />
                  Income
               </div>
            </SelectItem>
            <SelectItem key="transfer">
               <div className="flex items-center gap-2">
                  <Icon icon="mdi:swap-horizontal" className="w-4 h-4 text-warning" />
                  Transfer
               </div>
            </SelectItem>
         </Select>

         <Select
            label="Account"
            placeholder="Select an account"
            selectedKeys={formData.accountId ? [formData.accountId] : []}
            onSelectionChange={(keys) => {
               const value = Array.from(keys)[0] as string;
               if (!value) {
                  return;
               }

               handleInputChange('accountId', value);
            }}
            size="md"
            isRequired
         >
            {accounts.map((account) =>
               <SelectItem key={account.id}>
                  {account.name}
               </SelectItem>
            )}
         </Select>

         {/* Amount */}
         <Input
            label="Amount"
            placeholder="0.00"
            value={formData.amount}
            onValueChange={(value) => handleInputChange('amount', value)}
            type="number"
            step="0.01"
            size="md"
            isRequired
            startContent={
               <div className="pointer-events-none flex items-center">
                  <span className="text-default-400 text-small">
                     {accounts.find(a => a.id === formData.accountId)?.currency || '$'}
                  </span>
               </div>
            }
            classNames={{
               input: "text-right"
            }}
         />

         {/* Account */}


         {/* Merchant Name */}
         <Input
            label="Merchant/Payee"
            placeholder="e.g., Starbucks, Amazon, Salary"
            value={formData.merchantName}
            onValueChange={(value) => handleInputChange('merchantName', value)}
            size="md"
            startContent={
               <Icon icon="mdi:store" className="w-4 h-4 text-default-400" />
            }
         />

         {/* Description */}
         <Textarea
            label="Description"
            placeholder="Optional note about this transaction"
            value={formData.description}
            onValueChange={(value) => handleInputChange('description', value)}
            size="md"
            minRows={2}
            maxRows={4}
         />

         {/* Category */}
         <Select
            label="Category"
            placeholder={formData.type === 'transfer' ? 'Categories not available for transfers' : 'Select a category (optional)'}
            selectedKeys={formData.categoryId ? [formData.categoryId] : []}
            onSelectionChange={(keys) => {
               const value = Array.from(keys)[0] as string;
               handleInputChange('categoryId', value === 'none' ? '' : value);
            }}
            size="md"
            isDisabled={formData.type === 'transfer'}
            required
            renderValue={() => {
               const category = categories.find(c => c.id === formData.categoryId);
               return (
                  <div className="flex items-center gap-2">
                     <Icon icon={category?.icon || "mdi:wallet-outline"} className={`text-${category?.color} text-sm`} />
                     {category?.name}
                  </div>
               );
            }}
         >
            <SelectItem key="none">No Category</SelectItem>
            {filteredCategories.map((category) =>
               <SelectItem key={category.id}>
                  <div className="flex items-center gap-2">
                     <Icon icon={category.icon} className="w-4 h-4" style={{ color: category.color }} />
                     {category.name}
                  </div>
               </SelectItem>
            )}
         </Select>

         {/* Date */}
         <I18nProvider locale={typeof navigator !== 'undefined' ? navigator.language : 'en-US'}>
            <DatePicker
               label="Transaction Date"
               value={formData.date}
               onChange={(date) => handleInputChange('date', date)}
               size="md"
               isRequired
               maxValue={today(getLocalTimeZone())}
               showMonthAndYearPickers
               calendarProps={{
                  classNames: {
                     base: "bg-content1",
                     content: "text-foreground bg-content1"
                  }
               }}
            />
         </I18nProvider>

         {/* Submit Button */}
         <div className="flex gap-3 pt-4">
            <Button
               color="primary"
               onPress={handleSubmit}
               isLoading={submitting}
               size="md"
               className="flex-1"
               startContent={!submitting ? <Icon icon="mdi:plus" className="w-5 h-5" /> : undefined}
            >
               {submitting ? 'Adding Transaction...' : 'Add Transaction'}
            </Button>
         </div>
      </div>
   );
}