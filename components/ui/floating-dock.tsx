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
            "bg-gradient-to-r from-secondary via-secondary/80 to-secondary",
            "ring-1 ring-white/80 shadow-[0_0_12px_rgba(5,150,105,0.45)]",
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
         <FloatingDockDesktop
            items={items}
            logoutRedirect={logoutRedirect}
            userPlan={normalizedUserPlan as "FREE" | "PRO"}
            className={cn(
               "fixed bottom-3 left-1/2 -translate-x-1/2 z-50",
               desktopClassName,
            )}
         />
         {/* <FloatingDockMobile
            items={items}
            logoutRedirect={logoutRedirect}
            userPlan={normalizedUserPlan as "FREE" | "PRO"}
            className={cn(
               "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
               mobileClassName,
            )}
         /> */}
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
            "mx-auto hidden h-16 items-end rounded-2xl flex bg-white/70 dark:bg-neutral-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 ring-1 ring-primary/20 shadow-lg shadow-primary/10",
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
   let wrapperRef = useRef<HTMLDivElement>(null);

   let distance = useTransform(mouseX, (val: number) => {
      let bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };

      return val - bounds.x - bounds.width / 2;
   });

   // Use dynamic sizing based on passed itemSize
   const hoverScale = 1.25;
   const baseSize = itemSize;
   const hoverSize = Math.min(itemSize * hoverScale, itemSize + 12); // Cap the hover growth
   const iconSize = Math.floor(itemSize * 0.45);
   const iconHoverSize = Math.floor(hoverSize * 0.45);

   let widthTransform = useTransform(distance, [-150, 0, 150], [baseSize, hoverSize, baseSize]);
   let heightTransform = useTransform(distance, [-150, 0, 150], [baseSize, hoverSize, baseSize]);

   let widthTransformIcon = useTransform(distance, [-150, 0, 150], [iconSize, iconHoverSize, iconSize]);
   let heightTransformIcon = useTransform(distance, [-150, 0, 150], [iconSize, iconHoverSize, iconSize]);

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
                  className="absolute bottom-full left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-primary/20 bg-white/90 p-2 sm:p-3 shadow-lg backdrop-blur dark:border-primary/30 dark:bg-neutral-900/90 w-max max-w-[95vw] sm:max-w-[90vw] mb-3"
               >
                  <div className="flex flex-col gap-1 sm:gap-2">
                     {children.map((child) =>
                        child.action === "logout" ? (
                           <button
                              key={`${title}-${child.title}`}
                              onClick={() => signOut({ callbackUrl: logoutRedirect })}
                              className={cn(
                                 "group relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ring-1 transition-colors cursor-pointer",
                                 "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20"
                              )}
                           >
                              <div className="h-4 w-4 sm:h-6 sm:w-6">{child.icon}</div>
                              <span className="pointer-events-none absolute top-1/2 left-full ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-white/95 px-2 py-0.5 text-xs text-neutral-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-primary/30 dark:bg-neutral-800/95 dark:text-white">
                                 {child.title}
                              </span>
                           </button>
                        ) : (
                           <a
                              key={`${title}-${child.title}`}
                              href={child.href}
                              className={cn(
                                 "group relative flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full ring-1 transition-colors",
                                 isUpgradeItem(child)
                                    ? "ring-2 ring-secondary/60 bg-gradient-to-r from-secondary/30 via-secondary/20 to-secondary/30 shadow-[0_0_20px_rgba(5,150,105,0.35)]"
                                    : isActiveHref(child.href)
                                       ? "bg-primary/20 ring-primary/40"
                                       : "bg-gray-200 ring-primary/20 dark:bg-neutral-800 hover:bg-primary/20"
                              )}
                           >
                              <div className="h-4 w-4 sm:h-6 sm:w-6">{child.icon}</div>
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
