"use client"

import { motion } from "framer-motion"
import { CheckIcon, Settings, Wallet, Tag, CheckCircle } from "lucide-react"

export function StepIndicator({ steps, currentStep }) {
   // Icons per ogni step
   const stepIcons = [
      <Settings className="h-4 w-4" />,   // Preferenze
      <Wallet className="h-4 w-4" />,     // Conti
      <Tag className="h-4 w-4" />,        // Categorie
      <CheckCircle className="h-4 w-4" /> // Completamento
   ]
   
   return (
      <div className="w-full">
         {/* Mobile version (pill style indicator) - visible on small screens */}
         <div className="block md:hidden">
            <div className="bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
               <motion.div 
                  className="h-full bg-blue-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                  transition={{ duration: 0.5 }}
               />
            </div>
            <div className="flex justify-between mt-2">
               {steps.map((step, index) => (
                  <motion.div 
                     key={index}
                     className="text-xs flex items-center gap-1"
                     initial={{ opacity: 0.4 }}
                     animate={{ 
                        opacity: index <= currentStep ? 1 : 0.4,
                        fontWeight: index === currentStep ? 500 : 400,
                        color: index === currentStep ? '#2563eb' : '#6b7280'
                     }}
                  >
                     {(index === 0 || index === steps.length - 1) && (
                        <>
                           <span className="hidden sm:inline">{stepIcons[index]}</span>
                           <span>{step}</span>
                        </>
                     )}
                  </motion.div>
               ))}
            </div>
         </div>
         
         {/* Desktop version (numbered steps) - visible on medium and larger screens */}
         <div className="hidden md:block">
            <div className="flex justify-between items-center w-full relative">
               {/* Progress bar in background */}
               <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700">
                  <motion.div 
                     className="h-full bg-blue-600"
                     initial={{ width: '0%' }}
                     animate={{ 
                        width: `${(currentStep / (steps.length - 1)) * 100}%` 
                     }}
                     transition={{ duration: 0.5 }}
                  />
               </div>
               
               {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center z-10">
                     {/* Step circle - Utilizzo className per gestire dark mode */}
                     <motion.div
                        className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 shadow-sm border-2
                           ${index < currentStep 
                              ? "bg-blue-600 border-blue-600 text-white" 
                              : index === currentStep 
                                 ? "bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400" 
                                 : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300"
                           }
                           ${index <= currentStep ? "shadow-[0_0_0_2px_rgba(37,99,235,0.2)]" : ""}
                        `}
                        transition={{ duration: 0.3 }}
                     >
                        {index < currentStep ? (
                           <CheckIcon className="h-5 w-5" />
                        ) : (
                           <div className="flex flex-col items-center justify-center">
                              {stepIcons[index]}
                           </div>
                        )}
                     </motion.div>
                     
                     {/* Step label */}
                     <span className={`text-xs text-center max-w-[100px] font-medium
                        ${index === currentStep 
                           ? "text-blue-600 dark:text-blue-400 font-semibold" 
                           : index < currentStep 
                              ? "text-gray-700 dark:text-gray-300" 
                              : "text-gray-500 dark:text-gray-400"
                        }
                     `}>
                        {step}
                     </span>
                  </div>
               ))}
            </div>
         </div>
      </div>
   )
}

