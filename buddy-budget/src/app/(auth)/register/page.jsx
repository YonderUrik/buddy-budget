"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { paths } from "@/lib/paths"
import { config } from "@/lib/config"
import { Check, X, Eye, EyeOff } from "lucide-react"
import { useSession } from "next-auth/react"
import { registerUser } from "@/lib/client/auth"
import { LogoHorizontal } from "@/components/logo/logo-horizontal"

export default function RegisterPage() {
   const { t } = useTranslation()
   const router = useRouter()
   const { status, data: session } = useSession()
   const [name, setName] = useState("")
   const [email, setEmail] = useState("")
   const [password, setPassword] = useState("")
   const [confirmPassword, setConfirmPassword] = useState("")
   const [showPassword, setShowPassword] = useState(false)
   const [showConfirmPassword, setShowConfirmPassword] = useState(false)
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState(null)
   const [validationErrors, setValidationErrors] = useState({})
   const [passwordStrength, setPasswordStrength] = useState(0)
   const [strengthText, setStrengthText] = useState("")
   const [strengthColor, setStrengthColor] = useState("red")
   const [passwordCriteria, setPasswordCriteria] = useState({
      length: false,
      lowercase: false,
      uppercase: false,
      special: false
   })

   // Redirect if already logged in
   useEffect(() => {
      if (status === "authenticated" && session.isValid === true) {
         router.push(paths.dashboard)
      }
   }, [status, session, router])

   useEffect(() => {
      if (!password) {
         setPasswordStrength(0)
         setStrengthText("")
         setStrengthColor("red")
         setPasswordCriteria({
            length: false,
            lowercase: false,
            uppercase: false,
            special: false
         })
         return
      }

      // Check password criteria
      const criteria = {
         length: password.length >= 8,
         lowercase: /[a-z]/.test(password),
         uppercase: /[A-Z]/.test(password),
         special: /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
      }

      setPasswordCriteria(criteria)

      // Calculate password strength
      let strength = 0

      // Add 25% for each criterion met
      if (criteria.length) strength += 25
      if (criteria.lowercase) strength += 25
      if (criteria.uppercase) strength += 25
      if (criteria.special) strength += 25

      setPasswordStrength(strength)

      // Set text and color based on strength
      if (strength <= 25) {
         setStrengthText(t("auth.passwordWeak"))
         setStrengthColor("red")
      } else if (strength <= 50) {
         setStrengthText(t("auth.passwordFair"))
         setStrengthColor("orange")
      } else if (strength <= 75) {
         setStrengthText(t("auth.passwordGood"))
         setStrengthColor("yellow")
      } else {
         setStrengthText(t("auth.passwordStrong"))
         setStrengthColor("green")
      }
   }, [password, t])

   const validateForm = () => {
      const errors = {}

      if (!name) errors.name = t("auth.nameRequired")
      if (!email) errors.email = t("auth.emailRequired")
      if (!/\S+@\S+\.\S+/.test(email)) errors.email = t("auth.validEmail")
      if (!password) errors.password = t("auth.passwordRequired")
      if (password !== confirmPassword) errors.confirmPassword = t("auth.passwordsDoNotMatch")
      if (!passwordCriteria.length) errors.password = t("auth.criteriaLength")
      if (!passwordCriteria.lowercase) errors.password = t("auth.criteriaLowercase")
      if (!passwordCriteria.uppercase) errors.password = t("auth.criteriaUppercase")
      if (!passwordCriteria.special) errors.password = t("auth.criteriaSpecial")

      setValidationErrors(errors)
      return Object.keys(errors).length === 0
   }

   const handleSubmit = async (e) => {
      e.preventDefault()

      if (!validateForm()) return

      setLoading(true)
      setError(null)

      try {
         const result = await registerUser(name, email, password)
         if (result.success) {
            router.push(paths.verifyCode(result.type, result.userId))
         } else {
            setError(result.message)
         }
      } catch (err) {
         setError("errors.unexpectedError")
      } finally {
         setLoading(false)
      }
   }

   return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
         <Card className="w-full max-w-md">
            <CardHeader>
               <div className="flex justify-center mb-2">
                  <LogoHorizontal />
               </div>
            </CardHeader>
            <CardContent>
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                     <Label htmlFor="name">{t("common.name")}</Label>
                     <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
                     {validationErrors.name && <p className="text-destructive text-sm">{validationErrors.name}</p>}
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="email">{t("common.email")}</Label>
                     <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                     />
                     {validationErrors.email && <p className="text-destructive text-sm">{validationErrors.email}</p>}
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="password">{t("common.password")}</Label>
                     <div className="relative">
                        <Input 
                           id="password" 
                           type={showPassword ? "text" : "password"} 
                           value={password} 
                           onChange={(e) => setPassword(e.target.value)} 
                        />
                        <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           className="absolute right-0 top-0 h-full px-3"
                           onClick={() => setShowPassword(!showPassword)}
                        >
                           {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                     </div>
                     <div className="mt-2 space-y-3">
                        <div className="space-y-1">
                           <p className={`text-sm text-${strengthColor}-500`}>{strengthText}</p>
                        </div>

                        <div className="space-y-1 text-sm">
                           <div className="flex items-center gap-2">
                              {passwordCriteria.length ? (
                                 <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                 <X className="h-4 w-4 text-red-500" />
                              )}
                              <span>{t("auth.criteriaLength")}</span>
                           </div>

                           <div className="flex items-center gap-2">
                              {passwordCriteria.lowercase ? (
                                 <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                 <X className="h-4 w-4 text-red-500" />
                              )}
                              <span>{t("auth.criteriaLowercase")}</span>
                           </div>

                           <div className="flex items-center gap-2">
                              {passwordCriteria.uppercase ? (
                                 <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                 <X className="h-4 w-4 text-red-500" />
                              )}
                              <span>{t("auth.criteriaUppercase")}</span>
                           </div>

                           <div className="flex items-center gap-2">
                              {passwordCriteria.special ? (
                                 <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                 <X className="h-4 w-4 text-red-500" />
                              )}
                              <span>{t("auth.criteriaSpecial")}</span>
                           </div>
                        </div>
                     </div>
                     {validationErrors.password && <p className="text-destructive text-sm">{validationErrors.password}</p>}
                  </div>

                  <div className="space-y-2">
                     <Label htmlFor="confirmPassword">{t("common.confirmPassword")}</Label>
                     <div className="relative">
                        <Input
                           id="confirmPassword"
                           type={showConfirmPassword ? "text" : "password"}
                           value={confirmPassword}
                           onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <Button
                           type="button"
                           variant="ghost"
                           size="sm"
                           className="absolute right-0 top-0 h-full px-3"
                           onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                           {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                     </div>
                     {validationErrors.confirmPassword && (
                        <p className="text-destructive text-sm">{validationErrors.confirmPassword}</p>
                     )}
                  </div>

                  {error && <p className="text-destructive text-sm">{t(`${error}`)}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                     {loading ? t("common.loading") : t("common.register")}
                  </Button>
               </form>
            </CardContent>
            <CardFooter className="flex justify-center">
               <p className="text-sm text-muted-foreground">
                  {t("common.hasAccount")}{" "}
                  <Link href={paths.login} className="text-primary hover:underline">
                     {t("common.signIn")}
                  </Link>
               </p>
            </CardFooter>
         </Card>
      </div>
   )
}
