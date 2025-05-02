"use client"

import { paths } from "@/lib/paths"
import axios from "axios"
import { useSearchParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Clock, Loader2, Mail, RefreshCw } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
const available_types = ["registration"]

const RESEND_SECONDS = 60

export default function VerificationPage() {
   const { t } = useTranslation()
   const searchParams = useSearchParams()
   const router = useRouter()
   const [error, setError] = useState("")
   const type = searchParams.get("type")
   const id = searchParams.get("id")

   const { status, data: session } = useSession()

   useEffect(() => {
      if (status === "authenticated" && session.isValid === true) {
         router.push(paths.dashboard)
      }
   }, [status, session, router])

   const checkValidity = useCallback(async () => {
      setError("")
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
         setError(t("errors.tokenFailed"))
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
   const inputRefs = useRef([])

   // Handle input change for each digit
   const handleInputChange = (index, value) => {
      if (!/^\d*$/.test(value)) return // Only allow digits

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

         router.push(paths.login)
         toast.success(t('verification_code.success'))
      } catch (error) {
         toast.error(t('errors.invalidCode'))
      } finally {
         setIsLoading(false)

      }
   }

   const handleResendCode = async () => {
      setTimeLeft(RESEND_SECONDS)
      setCode(["", "", "", "", "", ""])
      setIsVerified(false)
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

   return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-primary/5 via-background to-muted/10">
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
         >
            <Card className="border border-primary/10 shadow-xl backdrop-blur-sm">
               <CardHeader className="space-y-2 pb-6">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-inner">
                     <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Number.POSITIVE_INFINITY, duration: 3, ease: "easeInOut" }}
                     >
                        <Mail className="h-8 w-8 text-primary" />
                     </motion.div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-center">{t('verification_code.title')}</CardTitle>
                  <CardDescription className="text-center">{t('verification_code.description')}</CardDescription>
               </CardHeader>
               <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-6">
                     <div className="flex justify-center gap-2 py-4">
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
                                 className={`h-14 w-14 text-center text-xl font-semibold transition-all duration-200
                                    ${activeIndex === index ? "ring-2 ring-primary ring-offset-1" : ""}
                                    ${digit ? "border-primary/50 bg-primary/5 text-primary" : ""}
                                    ${isVerified ? "border-green-500 bg-green-50 text-green-600" : ""}
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
                     </div>

                     <AnimatePresence mode="wait">
                        {isVerified ? (
                           <motion.div
                              key="verified"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex flex-col items-center justify-center gap-2 rounded-lg bg-green-50 p-4 text-green-600 shadow-sm"
                           >
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 shadow-inner">
                                 <ShieldCheck className="h-6 w-6" />
                              </div>
                              <p className="font-medium">{t('verification_code.success')}</p>
                              <p className="text-sm text-green-600/80">{t('verification_code.redirect')}</p>
                           </motion.div>
                        ) : (
                           <motion.div
                              key="timer"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="text-center text-sm"
                           >
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
                                 <button
                                    type="button"
                                    className="flex items-center justify-center gap-1.5 text-primary hover:text-primary/80 underline-offset-4 hover:underline transition-colors"
                                    onClick={handleResendCode}
                                 >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    <span>{t('verification_code.resend_code')}</span>
                                 </button>
                              )}
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </CardContent>
                  <CardFooter>
                     <Button
                        type="submit"
                        className={`w-full transition-all duration-300 shadow hover:shadow-md
                        ${isVerified ? "bg-green-500 hover:bg-green-600" : ""}`}
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