"use client"

import { motion } from "framer-motion"
import { CheckIcon } from "lucide-react"

export function StepIndicator({ steps, currentStep }) {
   return (
      <div className="flex justify-between items-center w-full">
         {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
               <div className="flex items-center w-full">
                  {/* Line before circle */}
                  {index > 0 && (
                     <motion.div
                        className="flex-1 h-1 bg-gray-200"
                        initial={{ backgroundColor: "#e5e7eb" }}
                        animate={{
                           backgroundColor: index <= currentStep ? "#10b981" : "#e5e7eb",
                        }}
                        transition={{ duration: 0.5 }}
                     />
                  )}

                  {/* Circle */}
                  <motion.div
                     className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium border-2 ${index < currentStep
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : index === currentStep
                           ? "bg-white border-emerald-500 text-emerald-500"
                           : "bg-white border-gray-200 text-gray-400"
                        }`}
                     initial={false}
                     animate={{
                        borderColor: index <= currentStep ? "#10b981" : "#e5e7eb",
                        backgroundColor: index < currentStep ? "#10b981" : "#ffffff",
                     }}
                     transition={{ duration: 0.3 }}
                  >
                     {index < currentStep ? <CheckIcon className="w-4 h-4" /> : <span>{index + 1}</span>}
                  </motion.div>

                  {/* Line after circle */}
                  {index < steps.length - 1 && (
                     <motion.div
                        className="flex-1 h-1 bg-gray-200"
                        initial={{ backgroundColor: "#e5e7eb" }}
                        animate={{
                           backgroundColor: index < currentStep ? "#10b981" : "#e5e7eb",
                        }}
                        transition={{ duration: 0.5 }}
                     />
                  )}
               </div>

               {/* Step label */}
               <motion.span
                  className="text-xs mt-2"
                  initial={{ color: "#6b7280" }}
                  animate={{
                     color: index === currentStep ? "#10b981" : "#6b7280",
                     fontWeight: index === currentStep ? 500 : 400,
                  }}
                  transition={{ duration: 0.3 }}
               >
                  {step}
               </motion.span>
            </div>
         ))}
      </div>
   )
}

