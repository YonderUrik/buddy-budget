"use client";

/**
 * Note: Use position fixed according to your needs
 * Desktop navbar is better positioned at the bottom
 * Mobile navbar is better positioned at bottom right.
 **/

import { cn } from "@heroui/theme";
import { usePathname } from "next/navigation";
import { IconPlus, IconGridDots } from "@tabler/icons-react";
import { signOut } from "next-auth/react";
import {
   AnimatePresence,
   MotionValue,
   motion,
   useMotionValue,
   useSpring,
   useTransform,
} from "framer-motion";

import { useEffect, useRef, useState } from "react";

const ProBadge = ({ show, className = "" }: { show?: boolean; className?: string }) => {
   if (!show) return null;
   return (
      <span
         className={cn(
            "pointer-events-none select-none absolute -top-2 -right-3 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white",
            "bg-gradient-to-r from-primary via-primary/80 to-primary",
            "ring-1 ring-white/80 shadow-[0_0_12px_rgba(5,150,105,0.45)]",
            "dark:ring-neutral-900/80",
            className,
         )}
      >
         PRO
      </span>
   );
};

export type DockItem = {
   title: string;
   icon: React.ReactNode;
   href?: string;
   children?: DockItem[];
   onClick?: () => void;
   action?: "logout";
   plan?: "FREE" | "PRO";
};

export const FloatingDock = ({
   items,
   desktopClassName,
   mobileClassName,
   children,
   logoutRedirect,
   userPlan,
}: {
   items: DockItem[];
   desktopClassName?: string;
   mobileClassName?: string;
   children?: React.ReactNode;
   logoutRedirect?: string;
   userPlan?: "FREE" | "PRO" | string;
}) => {
   const normalizedUserPlan = (typeof userPlan === "string" ? userPlan : "FREE").toUpperCase();
   return (
      <div className="relative">
         {children}
         <FloatingDockDesktop
            items={items}
            logoutRedirect={logoutRedirect}
            userPlan={normalizedUserPlan as "FREE" | "PRO"}
            className={cn(
               "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
               desktopClassName,
            )}
         />
         <FloatingDockMobile
            items={items}
            logoutRedirect={logoutRedirect}
            userPlan={normalizedUserPlan as "FREE" | "PRO"}
            className={cn(
               "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
               mobileClassName,
            )}
         />
      </div>
   );
};

