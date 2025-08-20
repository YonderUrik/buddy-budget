"use client";

import type { ButtonProps, CardProps } from "@heroui/react";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, PieChart, Pie, Tooltip, Cell } from "recharts";
import {
   Card,
   cn,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatCurrency } from "@/lib/format";


type ChartData = {
   name: string;
   value: number;
   icon?: string;
   color?: string;
   institutionLogo?: string;
   currency?: string;
   [key: string]: string | number | undefined;
};

export type CircleChartProps = {
   title: string;
   color: ButtonProps["color"];
   categories: string[];
   chartData: ChartData[];
};

const formatTotal = (total: number) => {
   return formatCurrency(total, 'EUR');
};



export const AccountsPieChart = React.forwardRef<
   HTMLDivElement,
   Omit<CardProps, "children"> & CircleChartProps
>(({ className, title, categories, color, chartData, ...props }, ref) => {
   const [isClient, setIsClient] = useState(false);

   useEffect(() => {
      setIsClient(true);
   }, []);

   const totalValue = chartData.reduce((acc, curr) => acc + (curr.value as number), 0);

   return (
      <Card
         ref={ref}
         className={cn("dark:border-default-100 min-h-[240px] border border-transparent", className)}
         {...props}
      >
         <div className="flex flex-col gap-y-2 p-4 pb-0">
            <div className="flex items-center justify-between gap-x-2">
               <dt>
                  <h3 className="text-small text-default-500 font-medium">{title}</h3>
               </dt>
               <div className="flex items-center justify-end gap-x-2">
                  <span className="text-default-700 font-mono font-medium">
                     {isClient ? formatTotal(totalValue) : `€${totalValue.toFixed(2)}`}
                  </span>
               </div>
            </div>
         </div>
         <div className="flex h-full flex-wrap items-center justify-center gap-x-2 lg:flex-nowrap">
            <ResponsiveContainer
               className="[&_.recharts-surface]:outline-hidden"
               height={200}
               width="100%"
            >
               <PieChart accessibilityLayer margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Tooltip
                     content={({ label, payload }) => (
                        <div className="rounded-medium bg-background/60 backdrop-blur-md text-tiny shadow-small flex h-8 min-w-[120px] items-center gap-x-2 px-1">
                           <span className="text-foreground font-medium">{label}</span>
                           {payload?.map((p, index) => {
                              const name = p.name;
                              const value = p.value;
                              const category = categories.find((c) => c.toLowerCase() === name) ?? name;
                              
                              // Find the corresponding chart data item to get custom color
                              const chartItem = chartData.find(item => item.name === name);
                              const tooltipColor = chartItem?.color || `hsl(var(--heroui-${color}-${(index + 1) * 200}))`;

                              return (
                                 <div key={`${index}-${name}`} className="flex w-full items-center gap-x-2">
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                       {chartItem?.institutionLogo ? (
                                          <img
                                             src={chartItem.institutionLogo}
                                             alt=""
                                             className="w-4 h-4 rounded object-contain bg-white"
                                          />
                                       ) : chartItem?.icon ? (
                                          <div
                                             className="w-4 h-4 rounded flex items-center justify-center"
                                             style={{ backgroundColor: tooltipColor }}
                                          >
                                             <Icon icon={chartItem.icon} className="text-white text-xs" />
                                          </div>
                                       ) : (
                                          <span
                                             className="h-2 w-2 rounded-full flex-shrink-0"
                                             style={{ backgroundColor: tooltipColor }}
                                          />
                                       )}
                                    </div>
                                    <div className="text-default-700 flex w-full items-center justify-between gap-x-2 pr-1 text-xs">
                                       <span className="text-default-500">{category}</span>
                                       <span className="text-default-700 font-mono font-medium">
                                          {isClient ? formatTotal(value as number) : `€${(value as number).toFixed(2)}`}
                                       </span>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                     cursor={false}
                  />
                  <Pie
                     animationDuration={1000}
                     animationEasing="ease"
                     data={chartData}
                     dataKey="value"
                     innerRadius="65%"
                     nameKey="name"
                     paddingAngle={-20}
                     strokeWidth={0}
                     cornerRadius={10} 
                  >
                     {chartData.map((item, index) => {
                        const fillColor = item.color || `hsl(var(--heroui-${color}-${(index + 1) * 200}))`;
                        return (
                           <Cell
                              key={`cell-${index}`}
                              fill={fillColor}
                           />
                        );
                     })}
                  </Pie>
               </PieChart>
            </ResponsiveContainer>

            <div className="text-tiny text-default-500 flex w-full flex-col justify-center gap-4 p-4 lg:p-0">
               {chartData.map((item, index) => {
                  const itemColor = item.color || `hsl(var(--heroui-${color}-${(index + 1) * 200}))`;
                  return (
                     <div key={index} className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                           {item.institutionLogo ? (
                              <img
                                 src={item.institutionLogo}
                                 alt=""
                                 className="w-4 h-4 rounded object-contain bg-white"
                              />
                           ) : item.icon ? (
                              <div
                                 className="w-4 h-4 rounded flex items-center justify-center"
                                 style={{ backgroundColor: itemColor }}
                              >
                                 <Icon icon={item.icon} className="text-white text-xs" />
                              </div>
                           ) : (
                              <span
                                 className="h-2 w-2 rounded-full flex-shrink-0"
                                 style={{ backgroundColor: itemColor }}
                              />
                           )}
                        </div>
                        <div className="flex items-center justify-between w-full min-w-0 gap-2 mr-5">
                           <span className="capitalize truncate text-xs">{item.name}</span>
                           <span className="capitalize truncate text-xs font-medium">
                              {isClient ? formatCurrency(item.value as number, item.currency || 'EUR') : `€${(item.value as number).toFixed(2)}`}
                           </span>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </Card>
   );
});