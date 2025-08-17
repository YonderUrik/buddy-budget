"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@iconify/react";
import { Dictionary } from "@/types/dictionary";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Alert, Select, SelectItem, Popover, PopoverTrigger, PopoverContent, Chip } from "@heroui/react";
import { LoaderOne } from "./ui/loader";

type Category = {
   id: string;
   name: string;
   icon: string;
   color: string;
   type: "income" | "expense" | "transfer" | string;
   isActive: boolean;
   createdAt?: string;
   updatedAt?: string;
};

const COLOR_SWATCHES: string[] = [
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
];

const CATEGORY_ICON_SET: string[] = [
   "mdi:cart-outline",
   "mdi:food-fork-drink",
   "mdi:coffee",
   "mdi:home-outline",
   "mdi:wallet-outline",
   "mdi:bus",
   "mdi:train",
   "mdi:car",
   "mdi:gas-station",
   "mdi:tshirt-crew-outline",
   "mdi:gift-outline",
   "mdi:cake-variant-outline",
   "mdi:airplane",
   "mdi:beach",
   "mdi:dumbbell",
   "mdi:heart-outline",
   "mdi:medical-bag",
   "mdi:tooth-outline",
   "mdi:pill",
   "mdi:school-outline",
   "mdi:book-outline",
   "mdi:music",
   "mdi:television",
   "mdi:cellphone",
   "mdi:wifi",
   "mdi:lightning-bolt-outline",
   "mdi:water",
   "mdi:shield-check",
   "mdi:hammer-wrench",
   "mdi:bank-transfer",
   "mdi:cash",
   "mdi:piggy-bank",
   "mdi:chart-line",
];

const TYPE_ICON: Record<"income" | "expense" | "transfer", string> = {
   income: "uil:money-insert",
   expense: "uil:money-withdraw",
   transfer: "mingcute:transfer-4-line",
};

