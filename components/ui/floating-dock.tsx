"use client";

/**
 * Note: Use position fixed according to your needs
 * Desktop navbar is better positioned at the bottom
 * Mobile navbar is better positioned at bottom right.
 **/

import { cn } from "@heroui/theme";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
   AnimatePresence,
   MotionValue,
   motion,
   useMotionValue,
   useTransform,
} from "framer-motion";

import { useEffect, useRef, useState } from "react";
import { ThemeSwitch } from "../theme-switch";
import { Icon } from "@iconify/react";

const ProBadge = ({ show, className = "" }: { show?: boolean; className?: string }) => {
   if (!show) return null;
   return (
      <span
         className={cn(
            "pointer-events-none select-none absolute -top-2 -right-3 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-white",
            "bg-gradient-to-r from-secondary via-secondary/80 to-secondary",
            "ring-1 ring-white/80 shadow-[0_0_12px_rgba(77,156,185,0.45)]",
            "dark:ring-neutral-900/80",
            'z-100',
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
   children,
   logoutRedirect,
   userPlan,
}: {
   items: DockItem[];
   desktopClassName?: string;
   children?: React.ReactNode;
   logoutRedirect?: string;
   userPlan?: "FREE" | "PRO" | string;
}) => {
   const normalizedUserPlan = (typeof userPlan === "string" ? userPlan : "FREE").toUpperCase();
   return (
      <div className="relative">
         {children}
         <ThemeSwitch />
         <FloatingDockDesktop
            items={items}
            logoutRedirect={logoutRedirect}
            userPlan={normalizedUserPlan as "FREE" | "PRO"}
            className={cn(
               "fixed bottom-3 left-1/2 -translate-x-1/2 z-50",
               desktopClassName,
            )}
         />
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

   // Calculate responsive dimensions for single row layout
   const getResponsiveDimensions = () => {
      const itemCount = items.length;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;

      let itemSize, gap, padding;
      if (vw < 640) { // Mobile
         itemSize = Math.max(32, Math.min(44, (vw * 0.85) / itemCount)); // Adaptive size but min 32px
         gap = Math.max(4, Math.min(12, itemSize * 0.2));
         padding = 12;
      } else if (vw < 1024) { // Tablet
         itemSize = Math.max(40, Math.min(50, (vw * 0.7) / itemCount));
         gap = Math.max(8, Math.min(16, itemSize * 0.25));
         padding = 16;
      } else { // Desktop
         itemSize = Math.max(44, Math.min(56, (vw * 0.6) / itemCount));
         gap = Math.max(12, Math.min(16, itemSize * 0.3));
         padding = 20;
      }

      const totalWidth = (itemCount * itemSize) + ((itemCount - 1) * gap) + (padding * 2);
      const maxWidth = vw * (vw < 640 ? 0.95 : vw < 1024 ? 0.8 : 0.7);

      return {
         itemSize: Math.floor(itemSize),
         gap: Math.floor(gap),
         padding,
         dockWidth: Math.min(totalWidth, maxWidth),
         needsScroll: totalWidth > maxWidth
      };
   };

   const [dimensions, setDimensions] = useState(getResponsiveDimensions());

   useEffect(() => {
      const handleResize = () => {
         setDimensions(getResponsiveDimensions());
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
   }, [items.length]);

   return (
      <motion.div
         style={{
            width: `${dimensions.dockWidth}px`,
            gap: `${dimensions.gap}px`,
            padding: `12px ${dimensions.padding}px`
         }}
         className={cn(
            "mx-auto hidden h-16 items-end rounded-2xl flex",
            "bg-white/10 dark:bg-neutral-900/10 backdrop-blur-xl supports-[backdrop-filter]:bg-white/5 dark:supports-[backdrop-filter]:bg-neutral-900/5",
            "ring-1 ring-black/10 dark:ring-white/10 shadow-xl shadow-black/20 dark:shadow-black/40",
            "border border-white/10 dark:border-white/5",
            dimensions.needsScroll ? "overflow-x-auto scrollbar-none" : "justify-center",
            className,
         )}
      >
         <div
            className="flex items-end"
            style={{ gap: `${dimensions.gap}px` }}
            onMouseMove={(e: React.MouseEvent<HTMLDivElement>) => {
               if (anyChildrenOpen) return;
               mouseX.set(e.pageX);
            }}
            onMouseLeave={() => {
               if (anyChildrenOpen) return;
               mouseX.set(Infinity);
            }}
         >
            {items.map((item) => (
               <IconContainer
                  mouseX={mouseX}
                  key={item.title}
                  {...item}
                  onOpenChange={(open) => setAnyChildrenOpen(open)}
                  logoutRedirect={logoutRedirect}
                  userPlan={userPlan}
                  itemSize={dimensions.itemSize}
               />
            ))}
         </div>
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
   itemSize,
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
   itemSize: number;
}) {
   let ref = useRef<HTMLDivElement>(null);
   const pathname = usePathname();
   const normalizedPath = typeof pathname === "string" ? pathname.replace(/^\/(en|it)(?=\/|$)/, "") : "";
   const isActiveHref = (link?: string) => {
      if (!link) return false;
      if (link === "/dashboard") {
         return normalizedPath === "/dashboard";
      }
      return normalizedPath === link || normalizedPath.startsWith(link + "/");
   };
   const isUpgradeItem = (item?: { title?: string; href?: string }) => {
      if (!item) return false;
      if (item.href && item.href.includes("/upgrade")) return true;
      if (item.href && item.href === "/dashboard" && normalizedPath === "dashboard") return true;
      if (item.title && /upgrade/i.test(item.title)) return true;
      return false;
   };
   
   const isNonFreeUser = userPlan && userPlan !== "FREE";
   let wrapperRef = useRef<HTMLDivElement>(null);

   let distance = useTransform(mouseX, (val: number) => {
      let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

      return val - bounds.x - bounds.width / 2;
   });

   // macOS-style scaling with neighbors effect
   const hoverScale = 1.2; // More subtle like macOS
   const neighborScale = 1.1; // Slight scale for adjacent items
   const baseSize = itemSize;
   const hoverSize = itemSize * hoverScale;
   const neighborSize = itemSize * neighborScale;
   const iconSize = Math.floor(itemSize * 0.45);
   const iconHoverSize = Math.floor(hoverSize * 0.45);
   const iconNeighborSize = Math.floor(neighborSize * 0.45);

   // macOS-style curve with neighbor scaling
   let widthTransform = useTransform(
      distance,
      [-80, -40, 0, 40, 80],
      [baseSize, neighborSize, hoverSize, neighborSize, baseSize]
   );
   let heightTransform = useTransform(
      distance,
      [-80, -40, 0, 40, 80],
      [baseSize, neighborSize, hoverSize, neighborSize, baseSize]
   );

   let widthTransformIcon = useTransform(
      distance,
      [-80, -40, 0, 40, 80],
      [iconSize, iconNeighborSize, iconHoverSize, iconNeighborSize, iconSize]
   );
   let heightTransformIcon = useTransform(
      distance,
      [-80, -40, 0, 40, 80],
      [iconSize, iconNeighborSize, iconHoverSize, iconNeighborSize, iconSize]
   );

   // Direct transforms without spring for immediate response like macOS
   let width = widthTransform;
   let height = heightTransform;
   let widthIcon = widthTransformIcon;
   let heightIcon = heightTransformIcon;

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
               onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     setChildrenOpen((v) => {
                        const next = !v;
                        onOpenChange?.(next);
                        if (next) mouseX.set(Infinity);
                        return next;
                     });
                  }
                  if (e.key === 'Escape' && childrenOpen) {
                     setChildrenOpen(false);
                     onOpenChange?.(false);
                  }
               }}
               aria-expanded={childrenOpen}
               aria-haspopup="menu"
               aria-label={`${title}${children?.length ? ` menu with ${children.length} options` : ''}`}
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
                     "relative flex aspect-square items-center justify-center rounded-full transition-all",
                     "ring-1 ring-inset",
                     (isActiveHref(href) || (children?.some((c) => isActiveHref(c.href)) ?? false))
                        ? "bg-primary/20 ring-primary/40 shadow-lg shadow-primary/20"
                        : "bg-white/80 ring-black/10 dark:bg-neutral-800/80 dark:ring-white/10 hover:bg-primary/15 hover:ring-primary/30 hover:shadow-md hover:shadow-primary/10",
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
                     {children && children.length > 0 && (
                        <span
                           className="absolute -bottom-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-primary/80"
                           aria-hidden="true"
                        />
                     )}
                  </motion.div>
               </motion.div>
            </button>
         ) : (
            <a
               href={href}
               aria-label={title}
               className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-neutral-900 rounded-full"
            >
               <motion.div
                  ref={ref}
                  style={{ width, height }}
                  onMouseEnter={() => setHovered(true)}
                  onMouseLeave={() => setHovered(false)}
                  className={cn(
                     "relative flex aspect-square items-center justify-center rounded-full transition-all",
                     "ring-1 ring-inset",
                     isActiveHref(href)
                        ? "bg-primary/20 ring-primary/40 shadow-lg shadow-primary/20"
                        : "bg-white/80 ring-black/10 dark:bg-neutral-800/80 dark:ring-white/10 hover:bg-primary/15 hover:ring-primary/30 hover:shadow-md hover:shadow-primary/10",
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
                  className="absolute bottom-full left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl supports-[backdrop-filter]:bg-white/90 dark:supports-[backdrop-filter]:bg-neutral-900/85 ring-1 ring-black/15 dark:ring-white/15 shadow-xl shadow-black/25 dark:shadow-black/50 border border-white/30 dark:border-white/20 p-3 w-max max-w-[95vw] sm:max-w-[90vw] mb-3"
               >
                  <div className="flex flex-col gap-1 sm:gap-2">
                     {children.map((child) =>
                        child.action === "logout" ? (
                           <button
                              key={`${title}-${child.title}`}
                              onClick={() => signOut({ callbackUrl: logoutRedirect })}
                              className={cn(
                                 "group relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ring-1 ring-inset transition-all duration-200 cursor-pointer",
                                 "bg-white/80 ring-black/10 dark:bg-neutral-800/80 dark:ring-white/10 hover:bg-primary/15 hover:ring-primary/30 hover:shadow-md hover:shadow-primary/10"
                              )}
                           >
                              <div className="h-4 w-4 sm:h-6 sm:w-6">{child.icon}</div>
                              <span className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white z-[110] backdrop-blur-sm">
                                 {child.title}
                              </span>
                           </button>
                        ) : (
                           <a
                              key={`${title}-${child.title}`}
                              href={child.href}
                              className={cn(
                                 "group relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ring-1 ring-inset transition-all duration-300 overflow-hidden",
                                 // Enhanced upgrade item styling for FREE users
                                 isUpgradeItem(child) && !isNonFreeUser
                                    ? "ring-2 ring-secondary/60 bg-gradient-to-br from-secondary/40 via-secondary/20 to-secondary/40 shadow-[0_0_25px_rgba(77,156,185,0.45)] hover:shadow-[0_0_40px_rgba(77,156,185,0.7)] hover:ring-secondary/80 hover:scale-105 hover:-translate-y-1"
                                    // Premium user - subscription management styling
                                    : isUpgradeItem(child) && isNonFreeUser
                                       ? "ring-2 ring-success/60 bg-gradient-to-br from-success/30 via-success/10 to-success/30 shadow-[0_0_20px_rgba(34,197,94,0.35)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:ring-success/80"
                                    : isActiveHref(child.href)
                                       ? "bg-primary/20 ring-primary/40 shadow-lg shadow-primary/20"
                                       : "bg-white/80 ring-black/10 dark:bg-neutral-800/80 dark:ring-white/10 hover:bg-primary/15 hover:ring-primary/30 hover:shadow-md hover:shadow-primary/10"
                              )}
                           >
                              {/* Premium glow effect for upgrade item (FREE users only) */}
                              {isUpgradeItem(child) && !isNonFreeUser && (
                                 <motion.div
                                    className="absolute inset-0 rounded-full bg-gradient-to-r from-secondary/30 to-secondary/60 opacity-0 group-hover:opacity-100"
                                    animate={{
                                       opacity: [0, 0.3, 0],
                                       scale: [1, 1.05, 1],
                                    }}
                                    transition={{
                                       duration: 2,
                                       repeat: Infinity,
                                       ease: "easeInOut"
                                    }}
                                 />
                              )}
                              
                              {/* Success glow for premium users */}
                              {isUpgradeItem(child) && isNonFreeUser && (
                                 <motion.div
                                    className="absolute inset-0 rounded-full bg-gradient-to-r from-success/20 to-success/40 opacity-0 group-hover:opacity-100"
                                    animate={{
                                       opacity: [0, 0.2, 0],
                                    }}
                                    transition={{
                                       duration: 1.5,
                                       repeat: Infinity,
                                       ease: "easeInOut"
                                    }}
                                 />
                              )}
                              
                              <div className={cn(
                                 "h-4 w-4 sm:h-6 sm:w-6 relative z-10 transition-all duration-300",
                                 isUpgradeItem(child) && !isNonFreeUser && "group-hover:scale-110 group-hover:rotate-12"
                              )}>
                                 {/* Custom upgrade icon for FREE users */}
                                 {isUpgradeItem(child) && !isNonFreeUser ? (
                                    <motion.div
                                       className="relative w-full h-full flex items-center justify-center"
                                       animate={{
                                          rotate: [0, 5, -5, 0],
                                       }}
                                       transition={{
                                          duration: 2,
                                          repeat: Infinity,
                                          ease: "easeInOut"
                                       }}
                                    >
                                      <Icon icon="streamline:diamond-2" className="w-full h-full text-secondary" />
                                       
                                       {/* Floating sparkles */}
                                       <motion.div
                                          className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-secondary rounded-full"
                                          animate={{
                                             scale: [0, 1, 0],
                                             opacity: [0, 1, 0],
                                             y: [0, -4, 0],
                                          }}
                                          transition={{
                                             duration: 1.2,
                                             delay: 0.2,
                                             repeat: Infinity,
                                          }}
                                       />
                                       <motion.div
                                          className="absolute -bottom-1 -left-1 w-1 h-1 bg-secondary rounded-full"
                                          animate={{
                                             scale: [0, 1, 0],
                                             opacity: [0, 1, 0],
                                             x: [0, -3, 0],
                                          }}
                                          transition={{
                                             duration: 1,
                                             delay: 0.6,
                                             repeat: Infinity,
                                          }}
                                       />
                                       <motion.div
                                          className="absolute top-0 right-0 w-1 h-1 bg-secondary rounded-full"
                                          animate={{
                                             scale: [0, 1, 0],
                                             opacity: [0, 1, 0],
                                             x: [0, 2, 0],
                                             y: [0, -2, 0],
                                          }}
                                          transition={{
                                             duration: 0.8,
                                             delay: 1,
                                             repeat: Infinity,
                                          }}
                                       />
                                    </motion.div>
                                 ) : isUpgradeItem(child) && isNonFreeUser ? (
                                    /* Premium management icon */
                                    <motion.div
                                       className="relative w-full h-full flex items-center justify-center"
                                       whileHover={{ scale: 1.1 }}
                                    >
                                       {/* Settings gear with success styling */}
                                       <Icon icon="streamline:diamond-2" className="w-full h-full text-success" />
                                       
                                       {/* Success badge */}
                                       <motion.div
                                          className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-success rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                       >
                                          ✓
                                       </motion.div>
                                    </motion.div>
                                 ) : (
                                    child.icon
                                 )}
                              </div>
                              
                              <span className={cn(
                                 "pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-xs opacity-0 shadow-sm transition-all duration-300 group-hover:opacity-100 z-[110]",
                                 isUpgradeItem(child) && !isNonFreeUser
                                    ? "border border-secondary/30 bg-gradient-to-r from-secondary/20 to-secondary/10 text-secondary dark:text-secondary font-medium shadow-lg shadow-secondary/20 backdrop-blur-sm"
                                    : isUpgradeItem(child) && isNonFreeUser
                                       ? "border border-success/30 bg-gradient-to-r from-success/20 to-success/10 text-success dark:text-success font-medium backdrop-blur-sm"
                                       : "border border-primary/20 bg-white/95 text-neutral-700 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white backdrop-blur-sm"
                              )}>
                                 {isUpgradeItem(child) && isNonFreeUser ? "Manage Subscription" : child.title}
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