const FloatingDockMobile = ({
   items,
   className,
   logoutRedirect,
   userPlan,
}: {
   items: DockItem[];
   className?: string;
   logoutRedirect?: string;
   userPlan?: "FREE" | "PRO" | string;
}) => {
   const pathname = usePathname();
   const normalizedPath = typeof pathname === "string" ? pathname.replace(/^\/(en|it)(?=\/|$)/, "") : "";
   const isActiveHref = (link?: string) => {
      if (!link) return false;
      return normalizedPath === link || normalizedPath.startsWith(link + "/");
   };
   const isUpgradeItem = (item?: { title?: string; href?: string }) => {
      if (!item) return false;
      if (item.href && item.href.includes("/upgrade")) return true;
      if (item.title && /upgrade/i.test(item.title)) return true;
      return false;
   };
   const [open, setOpen] = useState(false);
   const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null);
   const listRef = useRef<HTMLDivElement>(null);
   const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
   const [childBottom, setChildBottom] = useState<number>(0);
   return (
      <div className={cn("relative block md:hidden", className)}>
         <AnimatePresence>
            {open && (
               <motion.div
                  layoutId="nav"
                  className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2"
               >
                  <div className="relative flex gap-3">
                     <div ref={listRef} className="flex flex-col gap-2">
                        {items.map((item, idx) => (
                           <motion.div
                              ref={(el) => {
                                 itemRefs.current[idx] = el;
                              }}
                              key={item.title}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{
                                 opacity: 0,
                                 y: 10,
                                 transition: { delay: idx * 0.05 },
                              }}
                              transition={{ delay: (items.length - 1 - idx) * 0.05 }}
                           >
                              {item.children && item.children.length > 0 ? (
                                 <button
                                    onClick={() => {
                                       setOpenGroupIndex((prev) => (prev === idx ? null : idx));
                                       const el = itemRefs.current[idx] as HTMLDivElement | null;
                                       const list = listRef.current;
                                       if (el && list) {
                                          const elRect = el.getBoundingClientRect();
                                          const listRect = list.getBoundingClientRect();
                                          const relativeTop = elRect.top - listRect.top; // distance from list top
                                          const bottomOffset = list.clientHeight - (relativeTop + elRect.height);
                                          setChildBottom(bottomOffset);
                                       }
                                    }}
                                    className={cn(
                                       "flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                       (isActiveHref(item.href) || (item.children?.some((c) => isActiveHref(c.href)) ?? false))
                                          ? "bg-primary/20 ring-primary/40"
                                          : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20",
                                    )}
                                 >
                                    <div className="relative h-6 w-6">
                                       {item.icon}
                                       <span className="absolute -bottom-1 -right-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-primary text-white ring-1 ring-white dark:ring-neutral-900">
                                          <IconGridDots className="h-2 w-2" />
                                       </span>
                                    </div>
                                 </button>
                              ) : item.onClick ? (
                                 <button
                                    onClick={item.onClick}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 transition-colors hover:bg-primary/20 dark:bg-primary/15"
                                 >
                                    <div className="h-6 w-6">{item.icon}</div>
                                 </button>
                              ) : item.action === "logout" ? (
                                 <button
                                    onClick={() => signOut({ callbackUrl: logoutRedirect })}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20 transition-colors hover:bg-primary/20 dark:bg-primary/15"
                                 >
                                    <div className="h-6 w-6">{item.icon}</div>
                                 </button>
                              ) : (
                                 <a
                                    href={item.href}
                                    key={item.title}
                                    className={cn(
                                       "flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                       isUpgradeItem(item)
                                          ? "ring-2 ring-primary/60 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 shadow-[0_0_20px_rgba(5,150,105,0.35)]"
                                          : isActiveHref(item.href)
                                             ? "bg-primary/20 ring-primary/40"
                                             : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20",
                                    )}
                                 >
                                    <div className="relative h-6 w-6">
                                       {item.icon}
                                       <ProBadge show={item.plan === "PRO" && userPlan !== "PRO"} />
                                    </div>
                                 </a>
                              )}
                           </motion.div>
                        ))}
                     </div>
                     <AnimatePresence>
                        {openGroupIndex !== null &&
                           items[openGroupIndex]?.children &&
                           items[openGroupIndex]!.children!.length > 0 && (
                              <motion.div
                                 key={`col-${openGroupIndex}`}
                                 initial={{ opacity: 0, x: 8 }}
                                 animate={{ opacity: 1, x: 0 }}
                                 exit={{ opacity: 0, x: 8 }}
                                 style={{ bottom: childBottom, left: 64, position: "absolute" }}
                                 className="z-50 rounded-xl bg-white/90 p-2 ring-1 ring-primary/20 backdrop-blur dark:bg-neutral-900/90 max-h-[60vh] overflow-y-auto"
                              >
                                 <div className="flex flex-col gap-2">
                                    {items[openGroupIndex]!.children!.map((child) => (
                                       child.action === "logout" ? (
                                          <button
                                             key={`col-${items[openGroupIndex]!.title}-${child.title}`}
                                             onClick={() => signOut({ callbackUrl: logoutRedirect })}
                                             className={cn(
                                                "group relative flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                                "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20",
                                             )}
                                          >
                                             <div className="h-6 w-6">{child.icon}</div>
                                             <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white">
                                                {child.title}
                                             </span>
                                          </button>
                                       ) : (
                                          <a
                                             key={`col-${items[openGroupIndex]!.title}-${child.title}`}
                                             href={child.href}
                                             className={cn(
                                                "group relative flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                                isUpgradeItem(child)
                                                   ? "ring-2 ring-primary/60 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 shadow-[0_0_20px_rgba(5,150,105,0.35)]"
                                                   : isActiveHref(child.href)
                                                      ? "bg-primary/20 ring-primary/40"
                                                      : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20",
                                             )}
                                          >
                                             <div className="relative h-6 w-6">
                                                {child.icon}
                                                <ProBadge show={child.plan === "PRO" && userPlan !== "PRO"} />
                                             </div>
                                             <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white">
                                                {child.title}
                                             </span>
                                          </a>
                                       )
                                    ))}
                                 </div>
                              </motion.div>
                           )}
                     </AnimatePresence>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
         <button
            onClick={() => setOpen(!open)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30"
         >
            <IconPlus className="h-6 w-6 text-white" />
         </button>
      </div>
   );
};

const FloatingDockDesktop = ({
   items,
   className,
   logoutRedirect,
   userPlan,
}: {
   items: DockItem[];
   className?: string;
   logoutRedirect?: string;
   userPlan?: "FREE" | "PRO" | string;
}) => {
   let mouseX = useMotionValue(Infinity);
   const [anyChildrenOpen, setAnyChildrenOpen] = useState(false);
   return (
      <motion.div
         onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
            if (anyChildrenOpen) return;
            mouseX.set(e.pageX);
         }}
         onMouseLeave={() => {
            if (anyChildrenOpen) return;
            mouseX.set(Infinity);
         }}
         className={cn(
            "mx-auto hidden h-16 items-end gap-4 rounded-2xl px-4 pb-3 md:flex bg-white/70 dark:bg-neutral-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 ring-1 ring-primary/20 shadow-lg shadow-primary/10",
            className,
         )}
      >
         {items.map((item) => (
            <IconContainer
               mouseX={mouseX}
               key={item.title}
               {...item}
               onOpenChange={(open) => setAnyChildrenOpen(open)}
               logoutRedirect={logoutRedirect}
               userPlan={userPlan}
            />
         ))}
      </motion.div>
   );
};