export default function Categories({ dict }: { dict: Dictionary }) {

   const [categories, setCategories] = useState<Category[]>([]);
   const [loading, setLoading] = useState<boolean>(true);
   const [errorMessage, setErrorMessage] = useState<string | null>(null);

   const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
   const [editing, setEditing] = useState<Category | null>(null);
   const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
   const [mutatingId, setMutatingId] = useState<string | null>(null);

   const [name, setName] = useState<string>("");
   const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
   const [icon, setIcon] = useState<string>("mdi:tag");
   const [color, setColor] = useState<string>("#16a34a");
   const [isActive, setIsActive] = useState<boolean>(true);
   const [query, setQuery] = useState<string>("");
   const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income" | "transfer">("all");

   const id = useId();
   const ref = useRef<HTMLDivElement>(null);

   const headerTitle = useMemo(() => dict?.dashboard?.dock?.categories ?? "Categories", [dict]);
   const t = (dict as any)?.dashboard?.categoriesPage as any;
   const filterLabels = useMemo(() => ({
      all: t?.filters?.all ?? "All",
      expense: t?.filters?.expense ?? "Expense",
      income: t?.filters?.income ?? "Income",
      transfer: t?.filters?.transfer ?? "Transfer",
   }), [t]);
   const actionLabels = useMemo(() => ({
      new: t?.actions?.new ?? "New",
      edit: t?.actions?.edit ?? "Edit",
      save: t?.actions?.save ?? "Save",
      create: t?.actions?.create ?? "Create",
      cancel: t?.actions?.cancel ?? "Cancel",
      delete: t?.actions?.delete ?? "Delete",
   }), [t]);
   const fieldLabels = useMemo(() => ({
      name: t?.fields?.name ?? "Name",
      type: t?.fields?.type ?? "Type",
      icon: t?.fields?.icon ?? "Icon",
      color: t?.fields?.color ?? "Color",
      searchPlaceholder: t?.fields?.searchPlaceholder ?? "Search category...",
   }), [t]);
   const modalLabels = useMemo(() => ({
      titleNew: t?.modal?.titleNew ?? "New category",
      titleEdit: t?.modal?.titleEdit ?? "Edit category",
      deleteConfirmTitle: t?.modal?.deleteConfirmTitle ?? "Delete category?",
      deleteConfirmDesc: t?.modal?.deleteConfirmDesc ?? "This will delete the category from the list.",
   }), [t]);
   const stateLabels = useMemo(() => ({
      loading: t?.states?.loading ?? "Loading…",
      loadingDesc: t?.states?.loadingDesc ?? "Please wait while we load the categories",
      empty: t?.states?.empty ?? "No categories yet. Create your first one.",
      errorLoad: t?.states?.errorLoad ?? "Failed to load categories",
      errorGeneric: t?.states?.errorGeneric ?? "Something went wrong",
   }), [t]);
   const typeInfo = useMemo(() => ({
      expense: { title: t?.types?.expense?.title ?? "Expense", desc: t?.types?.expense?.desc ?? "Money going out" },
      income: { title: t?.types?.income?.title ?? "Income", desc: t?.types?.income?.desc ?? "Money coming in" },
      transfer: { title: t?.types?.transfer?.title ?? "Transfer", desc: t?.types?.transfer?.desc ?? "Between accounts" },
   }), [t]);

   async function fetchCategories() {
      setLoading(true);
      setErrorMessage(null);
      try {
         const res = await fetch("/api/categories", { cache: "no-store" });
         if (!res.ok) throw new Error(stateLabels.errorLoad);
         const data = await res.json();
         setCategories(data as Category[]);
      } catch (err) {
         setErrorMessage(stateLabels.errorLoad);
      } finally {
         setLoading(false);
      }
   }

   function openCreateModal() {
      setEditing(null);
      setName("");
      setType("expense");
      setIcon("mdi:tag");
      setColor("#16a34a");
      setIsActive(true);
      setIsModalOpen(true);
   }

   function openEditModal(category: Category) {
      setEditing(category);
      setName(category.name);
      setType((category.type as any) || "expense");
      setIcon(category.icon || "mdi:tag");
      setColor(category.color || "#16a34a");
      setIsActive(category.isActive ?? true);
      setIsModalOpen(true);
   }

   async function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      setErrorMessage(null);
      setIsSubmitting(true);
      try {
         const payload = { name, type, icon, color, isActive };
         if (editing) setMutatingId(editing.id);
         const res = await fetch(editing ? `/api/categories/${editing.id}` : "/api/categories", {
            method: editing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
         });
         if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || stateLabels.errorGeneric);
         }
         const updated = await res.json();
         if (editing) {
            setCategories((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
         } else {
            setCategories((prev) => [updated as Category, ...prev]);
         }
         setIsModalOpen(false);
      } catch (err: any) {
         setErrorMessage(err?.message || stateLabels.errorGeneric);
      } finally {
         setIsSubmitting(false);
         setMutatingId(null);
      }
   }

   async function handleDelete() {
      if (!editing) return;
      try {
         setMutatingId(editing.id);
         const res = await fetch(`/api/categories/${editing.id}`, { method: "DELETE" });
         if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err?.error || stateLabels.errorGeneric);
         }
         setCategories((prev) => prev.filter((c) => c.id !== editing.id));
         setIsModalOpen(false);
      } catch (err: any) {
         setErrorMessage(err?.message || stateLabels.errorGeneric);
      } finally {
         setMutatingId(null);
      }
   }

   useEffect(() => {
      fetchCategories();
   }, []);

   useEffect(() => {
      function onKeyDown(event: KeyboardEvent) {
         if (event.key === "Escape") {
            setIsModalOpen(false);
         }
      }
      if (isModalOpen) {
         document.body.style.overflow = "hidden";
      } else {
         document.body.style.overflow = "auto";
      }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
   }, [isModalOpen]);

   // Note: outside click handled by backdrop onClick to avoid closing when interacting with portal popovers.

   const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      let list = categories;
      if (typeFilter !== "all") {
         list = list.filter((c) => (c.type as string) === typeFilter);
      }
      if (!q) return list;
      return list.filter((c) => c.name.toLowerCase().includes(q));
   }, [categories, query, typeFilter]);

   return (
      <>
         {loading ? (
            <div className="text-sm text-neutral-500 flex items-center justify-center h-full">
               <LoaderOne title={stateLabels.loading} subtitle={stateLabels.loadingDesc} />
            </div>
         ) : (
            <>
               <div className="max-w-2xl mx-auto w-full flex flex-col gap-2 mb-4">
                  <div className="flex items-center justify-between gap-2">
                     <h2 className="text-xl font-semibold">{headerTitle}</h2>
                     <div className="flex items-center gap-2">
                        <Select
                           isRequired
                           aria-label="Type filter"
                           className="w-36"
                           selectedKeys={[typeFilter]}
                           onSelectionChange={(keys) => {
                              const key = Array.from(keys)[0] as any;
                              if (!key) return;
                              setTypeFilter(key as any);
                           }}
                           renderValue={() => (
                              <span className="flex items-center gap-2 text-sm">
                                 {typeFilter === "all" && <Icon icon="mdi:filter" className="text-default-500" />}
                                 {typeFilter === "expense" && <Icon icon={TYPE_ICON.expense} className="text-red-500" />}
                                 {typeFilter === "income" && <Icon icon={TYPE_ICON.income} className="text-green-500" />}
                                 {typeFilter === "transfer" && <Icon icon={TYPE_ICON.transfer} className="text-blue-500" />}
                                 <span className="capitalize">{filterLabels[typeFilter]}</span>
                              </span>
                           )}
                        >
                           <SelectItem key="all" textValue={filterLabels.all}>{filterLabels.all}</SelectItem>
                           <SelectItem key="expense" textValue={filterLabels.expense}>{filterLabels.expense}</SelectItem>
                           <SelectItem key="income" textValue={filterLabels.income}>{filterLabels.income}</SelectItem>
                           <SelectItem key="transfer" textValue={filterLabels.transfer}>{filterLabels.transfer}</SelectItem>
                        </Select>
                        <motion.div layoutId={`card-new-${id}`} className="inline-block">
                           <motion.div layoutId={`button-new-${id}`} className="inline-block">
                              <Button onClick={openCreateModal} color="primary" size="md" className="rounded-full">
                                 + {actionLabels.new}
                              </Button>
                           </motion.div>
                        </motion.div>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Input
                        value={query}
                        size="lg"
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={fieldLabels.searchPlaceholder}
                        className="w-full py-2 rounded-md outline-none text-sm"
                        startContent={<Icon icon="mdi:magnify" className="text-neutral-400" />}
                        endContent={query && (
                           <button onClick={() => setQuery("")} className="text-neutral-400 hover:text-neutral-600">
                              <Icon icon="mdi:close-circle" />
                           </button>
                        )}
                     />
                  </div>
               </div>

               {errorMessage && (
                  <Alert color="danger" className="max-w-2xl mx-auto w-full mb-3">
                     {errorMessage}
                  </Alert>
               )}

               <AnimatePresence>
                  {isModalOpen && (
                     <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 h-full w-full z-10"
                        onClick={() => setIsModalOpen(false)}
                     />
                  )}
               </AnimatePresence>

               <AnimatePresence>
                  {isModalOpen ? (
                     <div className="fixed inset-0 grid place-items-center z-[100]" onClick={() => setIsModalOpen(false)}>
                        <motion.div
                           layoutId={`card-${editing ? editing.id : "new"}-${id}`}
                           ref={ref}
                           className="w-full max-w-[500px] h-[100dvh] md:h-fit md:max-h-[90vh] flex flex-col bg-content1 sm:rounded-3xl overflow-hidden"
                           onClick={(e) => e.stopPropagation()}
                           onMouseDown={(e) => e.stopPropagation()}
                        >
                           <div className="flex justify-between items-start p-4 border-b border-divider">
                              <div className="flex items-center gap-3">
                                 <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
                                    <Icon icon={icon || "mdi:tag"} className="text-xl" />
                                 </div>
                                 <div className="flex flex-col">
                                    <motion.h3 layoutId={`title-${editing ? editing.id : "new"}-${id}`} className="font-bold text-foreground">
                                       {editing ? modalLabels.titleEdit : modalLabels.titleNew}
                                    </motion.h3>
                                    <div className="flex items-center gap-2 text-default-500 text-small">
                                       <span className="capitalize">{typeInfo[type]?.title}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2">
                                 {editing && (
                                    <Button
                                       onClick={(e) => {
                                          e.stopPropagation();
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
                                    onClick={() => setIsModalOpen(false)}
                                    variant="light"
                                    size="md"
                                    isIconOnly
                                 >
                                    <Icon icon="mdi:close" width={20} height={20} />
                                 </Button>
                              </div>
                           </div>
                           <div className="pt-1 relative px-4 flex-1 flex flex-col min-h-0 mt-5">
                              <motion.form
                                 layout
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                                 onSubmit={handleSubmit}
                                 className="text-foreground text-sm flex-1 pb-6 flex flex-col gap-5 overflow-auto md:overflow-visible"
                              >
                                 <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                       <Input
                                          label={fieldLabels.name}
                                          value={name}
                                          onChange={(e) => setName(e.target.value)}
                                          isRequired
                                          placeholder="e.g. Groceries"
                                          variant="flat"
                                       />
                                       <Select
                                          label={fieldLabels.type}
                                          selectedKeys={[type]}
                                          isRequired
                                          onSelectionChange={(keys) => {
                                             const selectedType = Array.from(keys)[0] as "income" | "expense" | "transfer";
                                             if (!selectedType) return;
                                             setType(selectedType);
                                          }}
                                          variant="flat"
                                          renderValue={() => {
                                             if (type === "expense") {
                                                return (
                                                   <span className="flex items-center gap-2">
                                                      <div className="h-5 w-5 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                                         <Icon icon={TYPE_ICON.expense} className="text-red-600 text-sm" />
                                                      </div>
                                                      <span className="font-medium">{typeInfo.expense.title}</span>
                                                   </span>
                                                );
                                             }
                                             if (type === "income") {
                                                return (
                                                   <span className="flex items-center gap-2">
                                                      <div className="h-5 w-5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                                         <Icon icon={TYPE_ICON.income} className="text-emerald-600 text-sm" />
                                                      </div>
                                                      <span className="font-medium">{typeInfo.income.title}</span>
                                                   </span>
                                                );
                                             }
                                             if (type === "transfer") {
                                                return (
                                                   <span className="flex items-center gap-2">
                                                      <div className="h-5 w-5 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                                         <Icon icon={TYPE_ICON.transfer} className="text-blue-600 text-sm" />
                                                      </div>
                                                      <span className="font-medium">{typeInfo.transfer.title}</span>
                                                   </span>
                                                );
                                             }
                                             return null;
                                          }}
                                       >
                                          <SelectItem
                                             key="expense"
                                             textValue={typeInfo.expense.title}
                                          >
                                             <span className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                                   <Icon icon={TYPE_ICON.expense} className="text-red-600 text-sm" />
                                                </div>
                                                <div className="flex flex-col">
                                                   <span className="font-medium">{typeInfo.expense.title}</span>
                                                   <span className="text-xs text-default-500">{typeInfo.expense.desc}</span>
                                                </div>
                                             </span>
                                          </SelectItem>
                                          <SelectItem
                                             key="income"
                                             textValue={typeInfo.income.title}
                                          >
                                             <span className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                                   <Icon icon={TYPE_ICON.income} className="text-emerald-600 text-sm" />
                                                </div>
                                                <div className="flex flex-col">
                                                   <span className="font-medium">{typeInfo.income.title}</span>
                                                   <span className="text-xs text-default-500">{typeInfo.income.desc}</span>
                                                </div>
                                             </span>
                                          </SelectItem>
                                          <SelectItem
                                             key="transfer"
                                             textValue={typeInfo.transfer.title}
                                          >
                                             <span className="flex items-center gap-3">
                                                <div className="h-6 w-6 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                                                   <Icon icon={TYPE_ICON.transfer} className="text-blue-600 text-sm" />
                                                </div>
                                                <div className="flex flex-col">
                                                   <span className="font-medium">{typeInfo.transfer.title}</span>
                                                   <span className="text-xs text-default-500">{typeInfo.transfer.desc}</span>
                                                </div>
                                             </span>
                                          </SelectItem>
                                       </Select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground">{fieldLabels.icon}</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button type="button" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="flex items-center justify-center px-3 py-2 rounded-medium bg-default-100 hover:bg-default-200">
                                                   <div className="h-7 w-7 rounded-small flex items-center justify-center" style={{ backgroundColor: color }}>
                                                      <Icon icon={icon || "mdi:tag"} className="text-white text-lg" />
                                                   </div>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                <div className="grid grid-cols-6 gap-2">
                                                   {CATEGORY_ICON_SET.map((ic) => (
                                                      <button
                                                         key={ic}
                                                         type="button"
                                                         onClick={() => setIcon(ic)}
                                                         className={`h-10 w-10 rounded-medium flex items-center justify-center border border-default-200 hover:bg-default-100 ${icon === ic ? "ring-2 ring-primary" : ""}`}
                                                      >
                                                         <Icon icon={ic} className="text-xl text-foreground" />
                                                      </button>
                                                   ))}
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                       <div className="flex flex-col gap-2">
                                          <label className="text-small text-foreground">{fieldLabels.color}</label>
                                          <Popover placement="bottom-start">
                                             <PopoverTrigger>
                                                <button type="button" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className="flex items-center gap-3 px-3 py-2 rounded-medium bg-default-100 hover:bg-default-200">
                                                   <div className="h-7 w-7 rounded-small" style={{ backgroundColor: color }} />
                                                   <span className="text-sm text-default-700">{color}</span>
                                                </button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-3 max-w-xs" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                                                <div className="grid grid-cols-7 gap-2">
                                                   {COLOR_SWATCHES.map((c) => (
                                                      <button
                                                         key={c}
                                                         type="button"
                                                         onClick={() => setColor(c)}
                                                         className={`h-8 w-8 rounded-small border border-default-200 ${color === c ? "ring-2 ring-primary" : ""}`}
                                                         style={{ backgroundColor: c }}
                                                      />
                                                   ))}
                                                </div>
                                                <div className="mt-3">
                                                   <Input
                                                      size="sm"
                                                      placeholder="#16a34a"
                                                      value={color}
                                                      onChange={(e) => setColor(e.target.value)}
                                                   />
                                                </div>
                                             </PopoverContent>
                                          </Popover>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="flex items-center justify-end gap-2 mt-2">
                                    <Button
                                       type="button"
                                       onClick={() => setIsModalOpen(false)}
                                       variant="flat"
                                       color="default"
                                       startContent={<Icon icon="mdi:close" className="text-base" />}
                                    >
                                       {actionLabels.cancel}
                                    </Button>
                                    <motion.div layoutId={`button-${editing ? editing.id : "new"}-${id}`}>
                                       <Button
                                          type="submit"
                                          color="primary"
                                          startContent={<Icon icon="mdi:content-save-outline" className="text-base" />}
                                       >
                                          {editing ? actionLabels.save : actionLabels.create}
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
                                          <h4 className="font-semibold text-foreground mb-1">{modalLabels.deleteConfirmTitle}</h4>
                                          <p className="text-small text-default-500">{modalLabels.deleteConfirmDesc}</p>
                                       </div>
                                    </div>
                                    <div className="mt-4 flex items-center justify-end gap-2">
                                       <Button variant="flat" onClick={() => setConfirmOpen(false)}>{actionLabels.cancel}</Button>
                                       <Button color="danger" onClick={async () => { await handleDelete(); setConfirmOpen(false); }}>{actionLabels.delete}</Button>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </motion.div>
                     </div>
                  ) : null}
               </AnimatePresence>

               <div className="max-w-2xl mx-auto w-full">
                  <div className="w-full flex flex-col gap-3">
                     {filtered.length === 0 ? (
                        <div className="w-full flex items-center justify-center py-10">
                           <div className="wallet-container">
                              <div className="wallet-bg"></div>
                              <div className="wallet-icon">
                                 <div className="wallet"></div>
                                 <div className="card"></div>
                                 <div className="card"></div>
                              </div>
                              <h2 className="wallet-title">{stateLabels.empty}</h2>
                           </div>
                        </div>
                     ) : (
                        filtered.map((cat) => (
                           <motion.div
                              layoutId={`card-${cat.id}-${id}`}
                              key={`card-${cat.id}-${id}`}
                              onClick={() => openEditModal(cat)}
                              className="p-4 bg-content1 hover:bg-content2 rounded-large cursor-pointer ring-1 ring-primary/20 transition-colors"
                           >
                              <div className="flex items-center justify-between gap-4">
                                 <div className="flex items-center gap-4">
                                    <motion.div layoutId={`image-${cat.id}-${id}`}>
                                       <div
                                          className="h-12 w-12 rounded-medium flex items-center justify-center"
                                          style={{ backgroundColor: cat.color }}
                                       >
                                          <Icon icon={cat.icon || "mdi:tag"} className="text-white text-2xl" />
                                       </div>
                                    </motion.div>
                                    <div className="flex flex-col">
                                       <motion.h3 layoutId={`title-${cat.id}-${id}`} className="text-foreground font-medium">
                                          {cat.name}
                                       </motion.h3>
                                       <div className="flex items-center gap-2">
                                          <Icon
                                             icon={TYPE_ICON[cat.type as keyof typeof TYPE_ICON]}
                                             className={`text-sm ${cat.type === "expense" ? "text-red-500" :
                                                cat.type === "income" ? "text-green-500" :
                                                   cat.type === "transfer" ? "text-blue-500" : "text-gray-500"
                                                }`}
                                          />
                                          <span className={`text-xs font-medium capitalize ${cat.type === "expense" ? "text-red-600" :
                                             cat.type === "income" ? "text-green-600" :
                                                cat.type === "transfer" ? "text-blue-600" : "text-gray-600"
                                             }`}>
                                             {typeInfo[cat.type as keyof typeof typeInfo]?.title || cat.type}
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                                 <motion.div layoutId={`button-${cat.id}-${id}`}>
                                    <Button
                                       onPress={() => openEditModal(cat)}
                                       size="sm"
                                       variant="flat"
                                       color="default"
                                       className="font-medium"
                                    >
                                       <span className="flex items-center gap-2">
                                          <Icon icon="mdi:pencil-outline" />
                                          <span>{actionLabels.edit}</span>
                                       </span>
                                    </Button>
                                 </motion.div>
                              </div>
                           </motion.div>
                        ))
                     )}
                  </div>
               </div>
            </>
         )}
      </>
   );
}