"use client";

import { Dictionary } from "@/types/dictionary";
import React, { useEffect, useMemo, useState, useCallback, useRef, useId } from "react";
import { currencyOptions } from "@/components/onboarding/stepper-form";
import { useDisclosure, Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Alert, Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { IconWallet, IconLink } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { CanvasRevealEffect, RevealCard } from "./ui/canvas-reveal-effect";
import { LoaderOne } from "./ui/loader";
import { CometCard } from "./ui/comet-card";
import { AccountLineChart } from "./ui/account-line-chart";
import { formatCurrency } from "@/lib/format";

type Account = {
   id: string;
   name: string;
   type: string;
   icon: string;
   color: string;
   isActive: boolean;
   provider?: string;
   linked?: boolean;
   currency?: string;
   balance?: number;
   institutionName?: string;
   institutionLogo?: string;
   chartData?: Array<{
      date: string;
      balance: number;
   }>;
};

// Memoized institution card component for better performance
const InstitutionCard = React.memo(({ institution, index, onClick }: {
   institution: any;
   index: number;
   onClick: () => void;
}) => (
   <motion.div
      layoutId={`card-${institution.id}-${index}`}
      key={institution.id}
      onClick={onClick}
      className="p-3 flex flex-col items-center hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl cursor-pointer transition-colors border border-transparent hover:border-default-200"
   >
      <div className="flex flex-col items-center w-full space-y-3">
         <motion.div layoutId={`image-${institution.id}-${index}`} className="w-full">
            {institution.logo ? (
               <img
                  width={64}
                  height={64}
                  src={institution.logo}
                  alt={institution.name || institution.id}
                  className="w-16 h-16 mx-auto rounded-lg object-contain bg-white p-1"
               />
            ) : (
               <div className="w-16 h-16 mx-auto rounded-lg bg-default-200 flex items-center justify-center">
                  <Icon icon="proicons:bank" className="w-8 h-8 text-default-400" />
               </div>
            )}
         </motion.div>
         <div className="flex flex-col items-center text-center w-full min-h-0">
            <motion.h3
               layoutId={`title-${institution.id}-${index}`}
               className="font-medium text-foreground text-sm leading-tight line-clamp-2 w-full"
            >
               {institution.name || institution.id}
            </motion.h3>
            {institution.bic && (
               <motion.p
                  layoutId={`description-${institution.id}-${index}`}
                  className="text-default-500 text-xs mt-1 truncate w-full"
               >
                  {institution.bic}
               </motion.p>
            )}
         </div>
      </div>
   </motion.div>
));

InstitutionCard.displayName = 'InstitutionCard';

export default function Accounts({ dict, userCurrency = "EUR" }: { dict?: Dictionary; userCurrency?: string }) {
   const [accounts, setAccounts] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   // Modal-specific states
   const [modalLoading, setModalLoading] = useState(false);
   const [modalError, setModalError] = useState<string | null>(null);

   // Edit modal states
   const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
   const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
   const [editingAccount, setEditingAccount] = useState<Account | null>(null);
   const [editForm, setEditForm] = useState({
      name: "",
      type: "CASH",
      currency: userCurrency,
      balance: 0,
      institutionName: "",
      icon: "mdi:wallet-outline",
      color: "#3b82f6"
   });

   const id = useId();
   const ref = useRef<HTMLDivElement>(null);

   const [manualForm, setManualForm] = useState({
      name: "",
      type: "CASH",
      currency: userCurrency,
      balance: 0,
      institutionName: "",
      icon: "mdi:wallet-outline",
      color: "#3b82f6"
   });

   const [modalStep, setModalStep] = useState<'method' | 'institutions' | 'manual'>('method');
   const addDisclosure = useDisclosure({
      onClose: () => {
         // Reset modal states when closing
         setModalStep('method');
         setModalError(null);
         setModalLoading(false);
      }
   });
   const [institutions, setInstitutions] = useState<any[]>([]);
   const [institutionsLoading, setInstitutionsLoading] = useState(false);
   const [institutionQuery, setInstitutionQuery] = useState("");
   const [debouncedQuery, setDebouncedQuery] = useState("");
   const [country, setCountry] = useState("IT");

   // Progressive loading state
   const [loadedItemsCount, setLoadedItemsCount] = useState(40); // Start with 40 items
   const scrollContainerRef = useRef<HTMLDivElement>(null);
   const [isLoadingMore, setIsLoadingMore] = useState(false);

   const accountTypes = useMemo(() => [
      { value: "CASH", label: dict?.accounts.CASH || "Cash", icon: "mdi:wallet-outline" },
      { value: "CHECKING", label: dict?.accounts.CHECKING || "Checking", icon: "mdi:bank-outline" },
      { value: "SAVINGS", label: dict?.accounts.SAVINGS || "Savings", icon: "mdi:piggy-bank" },
      { value: "CREDIT_CARD", label: dict?.accounts.CREDIT_CARD || "Credit Card", icon: "mdi:credit-card-outline" },
      { value: "INVESTMENT", label: dict?.accounts.INVESTMENT || "Investment", icon: "mdi:chart-line" },
   ], [dict]);

   const ACCOUNT_ICON_SET = useMemo(() => [
      "mdi:wallet-outline",
      "mdi:bank-outline",
      "mdi:credit-card-outline",
      "mdi:cash-multiple",
      "mdi:piggy-bank",
      "mdi:chart-line",
      "mdi:safe",
      "mdi:account-cash-outline",
      "mdi:card-account-details-outline",
      "mdi:currency-usd",
      "mdi:currency-eur",
      "mdi:currency-gbp",
      "mdi:bitcoin",
      "mdi:ethereum",
      "proicons:bank",
      "mdi:treasure-chest",
      "mdi:briefcase-outline",
      "mdi:account-balance-wallet-outline",
   ], []);

   const COLOR_SWATCHES = useMemo(() => [
      "#ef4444", // red-500
      "#f97316", // orange-500
      "#f59e0b", // amber-500
      "#84cc16", // lime-500
      "#22c55e", // green-500
      "#10b981", // emerald-500
      "#14b8a6", // teal-500
      "#06b6d4", // cyan-500
      "#3b82f6", // blue-500
      "#6366f1", // indigo-500
      "#8b5cf6", // violet-500
      "#a855f7", // purple-500
      "#ec4899", // pink-500
      "#f43f5e", // rose-500
      "#64748b", // slate-500
   ], []);

   async function fetchAccounts() {
      setLoading(true);
      setError(null);
      try {
         const res = await fetch("/api/accounts", { cache: "no-store" });
         if (!res.ok) throw new Error(dict?.accounts.failedToLoad);
         const data = await res.json();
         setAccounts(data);

      } catch (e: any) {
         setError(e.message);
      } finally {
         setLoading(false);
      }
   }

   // Debounce the search query
   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedQuery(institutionQuery);
      }, 300);

      return () => clearTimeout(timer);
   }, [institutionQuery]);

   useEffect(() => {
      fetchAccounts();
   }, []);

   useEffect(() => {
      function onKeyDown(event: KeyboardEvent) {
         if (event.key === "Escape") {
            setIsEditModalOpen(false);
         }
      }
      if (isEditModalOpen) {
         document.body.style.overflow = "hidden";
      } else {
         document.body.style.overflow = "auto";
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
   }, [isEditModalOpen]);

   async function createManualAccount(e: React.FormEvent) {
      e.preventDefault();
      setModalLoading(true);
      setModalError(null);
      try {
         const res = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(manualForm),
         });
         if (!res.ok) throw new Error(dict?.accounts.failedToCreate);
         addDisclosure.onClose();
         setModalStep('method');
         setManualForm({
            name: "",
            type: "CASH",
            currency: userCurrency,
            balance: 0,
            institutionName: "",
            icon: "mdi:wallet-outline",
            color: "#3b82f6"
         });
         fetchAccounts();
      } catch (e: any) {
         setModalError(e.message);
      } finally {
         setModalLoading(false);
      }
   }

   async function startPsd2LinkForInstitution(institutionId: string) {
      setModalLoading(true);
      setModalError(null);
      try {
         const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
         const locale = pathParts[1] || "en";
         const redirectUrl = `${window.location.origin}/${locale}/psd2/callback`;
         const res = await fetch("/api/bank-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ institutionId, redirectUrl }),
         });
         if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || dict?.accounts.failedToStartBankLink);
         }
         const data = await res.json();
         window.location.href = data.link as string;
      } catch (e: any) {
         setModalError(e.message);
      } finally {
         setModalLoading(false);
      }
   }

   // Memoized filtered and sorted institutions
   const filteredInstitutions = useMemo(() => {
      const q = debouncedQuery.trim().toLowerCase();
      return institutions
         .filter((i) => {
            if (!q) return true;
            return (
               (i.name || "").toLowerCase().includes(q) ||
               (i.bic || "").toLowerCase().includes(q)
            );
         })
         .sort((a, b) => (a.name || a.id || "").localeCompare(b.name || b.id || "", undefined, { sensitivity: "base" }));
   }, [institutions, debouncedQuery]);

   // Progressive loading - show only loaded items
   const displayedInstitutions = useMemo(() => {
      return filteredInstitutions.slice(0, loadedItemsCount);
   }, [filteredInstitutions, loadedItemsCount]);

   const hasMoreItems = filteredInstitutions.length > loadedItemsCount;

   const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setInstitutionQuery(e.target.value);
   }, []);

   const handleClearSearch = useCallback(() => {
      setInstitutionQuery("");
   }, []);

   const handleInstitutionClick = useCallback((institutionId: string) => {
      startPsd2LinkForInstitution(institutionId);
   }, []);

   // Handle scroll events for progressive loading
   const scrollTimeoutRef = useRef<NodeJS.Timeout>();
   const handleScroll = useCallback(() => {
      if (!scrollContainerRef.current || isLoadingMore || !hasMoreItems) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;

      // Load more when user scrolls to 80% of the content
      if (scrollPercentage > 0.8) {
         setIsLoadingMore(true);

         // Simulate loading delay for better UX
         if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
         }

         scrollTimeoutRef.current = setTimeout(() => {
            setLoadedItemsCount(prev => Math.min(prev + 20, filteredInstitutions.length));
            setIsLoadingMore(false);
         }, 200);
      }
   }, [isLoadingMore, hasMoreItems, filteredInstitutions.length]);

   // Reset loaded items when search or country changes
   useEffect(() => {
      setLoadedItemsCount(40);
      setIsLoadingMore(false);
      // Reset scroll position
      if (scrollContainerRef.current) {
         scrollContainerRef.current.scrollTop = 0;
      }
   }, [debouncedQuery, country]);

   // Initialize loaded items when institutions are first available
   useEffect(() => {
      if (filteredInstitutions.length > 0) {
         setLoadedItemsCount(prev => {
            // If we have no displayed items or the current count is greater than available items
            if (displayedInstitutions.length === 0 || prev > filteredInstitutions.length) {
               return Math.min(40, filteredInstitutions.length);
            }
            return prev;
         });
      }
   }, [filteredInstitutions.length, displayedInstitutions.length]);

   async function fetchInstitutionsForCountry(selectedCountry: string) {
      setInstitutionsLoading(true);
      setModalError(null); // Clear modal errors when fetching new institutions
      try {
         const res = await fetch(`/api/bank-link?action=institutions&country=${encodeURIComponent(selectedCountry)}`);
         if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || dict?.accounts.failedToLoadInstitutions);
         }
         const data = await res.json();
         const list = Array.isArray(data?.results) ? data.results : data;
         setInstitutions(Array.isArray(list) ? list : []);
         // Reset progressive loading when new institutions are loaded
         setLoadedItemsCount(40);
         setIsLoadingMore(false);
      } catch (e: any) {
         setModalError(e.message);
         setInstitutions([]);
      } finally {
         setInstitutionsLoading(false);
      }
   }

   function openEditModal(account: Account) {
      setEditingAccount(account);
      setEditForm({
         name: account.name || "",
         type: account.type || "CASH",
         currency: account.currency || userCurrency,
         balance: account.balance || 0,
         institutionName: account.institutionName || "",
         icon: account.icon || "mdi:wallet-outline",
         color: account.color || "#3b82f6"
      });
      setIsEditModalOpen(true);
   }

   async function handleEditSubmit(e: React.FormEvent) {
      e.preventDefault();
      if (!editingAccount) return;

      setModalLoading(true);
      setModalError(null);

      try {
         const isLinkedAccount = editingAccount.provider !== 'manual';

         // For linked accounts, only send name
         const payload = isLinkedAccount
            ? { name: editForm.name }
            : editForm;

         const res = await fetch(`/api/accounts/${editingAccount.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
         });

         if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || dict?.accounts.failedToUpdate);
         }

         const updated = await res.json();
         setAccounts((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
         setIsEditModalOpen(false);
         setEditingAccount(null);
      } catch (err: any) {
         setModalError(err?.message || dict?.accounts.failedToUpdate);
      } finally {
         setModalLoading(false);
      }
   }

   async function handleDeleteAccount() {
      if (!editingAccount) return;

      try {
         const res = await fetch(`/api/accounts/${editingAccount.id}`, { method: "DELETE" });
         if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || dict?.accounts.failedToDelete);
         }

         setAccounts((prev) => prev.filter((a) => a.id !== editingAccount.id));
         setIsEditModalOpen(false);
         setEditingAccount(null);
      } catch (err: any) {
         setModalError(err?.message || dict?.accounts.failedToDelete);
      }
   }

   return (
      <div className="max-w-2xl mx-auto w-full ">
         <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold">{dict?.accounts.title}</h1>
            <motion.div layoutId={`card-new-accounts`} className="inline-block">
               <motion.div layoutId={`button-new-accounts`} className="inline-block">
                  <Button
                     color="primary"
                     onPress={() => {
                        setModalStep('method');
                        addDisclosure.onOpen();
                     }}
                     size="md"
                     className="rounded-full"
                  >
                     + {dict?.accounts.addAccount}
                  </Button>
               </motion.div>
            </motion.div>
         </div>

         {error && (
            <Alert color="danger" variant="flat">
               {error}
            </Alert>
         )}

         {loading && <LoaderOne title={dict?.accounts.loading} />}


         <div className="w-full flex flex-col gap-3">
            {accounts.map((a) => (
               <motion.div
                  layoutId={`card-${a.id}-${id}`}
                  key={`card-${a.id}-${id}`}
                  onClick={() => openEditModal(a)}
                  className="p-4 bg-content1 hover:bg-content2 rounded-large cursor-pointer ring-1 ring-primary/20 transition-colors"
               >
                  <div className="flex flex-col gap-3">
                     <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                           <motion.div layoutId={`image-${a.id}-${id}`} className="relative">
                              {a.institutionLogo ? (
                                 <img
                                    width={48}
                                    height={48}
                                    src={a.institutionLogo}
                                    alt={a.name}
                                    className="w-12 h-12 rounded-medium object-contain bg-white p-1"
                                 />
                              ) : (
                                 <div
                                    className="h-12 w-12 rounded-medium flex items-center justify-center"
                                    style={{ backgroundColor: a.color || "#3b82f6" }}
                                 >
                                    <Icon icon={a.icon || "mdi:wallet-outline"} className="text-white text-2xl" />
                                 </div>
                              )}
                              {a.provider === 'gocardless' && (
                                 <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                                    <Icon icon="mdi:link-variant" className="text-white text-xs" />
                                 </div>
                              )}
                           </motion.div>
                           <div className="flex flex-col">
                              <motion.h3 layoutId={`title-${a.id}-${id}`} className="text-foreground font-medium">
                                 {a.name}
                              </motion.h3>
                              <div className="flex items-center gap-2">
                                 <span className="text-xs font-medium capitalize">
                                    {a.institutionName}
                                 </span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="text-right">
                              <div className="text-lg font-semibold tabular-nums">
                                 {(() => {
                                    const balance = a.balance || 0;

                                    return formatCurrency(balance, a.currency || 'EUR');
                                 })()}
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Line Chart for Last 90 Days */}
                     {a.chartData && a.chartData.length > 0 && (
                        <div className="flex items-center gap-3 pt-2 border-t border-divider/50">
                           <div className="flex-1">
                              <AccountLineChart
                                 data={a.chartData}
                                 currency={a.currency || 'EUR'}
                                 color={a.color || "#4D9CB9"}
                                 height={50}
                              />
                           </div>
                           <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-default-500">{dict?.accounts.last90Days}</span>
                              <div className="flex items-center gap-1">
                                 {(() => {
                                    if (a.chartData.length < 2) return null;
                                    const firstBalance = a.chartData[0].balance;
                                    const lastBalance = a.chartData[a.chartData.length - 1].balance;
                                    const change = lastBalance - firstBalance;
                                    const changePercent = firstBalance !== 0 ? (change / Math.abs(firstBalance)) * 100 : 0;
                                    const isPositive = change >= 0;

                                    return (
                                       <>
                                          <Icon
                                             icon={isPositive ? "mdi:trending-up" : "mdi:trending-down"}
                                             className={`text-xs ${isPositive ? "text-success" : "text-danger"}`}
                                          />
                                          <span className={`text-xs font-medium ${isPositive ? "text-success" : "text-danger"}`}>
                                             {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
                                          </span>
                                       </>
                                    );
                                 })()}
                              </div>
                           </div>
                        </div>
                     )}
                  </div>
               </motion.div>
            ))}
            {accounts.length === 0 && !loading && (
               <div className="text-center text-sm text-default-500">
                  <div className="w-full flex items-center justify-center py-10">
                     <div className="wallet-container">
                        <div className="wallet-bg"></div>
                        <div className="wallet-icon">
                           <div className="wallet"></div>
                           <div className="card"></div>
                           <div className="card"></div>
                        </div>
                        <h2 className="wallet-title">{dict?.accounts.noAccounts}</h2>
                     </div>
                  </div>
               </div>
            )}
         </div>



         {/* Choose account method Modal */}
         <AnimatePresence>
            {addDisclosure.isOpen ? (
               <>
                  <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="fixed inset-0 bg-black/20 h-full w-full z-10"
                     onClick={() => {
                        if (!modalLoading && !institutionsLoading) {
                           addDisclosure.onClose();
                           setModalStep('method');
                           setModalError(null);
                        }
                     }}
                  />
                  <div className="fixed inset-0 grid place-items-center z-[100] overflow-hidden" onClick={() => {
                     if (!modalLoading && !institutionsLoading) {
                        addDisclosure.onClose();
                        setModalStep('method');
                        setModalError(null);
                     }
                  }}>
                     <motion.div
                        layoutId="card-new-accounts"
                        className="w-full max-w-[700px] h-[100dvh] md:h-[90vh] flex flex-col bg-content1 sm:rounded-3xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                     >
                        <div className="flex justify-between items-start p-4 border-b border-divider">
                           <div className="flex items-center gap-3">
                              {(modalStep === 'institutions' || modalStep === 'manual') && (
                                 <Button
                                    onPress={() => {
                                       if (!modalLoading) {
                                          setModalStep('method');
                                          setModalError(null);
                                       }
                                    }}
                                    variant="light"
                                    size="md"
                                    isIconOnly
                                    isDisabled={modalLoading}
                                    className="mr-2"
                                 >
                                    <Icon icon="mdi:arrow-left" width={20} height={20} />
                                 </Button>
                              )}
                              <div>
                                 <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                                    {modalStep === 'method' ? dict?.accounts.addAccount :
                                       modalStep === 'manual' ? dict?.accounts.createManualAccount : dict?.accounts.createBankAccount}
                                 </h2>
                                 <p className="text-default-600 text-sm">
                                    {modalStep === 'method'
                                       ? dict?.accounts.chooseMethod
                                       : modalStep === 'manual'
                                          ? dict?.accounts.manualAccountDescription
                                          : dict?.accounts.bankAccountDescription
                                    }
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button
                                 onPress={() => {
                                    if (!modalLoading && !institutionsLoading) {
                                       addDisclosure.onClose();
                                       setModalStep('method');
                                       setModalError(null);
                                    }
                                 }}
                                 variant="light"
                                 size="md"
                                 isIconOnly
                                 isDisabled={modalLoading || institutionsLoading}
                              >
                                 <Icon icon="mdi:close" width={20} height={20} />
                              </Button>
                           </div>
                        </div>

                        {/* Modal Error Display */}
                        {modalError && (
                           <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                              <div className="flex items-start gap-3">
                                 <Icon icon="mdi:alert-circle" className="text-red-500 mt-0.5 flex-shrink-0" width={20} height={20} />
                                 <div className="flex-1 min-w-0">
                                    <p className="text-sm text-red-700 dark:text-red-200 font-medium">{dict?.accounts.connectionFailed}</p>
                                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">{modalError}</p>
                                 </div>
                                 <Button
                                    onPress={() => setModalError(null)}
                                    variant="light"
                                    size="sm"
                                    isIconOnly
                                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                                 >
                                    <Icon icon="mdi:close" width={16} height={16} />
                                 </Button>
                              </div>
                           </div>
                        )}

                        <div className={`relative flex-1 flex flex-col min-h-0 ${modalStep === 'method' ? 'py-6 px-4 sm:py-10 sm:px-10 overflow-y-auto sm:overflow-visible' : 'p-0'}`}>
                           {modalStep === 'method' ? (
                              <div className="flex flex-col lg:flex-row items-stretch justify-center w-full gap-8 mx-auto max-w-5xl">
                                 <div
                                    onClick={() => {
                                       setModalStep('manual');
                                    }}
                                    className="cursor-pointer flex-1 min-w-0 group"
                                 >
                                    <CometCard>
                                       <RevealCard
                                          title={dict?.accounts.manually.title || ''}
                                          icon={<IconWallet size={52} className="text-primary group-hover:scale-110 transition-transform duration-300" />}
                                       >
                                          <CanvasRevealEffect
                                             animationSpeed={3}
                                             containerClassName="bg-gradient-to-br from-primary/10 via-primary/20 to-primary/30"
                                             colors={[
                                                [244, 186, 65],
                                                [234, 176, 45],
                                                [224, 166, 25],
                                             ]}
                                             opacities={[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
                                             dotSize={5}
                                          />
                                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                                             <Card className="backdrop-blur-md bg-white/80 dark:bg-black/60 w-full h-full max-w-sm shadow-2xl border border-white/30 dark:border-gray-600/40 rounded-2xl overflow-hidden">
                                                <CardHeader className="flex flex-col items-center pb-4 pt-6 bg-gradient-to-b from-white/50 to-transparent dark:from-white/5">
                                                   <Chip
                                                      variant="flat"
                                                      size="sm"
                                                      className="mb-3 bg-primary/15 text-primary font-semibold px-3 py-1 border border-primary/20"
                                                   >
                                                      {dict?.accounts.manually.description}
                                                   </Chip>
                                                   <h3 className="text-xl font-bold text-foreground text-center leading-tight">
                                                      {dict?.accounts.manually.primaryCta}
                                                   </h3>
                                                   <p className="text-default-500 text-sm text-center mt-2 leading-relaxed">
                                                      {dict?.accounts.manually.secondaryCta}
                                                   </p>
                                                </CardHeader>
                                                <CardBody className="pt-2 pb-6 px-6 space-y-4">
                                                   <div className="space-y-3">
                                                      {dict?.accounts.manually.features.map((feature) => (
                                                         <div key={feature.title} className="flex items-start gap-3">
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                               <Icon icon={feature.icon} className="text-primary w-3 h-3" />
                                                            </div>
                                                            <div className="text-sm">
                                                               <div className="font-semibold text-foreground">{feature.title}</div>
                                                               <div className="text-default-500 text-xs">{feature.desc}</div>
                                                            </div>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </CardBody>
                                             </Card>
                                          </div>
                                       </RevealCard>
                                    </CometCard>
                                 </div>
                                 <div
                                    onClick={() => {
                                       setModalStep('institutions');
                                       fetchInstitutionsForCountry(country);
                                    }}
                                    className="cursor-pointer flex-1 min-w-0 group"
                                 >
                                    <CometCard>
                                       <RevealCard
                                          title={dict?.accounts.bank.title || ''}
                                          icon={<IconLink size={52} className="text-secondary group-hover:scale-110 transition-transform duration-300" />}
                                       >
                                          <CanvasRevealEffect
                                             animationSpeed={3}
                                             containerClassName="bg-gradient-to-br from-secondary/10 via-secondary/20 to-secondary/30"
                                             colors={[
                                                [67, 146, 175],
                                                [77, 156, 185],
                                                [87, 166, 195],
                                             ]}
                                             opacities={[0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95, 1]}
                                             dotSize={5}
                                          />
                                          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 rounded-3xl">
                                             <Card className="backdrop-blur-md bg-white/80 dark:bg-black/60 w-full h-full max-w-sm shadow-2xl border border-white/30 dark:border-gray-600/40 rounded-2xl overflow-hidden">
                                                <CardHeader className="flex flex-col items-center pb-4 pt-6 bg-gradient-to-b from-white/50 to-transparent dark:from-white/5">
                                                   <Chip
                                                      variant="flat"
                                                      size="sm"
                                                      className="mb-3 bg-secondary/15 text-secondary font-semibold px-3 py-1 border border-secondary/20"
                                                   >
                                                      {dict?.accounts.bank.description}
                                                   </Chip>
                                                   <h3 className="text-xl font-bold text-foreground text-center leading-tight">
                                                      {dict?.accounts.bank.primaryCta}
                                                   </h3>
                                                   <p className="text-default-500 text-sm text-center mt-2 leading-relaxed">
                                                      {dict?.accounts.bank.secondaryCta}
                                                   </p>
                                                </CardHeader>
                                                <CardBody className="pt-2 pb-6 px-6 space-y-4">
                                                   <div className="space-y-3">
                                                      {dict?.accounts.bank.features.map((feature) => (
                                                         <div key={feature.title} className="flex items-start gap-3">
                                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                               <Icon icon={feature.icon} className="text-secondary w-3 h-3" />
                                                            </div>
                                                            <div className="text-sm">
                                                               <div className="font-semibold text-foreground">{feature.title}</div>
                                                               <div className="text-default-500 text-xs">{feature.desc}</div>
                                                            </div>
                                                         </div>
                                                      ))}
                                                   </div>
                                                </CardBody>
                                             </Card>
                                          </div>
                                       </RevealCard>
                                    </CometCard>
                                 </div>
                              </div>
                           ) : modalStep === 'manual' ? (
                              <div className="flex-1 flex flex-col min-h-0 p-4 overflow-y-auto">
                                 <form onSubmit={createManualAccount} className="flex-1 flex flex-col gap-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                       <Input
                                          label={dict?.accounts.form.accountName}
                                          placeholder={dict?.accounts.form.accountNamePlaceholder}
                                          value={manualForm.name}
                                          onChange={(e) => setManualForm((s) => ({ ...s, name: e.target.value }))}
                                          isRequired
                                          variant="flat"
                                          className="col-span-1 sm:col-span-2"
                                       />

                                       <Select
                                          label={dict?.accounts.form.accountType}
                                          selectedKeys={[manualForm.type]}
                                          isRequired
                                          onSelectionChange={(keys) => {
                                             const selectedType = Array.from(keys)[0] as string;
                                             if (selectedType) {
                                                setManualForm((s) => ({ ...s, type: selectedType }));
                                             }
                                          }}
                                          variant="flat"
                                          renderValue={() => {
                                             const type = accountTypes.find(t => t.value === manualForm.type);
                                             return (
                                                <span className="flex items-center gap-2">
                                                   <div className="h-5 w-5 rounded-lg flex items-center justify-center" style={{ backgroundColor: manualForm.color, opacity: 0.8 }}>
                                                      <Icon icon={type?.icon || "mdi:wallet-outline"} className="text-white text-sm" />
                                                   </div>
                                                   <span className="font-medium">{type?.label}</span>
                                                </span>
                                             );
                                          }}
                                       >
                                          {accountTypes.map((type) => (
                                             <SelectItem key={type.value} textValue={type.label}>
                                                <span className="flex items-center gap-3">
                                                   <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: manualForm.color, opacity: 0.8 }}>
                                                      <Icon icon={type?.icon} className="text-white text-sm" />
                                                   </div>
                                                   <span className="font-medium">{type.label}</span>
                                                </span>
                                             </SelectItem>
                                          ))}
                                       </Select>

                                       <Select
                                          label={dict?.accounts.form.currency}
                                          selectedKeys={[manualForm.currency]}
                                          isRequired
                                          onSelectionChange={(keys) => {
                                             const selectedCurrency = Array.from(keys)[0] as string;
                                             if (selectedCurrency) {
                                                setManualForm((s) => ({ ...s, currency: selectedCurrency }));
                                             }
                                          }}
                                          variant="flat"
                                          renderValue={() => {
                                             const currency = currencyOptions.find(c => c.code === manualForm.currency);
                                             return (
                                                <span className="flex items-center gap-2">
                                                   <span className="font-medium">{currency?.name || manualForm.currency}</span>
                                                   <span className="text-sm text-default-500">({currency?.symbol || manualForm.currency})</span>
                                                </span>
                                             );
                                          }}
                                       >
                                          {currencyOptions.map((currency) => (
                                             <SelectItem key={currency.code} textValue={`${currency.code} - ${currency.name}`}>
                                                <span className="flex items-center justify-between w-full">
                                                   <span>{currency.name}</span>
                                                   <span className="text-sm text-default-500">{currency.symbol}</span>
                                                </span>
                                             </SelectItem>
                                          ))}
                                       </Select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                       <Input
                                          label={dict?.accounts.form.initialBalance}
                                          placeholder="0.00"
                                          type="number"
                                          step="0.01"
                                          value={manualForm.balance.toString()}
                                          onChange={(e) => setManualForm((s) => ({ ...s, balance: parseFloat(e.target.value) || 0 }))}
                                          variant="flat"
                                          startContent={
                                             <div className="pointer-events-none flex items-center">
                                                <span className="text-default-400 text-small">{manualForm.currency}</span>
                                             </div>
                                          }
                                       />

                                       <Input
                                          label={dict?.accounts.form.institutionName}
                                          placeholder={dict?.accounts.form.institutionNamePlaceholder}
                                          value={manualForm.institutionName}
                                          onChange={(e) => setManualForm((s) => ({ ...s, institutionName: e.target.value }))}
                                          variant="flat"
                                       />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground font-medium">{dict?.accounts.form.icon}</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button
                                                   type="button"
                                                   className="flex items-center justify-center px-3 py-3 rounded-medium bg-default-100 hover:bg-default-200 transition-colors"
                                                >
                                                   <div
                                                      className="h-8 w-8 rounded-small flex items-center justify-center"
                                                      style={{ backgroundColor: manualForm.color }}
                                                   >
                                                      <Icon icon={manualForm.icon || "mdi:wallet-outline"} className="text-white text-xl" />
                                                   </div>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs">
                                                <div className="grid grid-cols-6 gap-2">
                                                   {ACCOUNT_ICON_SET.map((ic) => (
                                                      <button
                                                         key={ic}
                                                         type="button"
                                                         onClick={() => setManualForm((s) => ({ ...s, icon: ic }))}
                                                         className={`h-10 w-10 rounded-medium flex items-center justify-center border border-default-200 hover:bg-default-100 transition-colors ${manualForm.icon === ic ? "ring-2 ring-primary" : ""
                                                            }`}
                                                      >
                                                         <Icon icon={ic} className="text-xl text-foreground" />
                                                      </button>
                                                   ))}
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>

                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground font-medium">{dict?.accounts.form.color}</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button
                                                   type="button"
                                                   className="flex items-center gap-3 px-3 py-3 rounded-medium bg-default-100 hover:bg-default-200 transition-colors"
                                                >
                                                   <div className="h-7 w-7 rounded-small" style={{ backgroundColor: manualForm.color }} />
                                                   <span className="text-sm text-default-700">{manualForm.color}</span>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs">
                                                <div className="grid grid-cols-7 gap-2">
                                                   {COLOR_SWATCHES.map((c) => (
                                                      <button
                                                         key={c}
                                                         type="button"
                                                         onClick={() => setManualForm((s) => ({ ...s, color: c }))}
                                                         className={`h-8 w-8 rounded-small border border-default-200 transition-all ${manualForm.color === c ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                                                            }`}
                                                         style={{ backgroundColor: c }}
                                                      />
                                                   ))}
                                                </div>
                                                <div className="mt-3">
                                                   <Input
                                                      size="sm"
                                                      placeholder="#3b82f6"
                                                      value={manualForm.color}
                                                      onChange={(e) => setManualForm((s) => ({ ...s, color: e.target.value }))}
                                                   />
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-3 mt-auto pt-4">
                                       <Button
                                          type="button"
                                          onPress={() => setModalStep('method')}
                                          variant="flat"
                                          color="default"
                                          startContent={<Icon icon="mdi:arrow-left" className="text-base" />}
                                       >
                                          {dict?.accounts.form.back}
                                       </Button>
                                       <Button
                                          type="submit"
                                          color="primary"
                                          isLoading={modalLoading}
                                          startContent={!modalLoading && <Icon icon="mdi:plus" className="text-base" />}
                                       >
                                          {dict?.accounts.form.createAccount}
                                       </Button>
                                    </div>
                                 </form>
                              </div>
                           ) : (
                              <div className="flex-1 flex flex-col min-h-0">
                                 <div className="flex-shrink-0 p-4 border-b border-divider bg-content1">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                       <Input
                                          value={institutionQuery}
                                          onChange={handleInputChange}
                                          placeholder={dict?.accounts.form.searchInstitutions}
                                          className="flex-1"
                                          size="md"
                                          variant="flat"
                                          startContent={<Icon icon="mdi:magnify" className="text-default-400" />}
                                          endContent={institutionQuery && (
                                             <button onClick={handleClearSearch} className="text-default-400 hover:text-default-600">
                                                <Icon icon="mdi:close-circle" />
                                             </button>
                                          )}
                                       />
                                       <Select
                                          isRequired
                                          className="w-full sm:w-32"
                                          selectedKeys={[country]}
                                          onSelectionChange={(keys) => {
                                             const c = Array.from(keys)[0] as string;
                                             if (!c) return;
                                             setCountry(c);
                                             fetchInstitutionsForCountry(c);
                                          }}
                                          renderValue={() => (
                                             <span className="flex items-center gap-2 text-sm">
                                                <span className="text-lg">{
                                                   country === "IT" ? "🇮🇹" :
                                                      country === "GB" ? "🇬🇧" :
                                                         country === "FR" ? "🇫🇷" :
                                                            country === "DE" ? "🇩🇪" :
                                                               country === "ES" ? "🇪🇸" :
                                                                  country === "PT" ? "🇵🇹" :
                                                                     country === "NL" ? "🇳🇱" :
                                                                        country === "BE" ? "🇧🇪" :
                                                                           country === "IE" ? "🇮🇪" :
                                                                              country === "AT" ? "🇦🇹" :
                                                                                 country === "SE" ? "🇸🇪" :
                                                                                    country === "FI" ? "🇫🇮" :
                                                                                       country === "DK" ? "🇩🇰" :
                                                                                          country === "NO" ? "🇳🇴" :
                                                                                             country === "PL" ? "🇵🇱" : "🌍"
                                                }</span>
                                                <span>{
                                                   country === "IT" ? "Italy" :
                                                      country === "GB" ? "United Kingdom" :
                                                         country === "FR" ? "France" :
                                                            country === "DE" ? "Germany" :
                                                               country === "ES" ? "Spain" :
                                                                  country === "PT" ? "Portugal" :
                                                                     country === "NL" ? "Netherlands" :
                                                                        country === "BE" ? "Belgium" :
                                                                           country === "IE" ? "Ireland" :
                                                                              country === "AT" ? "Austria" :
                                                                                 country === "SE" ? "Sweden" :
                                                                                    country === "FI" ? "Finland" :
                                                                                       country === "DK" ? "Denmark" :
                                                                                          country === "NO" ? "Norway" :
                                                                                             country === "PL" ? "Poland" : country
                                                }</span>
                                             </span>
                                          )}
                                       >
                                          <SelectItem key="IT" textValue="Italy">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇮🇹</span>
                                                <span>Italy</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="GB" textValue="United Kingdom">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇬🇧</span>
                                                <span>United Kingdom</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="FR" textValue="France">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇫🇷</span>
                                                <span>France</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="DE" textValue="Germany">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇩🇪</span>
                                                <span>Germany</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="ES" textValue="Spain">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇪🇸</span>
                                                <span>Spain</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="PT" textValue="Portugal">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇵🇹</span>
                                                <span>Portugal</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="NL" textValue="Netherlands">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇳🇱</span>
                                                <span>Netherlands</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="BE" textValue="Belgium">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇧🇪</span>
                                                <span>Belgium</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="IE" textValue="Ireland">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇮🇪</span>
                                                <span>Ireland</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="AT" textValue="Austria">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇦🇹</span>
                                                <span>Austria</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="SE" textValue="Sweden">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇸🇪</span>
                                                <span>Sweden</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="FI" textValue="Finland">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇫🇮</span>
                                                <span>Finland</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="DK" textValue="Denmark">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇩🇰</span>
                                                <span>Denmark</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="NO" textValue="Norway">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇳🇴</span>
                                                <span>Norway</span>
                                             </span>
                                          </SelectItem>
                                          <SelectItem key="PL" textValue="Poland">
                                             <span className="flex items-center gap-3">
                                                <span className="text-lg">🇵🇱</span>
                                                <span>Poland</span>
                                             </span>
                                          </SelectItem>
                                       </Select>
                                    </div>
                                 </div>

                                 <div
                                    ref={scrollContainerRef}
                                    className="flex-1 overflow-y-auto p-4"
                                    onScroll={handleScroll}
                                 >
                                    {institutionsLoading ? (
                                       <div className="flex-1 flex items-center justify-center">
                                          <LoaderOne size="md" title={dict?.accounts.form.loadingInstitutions} />
                                       </div>
                                    ) : filteredInstitutions.length === 0 ? (
                                       <div className="text-center text-sm text-default-500">
                                          <div className="w-full flex items-center justify-center py-10">
                                             <div className="wallet-container">
                                                <div className="wallet-bg"></div>
                                                <div className="wallet-icon">
                                                   <div className="wallet"></div>
                                                   <div className="card"></div>
                                                   <div className="card"></div>
                                                </div>
                                                <h2 className="wallet-title">{dict?.accounts.form.noInstitutions}</h2>
                                             </div>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="space-y-4 relative">
                                          {/* Loading overlay for institution connection */}
                                          {modalLoading && (
                                             <div className="absolute inset-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                                                <div className="bg-content1 p-6 rounded-xl shadow-lg border border-divider">
                                                   <div className="flex flex-col items-center gap-3">
                                                      <LoaderOne size="md" />
                                                      <div className="text-center">
                                                         <p className="text-sm font-medium text-foreground">{dict?.accounts.form.connectingInstitution}</p>
                                                         <p className="text-xs text-default-500 mt-1">{dict?.accounts.form.connectingInstitutionDescription}</p>
                                                      </div>
                                                   </div>
                                                </div>
                                             </div>
                                          )}

                                          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                             {[{ id: "SANDBOXFINANCE_SFIN0000", name: "Test", }, ...displayedInstitutions].map((institution, index) => (
                                                <div key={institution.id} className={modalLoading ? 'pointer-events-none opacity-60' : ''}>
                                                   <InstitutionCard
                                                      institution={institution}
                                                      index={index}
                                                      onClick={() => handleInstitutionClick(institution.id)}
                                                   />
                                                </div>
                                             ))}
                                          </div>
                                       </div>
                                    )}
                                 </div>
                              </div>
                           )}
                        </div>
                     </motion.div>
                  </div>
               </>
            ) : null}
         </AnimatePresence>

         {/* Edit Account Modal */}
         <AnimatePresence>
            {isEditModalOpen && (
               <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/20 h-full w-full z-10"
                  onClick={() => setIsEditModalOpen(false)}
               />
            )}
         </AnimatePresence>

         <AnimatePresence>
            {isEditModalOpen ? (
               <div className="fixed inset-0 grid place-items-center z-[100]" onClick={() => setIsEditModalOpen(false)}>
                  <motion.div
                     layoutId={`card-${editingAccount?.id}-${id}`}
                     ref={ref}
                     className="w-full max-w-[500px] h-[100dvh] md:h-fit md:max-h-[90vh] flex flex-col bg-content1 sm:rounded-3xl overflow-hidden"
                     onClick={(e) => e.stopPropagation()}
                     onMouseDown={(e) => e.stopPropagation()}
                  >
                     <div className="flex justify-between items-start p-4 border-b border-divider">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white overflow-hidden" style={{ backgroundColor: editForm.color }}>
                              {editingAccount?.institutionLogo ? (
                                 <img
                                    src={editingAccount.institutionLogo}
                                    alt={editingAccount.institutionName || editingAccount.name}
                                    className="w-full h-full object-contain"
                                 />
                              ) : (
                                 <Icon icon={editForm.icon || "mdi:wallet-outline"} className="text-xl" />
                              )}
                           </div>
                           <div className="flex flex-col">
                              <motion.h3 layoutId={`title-${editingAccount?.id}-${id}`} className="font-bold text-foreground">
                                 {dict?.accounts.form.editAccount}
                              </motion.h3>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           {editingAccount && (
                              <Button
                                 onPress={() => {
                                    setConfirmOpen(true);
                                 }}
                                 color="danger"
                                 variant="light"
                                 size="md"
                                 isIconOnly
                              >
                                 <Icon icon="mdi:trash-can-outline" className="text-base" width={20} height={20} />
                              </Button>
                           )}
                           <Button
                              onPress={() => setIsEditModalOpen(false)}
                              variant="light"
                              size="md"
                              isIconOnly
                           >
                              <Icon icon="mdi:close" width={20} height={20} />
                           </Button>
                        </div>
                     </div>

                     {modalError && (
                        <Alert color="danger" className="mx-4 mt-4">
                           {modalError}
                        </Alert>
                     )}

                     <div className="pt-1 relative px-4 flex-1 flex flex-col min-h-0 mt-5">
                        <motion.form
                           layout
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           onSubmit={handleEditSubmit}
                           className="text-foreground text-sm flex-1 pb-6 flex flex-col gap-5 overflow-auto md:overflow-visible"
                        >
                           <div className="grid grid-cols-1 gap-4">
                              <Input
                                 label={dict?.accounts.form.accountName}
                                 value={editForm.name}
                                 onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                                 isRequired
                                 placeholder="e.g. Main Savings"
                                 variant="flat"
                              />

                              {editingAccount?.provider === 'manual' && (
                                 <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       <Select
                                          label="Account Type"
                                          selectedKeys={[editForm.type]}
                                          isRequired
                                          onSelectionChange={(keys) => {
                                             const selectedType = Array.from(keys)[0] as string;
                                             if (selectedType) {
                                                setEditForm((s) => ({ ...s, type: selectedType }));
                                             }
                                          }}
                                          variant="flat"
                                       >
                                          {accountTypes.map((type) => (
                                             <SelectItem key={type.value} textValue={type.label}>
                                                <span className="flex items-center gap-3">
                                                   <div className="h-6 w-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: editForm.color, opacity: 0.8 }}>
                                                      <Icon icon={type.icon} className="text-white text-sm" />
                                                   </div>
                                                   <span className="font-medium">{type.label}</span>
                                                </span>
                                             </SelectItem>
                                          ))}
                                       </Select>

                                       <Select
                                          label="Currency"
                                          selectedKeys={[editForm.currency]}
                                          isRequired
                                          onSelectionChange={(keys) => {
                                             const selectedCurrency = Array.from(keys)[0] as string;
                                             if (selectedCurrency) {
                                                setEditForm((s) => ({ ...s, currency: selectedCurrency }));
                                             }
                                          }}
                                          variant="flat"
                                       >
                                          {currencyOptions.map((currency) => (
                                             <SelectItem key={currency.code} textValue={`${currency.code} - ${currency.name}`}>
                                                <span className="flex items-center justify-between w-full">
                                                   <span>{currency.name}</span>
                                                   <span className="text-sm text-default-500">{currency.symbol}</span>
                                                </span>
                                             </SelectItem>
                                          ))}
                                       </Select>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       <Input
                                          label="Balance"
                                          placeholder="0.00"
                                          type="number"
                                          step="0.01"
                                          value={editForm.balance.toString()}
                                          onChange={(e) => setEditForm((s) => ({ ...s, balance: parseFloat(e.target.value) || 0 }))}
                                          variant="flat"
                                          startContent={
                                             <div className="pointer-events-none flex items-center">
                                                <span className="text-default-400 text-small">{editForm.currency}</span>
                                             </div>
                                          }
                                       />

                                       <Input
                                          label="Institution Name (Optional)"
                                          placeholder="e.g. Personal Cash"
                                          value={editForm.institutionName}
                                          onChange={(e) => setEditForm((s) => ({ ...s, institutionName: e.target.value }))}
                                          variant="flat"
                                       />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground">Icon</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button type="button" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="flex items-center justify-center px-3 py-2 rounded-medium bg-default-100 hover:bg-default-200">
                                                   <div className="h-7 w-7 rounded-small flex items-center justify-center" style={{ backgroundColor: editForm.color }}>
                                                      <Icon icon={editForm.icon} className="text-white text-lg" />
                                                   </div>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                <div className="grid grid-cols-6 gap-2">
                                                   {ACCOUNT_ICON_SET.map((ic) => (
                                                      <button
                                                         key={ic}
                                                         type="button"
                                                         onClick={() => setEditForm((s) => ({ ...s, icon: ic }))}
                                                         className={`h-10 w-10 rounded-medium flex items-center justify-center border border-default-200 hover:bg-default-100 ${editForm.icon === ic ? "ring-2 ring-primary" : ""}`}
                                                      >
                                                         <Icon icon={ic} className="text-xl text-foreground" />
                                                      </button>
                                                   ))}
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>

                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground">Color</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button type="button" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="flex items-center gap-3 px-3 py-2 rounded-medium bg-default-100 hover:bg-default-200">
                                                   <div className="h-7 w-7 rounded-small" style={{ backgroundColor: editForm.color }} />
                                                   <span className="text-sm text-default-700">{editForm.color}</span>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                <div className="grid grid-cols-7 gap-2">
                                                   {COLOR_SWATCHES.map((c) => (
                                                      <button
                                                         key={c}
                                                         type="button"
                                                         onClick={() => setEditForm((s) => ({ ...s, color: c }))}
                                                         className={`h-8 w-8 rounded-small border border-default-200 ${editForm.color === c ? "ring-2 ring-primary" : ""}`}
                                                         style={{ backgroundColor: c }}
                                                      />
                                                   ))}
                                                </div>
                                                <div className="mt-3">
                                                   <Input
                                                      size="sm"
                                                      placeholder="#3b82f6"
                                                      value={editForm.color}
                                                      onChange={(e) => setEditForm((s) => ({ ...s, color: e.target.value }))}
                                                   />
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                    </div>
                                 </>
                              )}

                              {editingAccount?.provider !== 'manual' && (
                                 <Alert color="warning" variant="flat">
                                    <div className="flex items-start gap-3">
                                       <div>
                                          <p className="font-medium">{dict?.accounts.form.linkedAccount}</p>
                                          <p className="text-sm">{dict?.accounts.form.linkedAccountDescription}</p>
                                       </div>
                                    </div>
                                 </Alert>
                              )}
                           </div>

                           <div className="flex items-center justify-end gap-2 mt-2">
                              <Button
                                 type="button"
                                 onPress={() => setIsEditModalOpen(false)}
                                 variant="flat"
                                 color="default"
                                 startContent={<Icon icon="mdi:close" className="text-base" />}
                              >
                                 {dict?.accounts.form.cancel}
                              </Button>
                              <motion.div layoutId={`button-${editingAccount?.id}-${id}`}>
                                 <Button
                                    type="submit"
                                    color="primary"
                                    isLoading={modalLoading}
                                    startContent={!modalLoading && <Icon icon="mdi:content-save-outline" className="text-base" />}
                                 >
                                    {dict?.accounts.form.save}
                                 </Button>
                              </motion.div>
                           </div>
                        </motion.form>
                     </div>

                     {confirmOpen && (
                        <div className="absolute inset-0 flex items-end md:items-center justify-center z-[110]" onClick={() => setConfirmOpen(false)}>
                           <div className="fixed inset-0 bg-black/30" />
                           <div className="relative m-4 w-full max-w-sm rounded-large bg-content1 p-4 shadow-large" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-start gap-3">
                                 <div className="h-10 w-10 rounded-full bg-danger/20 text-danger flex items-center justify-center">
                                    <Icon icon="mdi:trash-can-outline" />
                                 </div>
                                 <div className="flex-1">
                                    <h4 className="font-semibold text-foreground mb-1">{dict?.accounts.form.confirmDeleteAccount}</h4>
                                    <p className="text-small text-default-500">
                                       {dict?.accounts.form.deleteAccountDescription}
                                    </p>
                                 </div>
                              </div>
                              <div className="mt-4 flex items-center justify-end gap-2">
                                 <Button variant="flat" onPress={() => setConfirmOpen(false)}>{dict?.accounts.form.cancel}</Button>
                                 <Button color="danger" onPress={async () => { await handleDeleteAccount(); setConfirmOpen(false); }}>{dict?.accounts.form.deleteAccount}</Button>
                              </div>
                           </div>
                        </div>
                     )}
                  </motion.div>
               </div>
            ) : null}
         </AnimatePresence>

      </div >
   );
}