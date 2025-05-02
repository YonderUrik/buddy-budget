"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { paths } from "@/lib/paths"
import axios from "axios"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function ForgotPasswordPage() {
   const [email, setEmail] = useState("")
   const { t } = useTranslation()
   const [isLoading, setIsLoading] = useState(false)
   const [isSuccess, setIsSuccess] = useState(false)
   

   const handleSubmit = async (e) => {
      e.preventDefault()

      if (!email) {
         toast.error(t('errors.emptyEmail'))
         return
      }

      setIsLoading(true)

      try {
         await axios.post('/api/auth/forgot-password', { email })
         setIsSuccess(true)
      } catch (error) {
         toast.error(t('errors.internalServerError'))
      } finally {
         setIsLoading(false)
      }
   }

   return <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_50%,rgba(var(--primary-rgb),0.12),transparent)]" />
      <Card className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
         <CardHeader>
            <CardTitle className="text-2xl font-semibold text-center">{t("common.forgotPassword")}</CardTitle>
            <CardDescription className="text-center">{t('forgotPassword.description')}</CardDescription>
         </CardHeader>
         <CardContent>
            {!isSuccess ? (
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="email">{t("common.email")}</Label>
                     <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        className="transition-all focus-visible:ring-primary"
                     />
                  </div>
                  <Button
                     type="submit"
                     className="w-full transition-all hover:shadow-md relative"
                     disabled={isLoading}
                  >
                     <span className={isLoading ? "opacity-0" : "opacity-100"}>
                        {t('forgotPassword.send')}
                     </span>
                     {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                           <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                        </div>
                     )}
                  </Button>
               </form>
            ) : (
               <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="rounded-md bg-primary/10 p-4">
                     <div className="flex">
                        <div className="flex-shrink-0">
                           <svg className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                 fillRule="evenodd"
                                 d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                 clipRule="evenodd"
                              />
                           </svg>
                        </div>
                        <div className="ml-3">
                           <p className="text-sm font-medium">{t('forgotPassword.linkSent')}</p>
                        </div>
                     </div>
                  </div>
               </div>
            )}
         </CardContent>
         <CardFooter className="flex justify-center border-t pt-4">
            <Link
               href={paths.login}
               className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
               <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
               {t('common.backToSignIn')}
            </Link>
         </CardFooter>
      </Card>
   </div>
}