function IconContainer({
   mouseX,
   title,
   icon,
   href,
   children,
   onOpenChange,
   logoutRedirect,
   userPlan,
   plan,
}: {
   mouseX: MotionValue;
   title: string;
   icon: React.ReactNode;
   href?: string;
   children?: DockItem[];
   onOpenChange?: (open: boolean) => void;
   logoutRedirect?: string;
   userPlan?: "FREE" | "PRO" | string;
   plan?: "FREE" | "PRO";
}) {
   let ref = useRef<HTMLDivElement>(null);
   const pathname = usePathname();
   const normalizedPath = typeof pathname === "string" ? pathname.replace(/^\/(en|it)(?=\/|$)/, "") : "";
   const isActiveHref = (link?: string) => {
      if (!link) return false;
      return normalizedPath === link || normalizedPath.startsWith(link + "/");
   };
   const isUpgradeItem = (item?: { title?: string; href?: string }) => {
      if (!item) return false;
      if (item.href && item.href.includes("/upgrade")) return true;
      if (item.title && /upgrade/i.test(item.title)) return true;
      return false;
   };
   let wrapperRef = useRef<HTMLDivElement>(null);

   let distance = useTransform(mouseX, (val: number) => {
      let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

      return val - bounds.x - bounds.width / 2;
   });

   let widthTransform = useTransform(distance, [-150, 0, 150], [44, 56, 44]);
   let heightTransform = useTransform(distance, [-150, 0, 150], [44, 56, 44]);

   let widthTransformIcon = useTransform(distance, [-150, 0, 150], [28, 36, 28]);
   let heightTransformIcon = useTransform(
      distance,
      [-150, 0, 150],
      [28, 36, 28],
   );

   let width = useSpring(widthTransform, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
   });
   let height = useSpring(heightTransform, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
   });

   let widthIcon = useSpring(widthTransformIcon, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
   });
   let heightIcon = useSpring(heightTransformIcon, {
      mass: 0.1,
      stiffness: 150,
      damping: 12,
   });

   const [hovered, setHovered] = useState(false);
   const [childrenOpen, setChildrenOpen] = useState(false);

   useEffect(() => {
      if (!childrenOpen) return;
      function onDocMouseDown(e: MouseEvent) {
         if (!wrapperRef.current) return;
         if (!wrapperRef.current.contains(e.target as Node)) {
            setChildrenOpen(false);
            onOpenChange?.(false);
         }
      }
      document.addEventListener("mousedown", onDocMouseDown);
      return () => document.removeEventListener("mousedown", onDocMouseDown);
   }, [childrenOpen]);

   return (
      <div
         className="relative"
         ref={wrapperRef}
         onMouseLeave={() => {
            if (childrenOpen) {
              setChildrenOpen(false);
              onOpenChange?.(false);
            }
          }}
      >
         {children && children.length > 0 ? (
            <button
               type="button"
               onClick={() => {
                  setChildrenOpen((v) => {
                     const next = !v;
                     onOpenChange?.(next);
                     if (next) mouseX.set(Infinity);
                     return next;
                  });
               }}
               aria-expanded={childrenOpen}
            >
               <motion.div
                  ref={ref}
                  style={{ width, height }}
                  onMouseEnter={() => {
                     setHovered(true);
                     if (children && children.length > 0) {
                        setChildrenOpen(true);
                        onOpenChange?.(true);
                        mouseX.set(Infinity);
                     }
                  }}
                  onMouseLeave={() => { setHovered(false) }}
                  className={cn(
                     "relative flex aspect-square items-center justify-center rounded-full ring-1 transition-colors",
                     (isActiveHref(href) || (children?.some((c) => isActiveHref(c.href)) ?? false))
                        ? "bg-primary/20 ring-primary/40"
                        : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20 hover:ring-primary/40",
                  )}
               >
                  <AnimatePresence>
                     {hovered && !childrenOpen && (
                        <motion.div
                           initial={{ opacity: 0, y: 10, x: "-50%" }}
                           animate={{ opacity: 1, y: 0, x: "-50%" }}
                           exit={{ opacity: 0, y: 2, x: "-50%" }}
                           className="absolute -top-8 left-1/2 w-fit rounded-md border border-primary/20 bg-white/90 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 shadow-sm dark:border-primary/30 dark:bg-neutral-800/90 dark:text-white"
                        >
                           {title}
                        </motion.div>
                     )}
                  </AnimatePresence>
                  <motion.div
                     style={{ width: widthIcon, height: heightIcon }}
                     className="relative flex items-center justify-center"
                  >
                     {icon}
                     <ProBadge show={userPlan !== "PRO" && ((plan === "PRO") || (children?.some((c) => c.plan === "PRO") ?? false))} />
                     <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-white ring-1 ring-white dark:ring-neutral-900">
                        <IconGridDots className="h-2.5 w-2.5" />
                     </span>
                  </motion.div>
               </motion.div>
            </button>
         ) : (
            <a href={href}>
               <motion.div
                  ref={ref}
                  style={{ width, height }}
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                  className={cn(
                     "relative flex aspect-square items-center justify-center rounded-full ring-1 transition-colors",
                     isActiveHref(href)
                        ? "bg-primary/20 ring-primary/40"
                        : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20 hover:ring-primary/40",
                  )}
               >
                  <AnimatePresence>
                     {hovered && (
                        <motion.div
                           initial={{ opacity: 0, y: 10, x: "-50%" }}
                           animate={{ opacity: 1, y: 0, x: "-50%" }}
                           exit={{ opacity: 0, y: 2, x: "-50%" }}
                           className="absolute -top-8 left-1/2 w-fit rounded-md border border-primary/20 bg-white/90 px-2 py-0.5 text-xs whitespace-pre text-neutral-700 shadow-sm dark:border-primary/30 dark:bg-neutral-800/90 dark:text-white"
                        >
                           {title}
                        </motion.div>
                     )}
                  </AnimatePresence>
                  <motion.div
                     style={{ width: widthIcon, height: heightIcon }}
                     className="flex items-center justify-center"
                  >
                     {icon}
                     <ProBadge show={userPlan !== "PRO" && plan === "PRO"} />
                  </motion.div>
               </motion.div>
            </a>
         )}

         <AnimatePresence>
            {childrenOpen && children && children.length > 0 && (
               <motion.div
                  onMouseEnter={() => setChildrenOpen(true)}
                  onMouseLeave={() => {
                     setChildrenOpen(false);
                     onOpenChange?.(false);
                     mouseX.set(Infinity);
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-primary/20 bg-white/90 p-3 shadow-lg backdrop-blur dark:border-primary/30 dark:bg-neutral-900/90 w-max max-w-[90vw] mb-3"
               >
                  <div className="flex flex-col gap-2">
                     {children.map((child) =>
                        child.action === "logout" ? (
                           <button
                              key={`${title}-${child.title}`}
                              onClick={() => signOut({ callbackUrl: logoutRedirect })}
                              className={cn(
                                 "group relative flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors cursor-pointer",
                                 "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20"
                              )}
                           >
                              <div className="h-6 w-6">{child.icon}</div>
                              <span className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white">
                                 {child.title}
                              </span>
                           </button>
                        ) : (
                           <a
                              key={`${title}-${child.title}`}
                              href={child.href}
                              className={cn(
                                 "group relative flex h-12 w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                 isUpgradeItem(child)
                                    ? "ring-2 ring-primary/60 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30 shadow-[0_0_20px_rgba(5,150,105,0.35)]"
                                    : isActiveHref(child.href)
                                       ? "bg-primary/20 ring-primary/40"
                                       : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20"
                              )}
                           >
                              <div className="h-6 w-6">{child.icon}</div>
                              <span className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white">
                                 {child.title}
                              </span>
                           </a>
                        ),
                     )}
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
}
