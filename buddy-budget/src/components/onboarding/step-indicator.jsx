"use client"

import { motion } from "framer-motion"
import { CheckIcon, Settings, Wallet, Tag, CheckCircle, ArrowRightCircle, HelpCircle, DollarSign } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function StepIndicator({ steps, currentStep }) {
   // Icons for each step
   const stepIcons = [
      <Settings className="h-4 w-4" />,     // Preferences
      <Wallet className="h-4 w-4" />,       // Accounts
      <Tag className="h-4 w-4" />,          // Categories
      <DollarSign className="h-4 w-4" />,   // Transactions
      <CheckCircle className="h-4 w-4" />   // Completion
   ]
   
   // Descriptions for each step for accessibility and tooltips
   const stepDescriptions = [
      "Set your currency and date format preferences",
      "Add your bank accounts and credit cards",
      "Set up income and expense categories",
      "Learn how to track your transactions",
      "Review and complete your setup"
   ]
   
   return (
      <div className="w-full">
         {/* Mobile version (pill style indicator with step name) */}
         <div className="block sm:hidden">
            <div className="bg-gray-100 dark:bg-gray-800 h-3 rounded-full overflow-hidden">
               <motion.div 
                  className="h-full bg-blue-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                  transition={{ duration: 0.5 }}
               />
            </div>
            <div className="mt-4 flex justify-center">
               <motion.div 
                  className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 py-1.5 px-3 rounded-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={currentStep}
               >
                  {stepIcons[currentStep]}
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                     {steps[currentStep]}
                  </span>
                  {currentStep < steps.length - 1 && (
                     <ArrowRightCircle className="h-3.5 w-3.5 text-blue-500 ml-1" />
                  )}
               </motion.div>
            </div>
         </div>
         
         {/* Tablet and above version (numbered steps with labels) */}
         <div className="hidden sm:block">
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
                  <TooltipProvider key={index} delayDuration={300}>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <div className="flex flex-col items-center z-10 relative">
                              {/* Step circle with conditional styling */}
                              <motion.div
                                 className={`w-10 h-10 flex items-center justify-center rounded-full mb-2 shadow-sm border-2
                                    ${index < currentStep 
                                       ? "bg-blue-600 border-blue-600 text-white" 
                                       : index === currentStep 
                                          ? "bg-white dark:bg-gray-800 border-blue-600 text-blue-600 dark:text-blue-400" 
                                          : "bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-300"
                                    }
                                    ${index <= currentStep ? "shadow-[0_0_0_4px_rgba(37,99,235,0.15)]" : ""}
                                    transition-all duration-300 ease-in-out
                                 `}
                                 initial={{ scale: 0.9 }}
                                 animate={{ 
                                    scale: index === currentStep ? 1.05 : 1,
                                    y: index === currentStep ? -2 : 0
                                 }}
                                 transition={{ duration: 0.3 }}
                              >
                                 {index < currentStep ? (
                                    <CheckIcon className="h-5 w-5" />
                                 ) : (
                                    <div className="flex flex-col items-center justify-center">
                                       {stepIcons[index]}
                                    </div>
                                 )}
                                 
                                 {/* Pulse animation for current step */}
                                 {index === currentStep && (
                                    <motion.div
                                       className="absolute inset-0 rounded-full border-2 border-blue-500"
                                       initial={{ opacity: 0, scale: 0.8 }}
                                       animate={{ 
                                          opacity: [0, 0.2, 0], 
                                          scale: [0.8, 1.1, 1.2]
                                       }}
                                       transition={{ 
                                          duration: 2,
                                          repeat: Infinity,
                                          repeatType: "loop"
                                       }}
                                    />
                                 )}
                              </motion.div>
                              
                              {/* Step label */}
                              <span className={`text-xs sm:text-sm text-center max-w-[100px] font-medium
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
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="p-2 text-xs">
                           <p>Step {index + 1}: {step}</p>
                           <p className="text-gray-500 dark:text-gray-400">{stepDescriptions[index]}</p>
                        </TooltipContent>
                     </Tooltip>
                  </TooltipProvider>
               ))}
            </div>
         </div>
      </div>
   )
}

