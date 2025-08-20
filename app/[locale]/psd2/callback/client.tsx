"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MultiStepLoader } from "@/components/ui/multi-step-loader";
import { motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { Dictionary } from "@/types/dictionary";

export default function Psd2CallbackClient({ locale, dict }: { locale: string, dict: Dictionary }) {
   const router = useRouter();
   const search = useSearchParams();
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [success, setSuccess] = useState(false);


   useEffect(() => {
      const requisitionId = search.get("r") || search.get("ref") || search.get("requisition_id") || search.get("requisitionId");

      if (!requisitionId) {
         setError("Missing requisition ID. The bank connection could not be completed.");
         setLoading(false);
         return;
      }

      // Start the connection process
      const connectBank = async () => {
         try {
            const response = await fetch("/api/bank-link/complete", {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ requisitionId }),
            });

            if (!response.ok) {
               const errorData = await response.json().catch(() => ({}));
               throw new Error(errorData.error || dict?.accounts.psd2.connectionFailed);
            }

            const data = await response.json();
            setSuccess(true);

            // Show success for a moment before redirecting
            setTimeout(() => {
               router.replace(`/${locale}/dashboard/accounts`);
            }, 2000);

         } catch (e: any) {
            console.error("Bank connection error:", e);
            setError(e.message || dict?.accounts.psd2.connectionFailed);
            setLoading(false);
         }
      };

      // Add a small delay to ensure the loading animation is visible
      setTimeout(connectBank, 1000);
   }, [router, search, locale]);

   const handleComplete = () => {
      setLoading(false);
   };

   const goToDashboard = () => {
      router.replace(`/${locale}/dashboard/accounts`);
   };

   const retryConnection = () => {
      setError(null);
      setLoading(true);
      setSuccess(false);
      // Trigger the effect again by refreshing the page
      window.location.reload();
   };

   if (error) {
      return (
         <div className="min-h-screen bg-gradient-to-br from-red-50 via-background to-red-50 dark:from-red-950/20 dark:via-background dark:to-red-950/20 flex items-center justify-center p-4">
            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="max-w-md w-full bg-content1 rounded-2xl shadow-2xl border border-divider p-8 text-center"
            >
               <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center"
               >
                  <Icon icon="mdi:alert-circle" className="w-10 h-10 text-red-500" />
               </motion.div>

               <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-foreground mb-4"
               >
                  {dict?.accounts.psd2.connectionFailed}
               </motion.h1>

               <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-default-600 mb-6"
               >
                  {error}
               </motion.p>

               <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col sm:flex-row gap-3"
               >
                  <Button
                     onPress={retryConnection}
                     color="primary"
                     variant="solid"
                     className="flex-1"
                     startContent={<Icon icon="mdi:refresh" />}
                  >
                     {dict?.accounts.psd2.tryAgain}
                  </Button>
                  <Button
                     onPress={goToDashboard}
                     color="default"
                     variant="bordered"
                     className="flex-1"
                     startContent={<Icon icon="mdi:arrow-left" />}
                  >
                     {dict?.accounts.psd2.backToAccounts}
                  </Button>
               </motion.div>
            </motion.div>
         </div>
      );
   }

   if (success) {
      return (
         <div className="min-h-screen bg-gradient-to-br from-green-50 via-background to-green-50 dark:from-green-950/20 dark:via-background dark:to-green-950/20 flex items-center justify-center p-4">
            <motion.div
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="max-w-md w-full bg-content1 rounded-2xl shadow-2xl border border-divider p-8 text-center"
            >
               <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
               >
                  <Icon icon="mdi:check-circle" className="w-10 h-10 text-green-500" />
               </motion.div>

               <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-foreground mb-4"
               >
                  {dict?.accounts.psd2.success} 🎉
               </motion.h1>

               <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-default-600 mb-6"
               >
                  {dict?.accounts.psd2.successDescription}
               </motion.p>

               <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
               >
                  <Button
                     onPress={goToDashboard}
                     color="primary"
                     variant="solid"
                     className="w-full"
                     startContent={<Icon icon="mdi:arrow-right" />}
                  >
                     {dict?.accounts.psd2.goToAccounts}
                  </Button>
               </motion.div>
            </motion.div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-gradient-to-br from-primary via-background to-secondary dark:from-primary-950/20 dark:via-background dark:to-secondary-950/20">
         <MultiStepLoader
            loadingStates={dict?.accounts.psd2.steps}
            loading={loading}
            duration={1200}
            loop={true}
            onComplete={handleComplete}
         />
      </div>
   );
}
