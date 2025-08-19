"use client";

import { Dictionary } from "@/types/dictionary";
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useDisclosure, Button, Card, CardBody, CardHeader, Chip, Input, Select, SelectItem, Alert } from "@heroui/react";
import { IconWallet, IconLink } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { CanvasRevealEffect, RevealCard } from "./ui/canvas-reveal-effect";
import { LoaderOne } from "./ui/loader";
import { CometCard } from "./ui/comet-card";

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

export default function Accounts({ dict }: { dict: Dictionary }) {
   const [accounts, setAccounts] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   // Modal-specific states
   const [modalLoading, setModalLoading] = useState(false);
   const [modalError, setModalError] = useState<string | null>(null);

   const [showManualForm, setShowManualForm] = useState(false);
   const [manualForm, setManualForm] = useState({ name: "", type: "CASH", currency: "EUR", balance: 0 });

   const [modalStep, setModalStep] = useState<'method' | 'institutions'>('method');
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
      { value: "CASH", label: "Cash" },
      { value: "CHECKING", label: "Checking" },
      { value: "SAVINGS", label: "Savings" },
      { value: "CREDIT_CARD", label: "Credit Card" },
      { value: "INVESTMENT", label: "Investment" },
   ], []);

   async function fetchAccounts() {
      setLoading(true);
      setError(null);
      try {
         const res = await fetch("/api/accounts", { cache: "no-store" });
         if (!res.ok) throw new Error("Failed to load accounts");
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

   async function createManualAccount(e: React.FormEvent) {
      e.preventDefault();
      setLoading(true);
      setError(null);
      try {
         const res = await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(manualForm),
         });
         if (!res.ok) throw new Error("Failed to create account");
         setShowManualForm(false);
         setManualForm({ name: "", type: "CASH", currency: "EUR", balance: 0 });
         fetchAccounts();
      } catch (e: any) {
         setError(e.message);
      } finally {
         setLoading(false);
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
            throw new Error(errorData.error || "Failed to start bank link");
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
            throw new Error(errorData.error || "Failed to load institutions");
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

   return (
      <div className="max-w-2xl mx-auto w-full ">
         <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-semibold">Accounts</h1>
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
                     + Add account
                  </Button>
               </motion.div>
            </motion.div>
         </div>

         {error && (
            <Alert color="danger" variant="flat">
               {error}
            </Alert>
         )}

         {loading && <LoaderOne title="Loading accounts..." />}


         <div className="w-full flex flex-col gap-3">
            {accounts.map((a, index) => (
               <motion.div
                  layoutId={`card-${a.id}-${a.id}`}
                  key={`card-${a.id}-${a.id}`}
                  // onClick={() => openEditModal(a)}
                  className="p-4 bg-content1 hover:bg-content2 rounded-large cursor-pointer ring-1 ring-primary/20 transition-colors"
               >
                  <div className="flex items-center justify-between gap-4">
                     <div className="flex items-center gap-4">
                        <motion.div layoutId={`image-${a.id}-${a.id}`} className="relative">
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
                                 style={{ backgroundColor: a.color }}
                              >
                                 <Icon icon={a.icon || "proicons:bank"} className="text-white text-2xl" />
                              </div>
                           )}
                           {a.provider === 'gocardless' && (
                              <div className="absolute -top-1 -right-1 bg-primary rounded-full p-1">
                                 <Icon icon="mdi:link-variant" className="text-white text-xs" />
                              </div>
                           )}
                        </motion.div>
                        <div className="flex flex-col">
                           <motion.h3 layoutId={`title-${a.id}-${a.id}`} className="text-foreground font-medium">
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
                        <motion.div layoutId={`button-${a.id}-${a.id}`}>
                           <div className="text-right">
                              <div className="text-lg font-semibold tabular-nums">
                                 {new Intl.NumberFormat(undefined, {
                                    style: 'currency',
                                    currency: a.currency || 'EUR',
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                 }).format(a.balance || 0)}
                              </div>
                           </div>
                        </motion.div>
                     </div>
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
                        <h2 className="wallet-title">No accounts found</h2>
                     </div>
                  </div>
               </div>
            )}
         </div>


         {showManualForm && (
            <form onSubmit={createManualAccount} className="p-4 rounded border border-default-200 bg-content1 space-y-3">
               <div className="font-medium">Create manual account</div>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input
                     className="border border-default-200 bg-content1 text-foreground placeholder-default-500 rounded px-2 py-1"
                     placeholder="Name"
                     value={manualForm.name}
                     onChange={(e) => setManualForm((s) => ({ ...s, name: e.target.value }))}
                     required
                  />
                  <select
                     className="border border-default-200 bg-content1 text-foreground rounded px-2 py-1"
                     value={manualForm.type}
                     onChange={(e) => setManualForm((s) => ({ ...s, type: e.target.value }))}
                  >
                     {accountTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                     ))}
                  </select>
                  <input
                     className="border border-default-200 bg-content1 text-foreground placeholder-default-500 rounded px-2 py-1"
                     placeholder="Currency"
                     value={manualForm.currency}
                     onChange={(e) => setManualForm((s) => ({ ...s, currency: e.target.value }))}
                     required
                  />
                  <input
                     className="border border-default-200 bg-content1 text-foreground placeholder-default-500 rounded px-2 py-1"
                     placeholder="Initial balance"
                     type="number"
                     step="0.01"
                     value={manualForm.balance}
                     onChange={(e) => setManualForm((s) => ({ ...s, balance: parseFloat(e.target.value) || 0 }))}
                  />
               </div>
               <div className="flex items-center gap-2">
                  <button type="submit" className="px-3 py-1.5 rounded bg-emerald-600 text-white">Create</button>
                  <button type="button" onClick={() => setShowManualForm(false)} className="px-3 py-1.5 rounded border border-default-200">Cancel</button>
               </div>
            </form>
         )}

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
                              {modalStep === 'institutions' && (
                                 <Button
                                    onClick={() => {
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
                                    {modalStep === 'method' ? 'Add Account' : 'Choose Your Bank'}
                                 </h2>
                                 <p className="text-default-600 text-sm">
                                    {modalStep === 'method'
                                       ? 'Choose your preferred setup method'
                                       : 'Securely connect your bank to import balances and transactions'
                                    }
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              <Button
                                 onClick={() => {
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
                                    <p className="text-sm text-red-700 dark:text-red-200 font-medium">Connection Failed</p>
                                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">{modalError}</p>
                                 </div>
                                 <Button
                                    onClick={() => setModalError(null)}
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
                                       addDisclosure.onClose();
                                       setShowManualForm(true);
                                    }}
                                    className="cursor-pointer flex-1 min-w-0 group"
                                 >
                                    <CometCard>
                                       <RevealCard
                                          title="Create Manually"
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
                                                      ✨ Quick & Easy
                                                   </Chip>
                                                   <h3 className="text-xl font-bold text-foreground text-center leading-tight">
                                                      Manual Account
                                                   </h3>
                                                   <p className="text-default-500 text-sm text-center mt-2 leading-relaxed">
                                                      Perfect for cash, crypto, or any offline accounts
                                                   </p>
                                                </CardHeader>
                                                <CardBody className="pt-2 pb-6 px-6 space-y-4">
                                                   <div className="space-y-3">
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:lightning-bolt" className="text-primary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Quick Setup</div>
                                                            <div className="text-default-500 text-xs">Ready in under a minute</div>
                                                         </div>
                                                      </div>
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:shield-check" className="text-primary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Complete Privacy</div>
                                                            <div className="text-default-500 text-xs">Your data stays local</div>
                                                         </div>
                                                      </div>
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:tune-variant" className="text-primary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Full Flexibility</div>
                                                            <div className="text-default-500 text-xs">Any account type supported</div>
                                                         </div>
                                                      </div>
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
                                          title="Connect Bank"
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
                                                      🔒 Bank Grade Security
                                                   </Chip>
                                                   <h3 className="text-xl font-bold text-foreground text-center leading-tight">
                                                      Bank Connection
                                                   </h3>
                                                   <p className="text-default-500 text-sm text-center mt-2 leading-relaxed">
                                                      Automatic sync via secure Open Banking
                                                   </p>
                                                </CardHeader>
                                                <CardBody className="pt-2 pb-6 px-6 space-y-4">
                                                   <div className="space-y-3">
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:sync" className="text-secondary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Real-time Sync</div>
                                                            <div className="text-default-500 text-xs">Transactions updated automatically</div>
                                                         </div>
                                                      </div>
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:bank" className="text-secondary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Enterprise Security</div>
                                                            <div className="text-default-500 text-xs">Military-grade encryption</div>
                                                         </div>
                                                      </div>
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:brain" className="text-secondary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Smart Insights</div>
                                                            <div className="text-default-500 text-xs">AI-powered categorization</div>
                                                         </div>
                                                      </div>
                                                      <div className="flex items-start gap-3">
                                                         <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                            <Icon icon="mdi:bank" className="text-secondary w-3 h-3" />
                                                         </div>
                                                         <div className="text-sm">
                                                            <div className="font-semibold text-foreground">Powered by GoCardless</div>
                                                            <div className="text-default-500 text-xs">3000+ banks supported</div>
                                                         </div>
                                                      </div>
                                                   </div>
                                                </CardBody>
                                             </Card>
                                          </div>
                                       </RevealCard>
                                    </CometCard>
                                 </div>
                              </div>
                           ) : (
                              <div className="flex-1 flex flex-col min-h-0">
                                 <div className="flex-shrink-0 p-4 border-b border-divider bg-content1">
                                    <div className="flex flex-col sm:flex-row gap-3">
                                       <Input
                                          value={institutionQuery}
                                          onChange={handleInputChange}
                                          placeholder="Search institutions"
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
                                          aria-label="Country filter"
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
                                          <LoaderOne size="md" title="Loading institutions..." />
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
                                                <h2 className="wallet-title">No institutions found</h2>
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
                                                         <p className="text-sm font-medium text-foreground">Connecting to your bank...</p>
                                                         <p className="text-xs text-default-500 mt-1">This may take a few moments</p>
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

                                          {/* Loading more indicator */}
                                          {isLoadingMore && (
                                             <div className="flex items-center justify-center py-4">
                                                <LoaderOne size="sm" title="Loading more..." />
                                             </div>
                                          )}

                                          {/* Show progress indicator */}
                                          {hasMoreItems && !isLoadingMore && (
                                             <div className="text-center py-4">
                                                <div className="text-sm text-default-500">
                                                   Showing {displayedInstitutions.length} of {filteredInstitutions.length} institutions
                                                </div>
                                                <div className="text-xs text-default-400 mt-1">
                                                   Scroll down to load more
                                                </div>
                                             </div>
                                          )}

                                          {/* All loaded indicator */}
                                          {!hasMoreItems && filteredInstitutions.length > 40 && (
                                             <div className="text-center py-4">
                                                <div className="text-sm text-default-500">
                                                   All {filteredInstitutions.length} institutions loaded
                                                </div>
                                             </div>
                                          )}
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
      </div >
   );
}