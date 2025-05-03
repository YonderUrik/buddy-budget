"use client"

import { paths } from "@/lib/paths"
import axios from "axios"
import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Check, Clock, Loader2, Mail, RefreshCw, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const available_types = ["registration"]

const RESEND_SECONDS = 60

export default function VerificationPage() {
   const { t } = useTranslation()
   const searchParams = useSearchParams()
   const router = useRouter()
   const type = searchParams.get("type")
   const id = searchParams.get("id")

   const checkValidity = useCallback(async () => {
      if (!type || !id) {
         router.push(paths.root)
      }

      try {
         const response = await axios.get(`/api/check-code-validity?type=${type}&id=${id}`)

         const { data } = response

         if (!data?.isValid) {
            router.push(paths.root)
         }
      } catch (error) {
         toast.error(t("errors.tokenFailed"))
      }
   }, [type, id])

   useEffect(() => {
      checkValidity()
   }, [checkValidity])

   useEffect(() => {
      if (!type || !available_types.includes(type)) {
         router.push(paths.root)
      }
   }, [type])

   const [code, setCode] = useState(["", "", "", "", "", ""])
   const [isLoading, setIsLoading] = useState(false)
   const [isVerified, setIsVerified] = useState(false)
   const [timeLeft, setTimeLeft] = useState(RESEND_SECONDS)
   const [activeIndex, setActiveIndex] = useState(0)
   const [error, setError] = useState(false)
   const inputRefs = useRef([])

   // Handle input change for each digit
   const handleInputChange = (index, value) => {
      if (!/^\d*$/.test(value)) return // Only allow digits
      setError(false) // Clear error state when user types

      const newCode = [...code]
      newCode[index] = value.slice(-1) // Only take the last character if multiple are pasted
      setCode(newCode)

      // Auto-focus next input
      if (value && index < 5) {
         inputRefs.current[index + 1]?.focus()
         setActiveIndex(index + 1)
      }
   }

   // Handle key down for backspace navigation
   const handleKeyDown = (index, e) => {
      if (e.key === "Backspace" && !code[index] && index > 0) {
         inputRefs.current[index - 1]?.focus()
         setActiveIndex(index - 1)
      } else if (e.key === "ArrowLeft" && index > 0) {
         inputRefs.current[index - 1]?.focus()
         setActiveIndex(index - 1)
      } else if (e.key === "ArrowRight" && index < 5) {
         inputRefs.current[index + 1]?.focus()
         setActiveIndex(index + 1)
      }
   }

   const handleSubmit = async (e) => {
      e.preventDefault()

      const fullCode = code.join("")
      if (fullCode.length !== 6) {
         toast.error(t('errors.invalidCode'))
         setError(true)
         return
      }
      try {
         setIsLoading(true)
         const response = await axios.post('/api/verify-code', {
            type,
            id,
            code: fullCode
         })
         setIsVerified(true)

         // Add a small delay before redirecting for better UX
         setTimeout(() => {
           router.push(paths.login)
           toast.success(t('verification_code.success'))
         }, 1200)
      } catch (error) {
         toast.error(t('errors.invalidCode'))
         setError(true)
         // Shake animation effect for error
         const inputs = inputRefs.current
         inputs.forEach(input => {
            input.classList.add('animate-shake')
            setTimeout(() => input.classList.remove('animate-shake'), 500)
         })
      } finally {
         setIsLoading(false)
      }
   }

   const handleResendCode = async () => {
      setTimeLeft(RESEND_SECONDS)
      setCode(["", "", "", "", "", ""])
      setIsVerified(false)
      setError(false)
      inputRefs.current[0]?.focus()
      setActiveIndex(0)

      try {
         const response = await axios.post(
            '/api/resend-code', { type, id }
         )
         toast.success(t('verification_code.newCodeSent'))
      } catch (error) {
         toast.error(t('errors.resendCodeFailed'))
      }
   }

   // Handle paste event
   const handlePaste = (e) => {
      e.preventDefault()
      const pastedData = e.clipboardData.getData("text/plain").trim()
      if (!/^\d+$/.test(pastedData)) return // Only allow digits
      setError(false) // Clear error state on paste

      const digits = pastedData.split("").slice(0, 6)
      const newCode = [...code]

      digits.forEach((digit, index) => {
         if (index < 6) newCode[index] = digit
      })

      setCode(newCode)

      // Focus the next empty input or the last one
      const nextEmptyIndex = newCode.findIndex((digit) => !digit)
      if (nextEmptyIndex !== -1) {
         inputRefs.current[nextEmptyIndex]?.focus()
         setActiveIndex(nextEmptyIndex)
      } else {
         inputRefs.current[5]?.focus()
         setActiveIndex(5)
      }
   }

   // Countdown timer
   useEffect(() => {
      if (timeLeft <= 0) return

      const interval = setInterval(() => {
         setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1))
      }, 1000)

      return () => clearInterval(interval)
   }, [timeLeft])

   // Go back to login
   const handleGoBack = () => {
      router.push(paths.login)
   }

   return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-primary/10 via-background to-muted/20">
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
         >
            <Card className="border border-primary/10 shadow-xl backdrop-blur-sm overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
               
               <CardHeader className="space-y-2 pb-6 relative">
                  <Button 
                     variant="ghost" 
                     size="icon" 
                     className="absolute left-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
                     onClick={handleGoBack}
                  >
                     <ArrowLeft className="h-5 w-5" />
                  </Button>
                  
                  <div className="mx-auto mt-8 mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 shadow-inner">
                     <motion.div
                        animate={{ 
                           scale: [1, 1.1, 1],
                           rotateZ: [0, 10, -10, 0]
                        }}
                        transition={{ 
                           repeat: Number.POSITIVE_INFINITY, 
                           duration: 5, 
                           ease: "easeInOut" 
                        }}
                     >
                        <Mail className="h-10 w-10 text-primary" />
                     </motion.div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                     {t('verification_code.title')}
                  </CardTitle>
                  <CardDescription className="text-center max-w-xs mx-auto">
                     {t('verification_code.description')}
                  </CardDescription>
               </CardHeader>
               
               <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-6">
                     <motion.div 
                        className="flex justify-center gap-2 sm:gap-3 py-4"
                        variants={{
                           error: {
                              x: [0, -10, 10, -10, 10, 0],
                              transition: { duration: 0.5 }
                           },
                           normal: { x: 0 }
                        }}
                        animate={error ? "error" : "normal"}
                     >
                        {code.map((digit, index) => (
                           <motion.div
                              key={index}
                              whileTap={{ scale: 0.95 }}
                              className="relative"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                           >
                              <Input
                                 ref={(el) => (inputRefs.current[index] = el)}
                                 type="text"
                                 inputMode="numeric"
                                 pattern="[0-9]*"
                                 maxLength={1}
                                 className={`h-14 w-12 sm:h-16 sm:w-14 text-center text-xl font-semibold transition-all duration-200
                                    ${activeIndex === index ? "ring-2 ring-primary ring-offset-2" : ""}
                                    ${digit ? "border-primary/50 bg-primary/5 text-primary" : ""}
                                    ${isVerified ? "border-green-500 bg-green-50 text-green-600" : ""}
                                    ${error ? "border-red-500 bg-red-50/30 text-red-600" : ""}
                                    shadow-sm hover:shadow focus:shadow-md
                                 `}
                                 value={digit}
                                 onChange={(e) => handleInputChange(index, e.target.value)}
                                 onKeyDown={(e) => handleKeyDown(index, e)}
                                 onFocus={() => setActiveIndex(index)}
                                 onPaste={index === 0 ? handlePaste : undefined}
                                 disabled={isLoading || isVerified}
                                 autoFocus={index === 0}
                              />
                              {isVerified && (
                                 <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white shadow-md"
                                 >
                                    <Check className="h-3 w-3" />
                                 </motion.div>
                              )}
                           </motion.div>
                        ))}
                     </motion.div>

                     <AnimatePresence mode="wait">
                        {isVerified ? (
                           <motion.div
                              key="verified"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex flex-col items-center justify-center gap-2 rounded-lg bg-green-50 p-4 text-green-600 shadow-sm"
                           >
                              <motion.div 
                                 className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 shadow-inner"
                                 animate={{ 
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, 0]
                                 }}
                                 transition={{ duration: 0.8, repeat: 1 }}
                              >
                                 <ShieldCheck className="h-7 w-7" />
                              </motion.div>
                              <p className="font-medium text-lg">{t('verification_code.success')}</p>
                              <p className="text-sm text-green-600/80 text-center">{t('verification_code.redirect')}</p>
                           </motion.div>
                        ) : (
                           <motion.div
                              key="timer"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="text-center"
                           >
                              {error && (
                                 <motion.p 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="text-sm text-red-500 mb-3 font-medium"
                                 >
                                    {t('errors.invalidCode')}
                                 </motion.p>
                              )}
                              {timeLeft > 0 ? (
                                 <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                    <motion.div
                                       animate={{ rotate: 360 }}
                                       transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4, ease: "linear" }}
                                    >
                                       <Clock className="h-4 w-4" />
                                    </motion.div>
                                    <span>
                                       {t('verification_code.resend_code_in')} <span className="font-medium text-primary">{timeLeft}</span> {t('common.seconds')}
                                    </span>
                                 </div>
                              ) : (
                                 <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-md bg-primary/5 hover:bg-primary/10 text-primary transition-colors"
                                    onClick={handleResendCode}
                                 >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>{t('verification_code.resend_code')}</span>
                                 </motion.button>
                              )}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </CardContent>
                  <CardFooter className="pb-6 px-6">
                     <Button
                        type="submit"
                        className={`w-full transition-all duration-300 shadow-md hover:shadow-lg ${
                           error ? "bg-red-500 hover:bg-red-600" : 
                           isVerified ? "bg-green-500 hover:bg-green-600" : ""
                        }`}
                        disabled={code.join("").length !== 6 || isLoading || isVerified}
                     >
                        {isLoading ? (
                           <motion.div
                              className="flex items-center justify-center gap-2"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                           >
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>{t('verification_code.verifying')}</span>
                           </motion.div>
                        ) : isVerified ? (
                           <motion.div
                              className="flex items-center justify-center gap-2"
                              initial={{ scale: 0.9 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200 }}
                           >
                              <Check className="h-4 w-4" />
                              <span>{t('verification_code.verified')}</span>
                           </motion.div>
                        ) : (
                           t('verification_code.verify')
                        )}
                     </Button>
                  </CardFooter>
               </form>
            </Card>
         </motion.div>
      </div>
   )
}