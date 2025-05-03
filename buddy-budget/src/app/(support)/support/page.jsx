"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChevronLeft, CheckCircle2, AlertCircle, Mail, HelpCircle, LifeBuoy, MessagesSquare, Info, MessageCircle, BookOpen, ArrowRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { config } from "@/lib/config"
import { ModeToggle } from "@/components/theme-toggle"
import { z } from "zod"
import axios from "axios"
import { paths } from "@/lib/paths"
import { LogoHorizontal } from "@/components/logo/logo-horizontal"
import { motion } from "framer-motion"

export default function SupportPage() {
   const { t } = useTranslation()
   const [activeTab, setActiveTab] = useState("contact")
   const [email, setEmail] = useState("")
   const [subject, setSubject] = useState("")
   const [message, setMessage] = useState("")
   const [category, setCategory] = useState("")
   const [isSubmitting, setIsSubmitting] = useState(false)
   const [isSubmitted, setIsSubmitted] = useState(false)
   const [error, setError] = useState(null)
   const [formErrors, setFormErrors] = useState({})
   const [mounted, setMounted] = useState(false)

   useEffect(() => {
      setMounted(true)
   }, [])

   // Form validation schema with translated error messages
   const contactFormSchema = z.object({
      email: z.string().email({ message: t("validation.invalidEmail", "Please enter a valid email address") }),
      subject: z.string().min(3, { message: t("validation.subjectTooShort", "Subject must be at least 3 characters") }),
      category: z.string().min(1, { message: t("validation.categoryRequired", "Please select a category") }),
      message: z.string().min(10, { message: t("validation.messageTooShort", "Message must be at least 10 characters") })
   })

   const handleSubmit = async (e) => {
      e.preventDefault()
      setIsSubmitted(false)
      setIsSubmitting(true)
      setError(null)
      setFormErrors({})

      try {
         // Validate form data using Zod
         const formData = { email, subject, category, message }
         const validatedData = contactFormSchema.parse(formData)

         // Make API call using axios
         await axios.post('/api/support/contact', validatedData)

         // Set submission success
         setIsSubmitted(true)

         // Reset form
         setEmail("")
         setSubject("")
         setCategory("")
         setMessage("")
      } catch (err) {
         if (err instanceof z.ZodError) {
            // Handle validation errors
            const errors = {}
            err.errors.forEach((error) => {
               errors[error.path[0]] = error.message
            })
            setFormErrors(errors)
         } else if (axios.isAxiosError(err)) {
            // Handle API errors
            setError(err.response?.data?.message || t("errors.failedSubmission", "Failed to send message. Please try again."))
         } else {
            // Handle other errors
            setError(t("errors.unexpectedError", "An unexpected error occurred. Please try again."))
         }
      } finally {
         setIsSubmitting(false)
      }
   }

   const fadeInVariants = {
      hidden: { opacity: 0, y: 10 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
   }

   return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
         <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10 shadow-sm w-full">
            <div className="container flex h-16 items-center justify-between px-4 md:px-6">
               <Link href={paths.root} className="transition-transform hover:scale-105">
                  <LogoHorizontal />
               </Link>
               <div className="ml-auto">
                  <ModeToggle />
               </div>
            </div>
         </header>

         <main className="container mx-auto flex flex-col items-center justify-center py-10 px-4 md:px-6 flex-1">
            <div className="flex items-center mb-8 w-full max-w-6xl mx-auto">
               <Button variant="ghost" size="sm" asChild className="mr-2 transition-all hover:bg-muted hover:shadow-sm group">
                  <Link href={paths.root}>
                     <ChevronLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                     {t("common.back")}
                  </Link>
               </Button>
            </div>

            <div className="max-w-6xl mx-auto w-full">
               <motion.h1
                  initial="hidden"
                  animate={mounted ? "visible" : "hidden"}
                  variants={fadeInVariants}
                  className="text-3xl md:text-4xl font-bold mb-8 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent flex items-center"
               >
                  <LifeBuoy className="mr-3 h-8 w-8 text-primary" />
                  {t("support.title")}
               </motion.h1>

               <motion.div
                  initial="hidden"
                  animate={mounted ? "visible" : "hidden"}
                  variants={fadeInVariants}
                  className="mb-6 text-muted-foreground"
               >
                  <p>
                     {t("support.pageDescription", "We're here to help. Choose how you'd like to get support.")}
                  </p>
               </motion.div>

               <motion.div
                  initial="hidden"
                  animate={mounted ? "visible" : "hidden"}
                  variants={fadeInVariants}
               >
                  <Card className="border rounded-lg shadow-lg overflow-hidden">
                     <CardContent className="p-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                           {/* TABS */}
                           <div className="flex justify-center pt-6 px-6">
                              <TabsList className="inline-flex mb-6 bg-muted/40 p-1 rounded-lg">
                                 <TabsTrigger value="contact" className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    <MessageCircle className="h-4 w-4" />
                                    {t("support.contactUs")}
                                 </TabsTrigger>
                                 <TabsTrigger value="faq" className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    <Info className="h-4 w-4" />
                                    {t("support.faq")}
                                 </TabsTrigger>
                                 <TabsTrigger value="help" className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                                    <BookOpen className="h-4 w-4" />
                                    {t("support.helpCenter")}
                                 </TabsTrigger>
                              </TabsList>
                           </div>

                           {/* CONTACT TAB */}
                           <TabsContent value="contact" className="px-6 pb-6">
                              <Card className="bg-background/80 shadow-sm border-0">
                                 <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center text-2xl">
                                       <Mail className="h-5 w-5 mr-2 text-primary" />
                                       {t("support.contactForm")}
                                    </CardTitle>
                                    <CardDescription>
                                       {t("support.contactFormDesc")}
                                    </CardDescription>
                                 </CardHeader>
                                 <CardContent>
                                    {isSubmitted && (
                                       <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 mb-6">
                                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                          <AlertDescription className="text-green-800 dark:text-green-400">
                                             {t("support.messageSent")}
                                          </AlertDescription>
                                       </Alert>
                                    )}
                                    <form onSubmit={handleSubmit} className="space-y-5">
                                       <div className="gap-4">
                                          <div className="space-y-2">
                                             <Label htmlFor="email" className="text-sm font-medium">{t("common.email")}</Label>
                                             <Input
                                                id="email"
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                                placeholder="your.email@example.com"
                                                className={`h-10 ${formErrors.email ? "border-red-300 dark:border-red-800" : ""}`}
                                             />
                                             {formErrors.email && (
                                                <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                                             )}
                                          </div>
                                       </div>

                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                          <div className="space-y-2">
                                             <Label htmlFor="subject" className="text-sm font-medium">{t("support.subject")}</Label>
                                             <Input
                                                id="subject"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                required
                                                placeholder={t("support.subjectPlaceholder", "Brief description of your inquiry")}
                                                className={`h-10 ${formErrors.subject ? "border-red-300 dark:border-red-800" : ""}`}
                                             />
                                             {formErrors.subject && (
                                                <p className="text-red-500 text-sm mt-1">{formErrors.subject}</p>
                                             )}
                                          </div>
                                          <div className="space-y-2">
                                             <Label htmlFor="category" className="text-sm font-medium">{t("support.category")}</Label>
                                             <Select value={category} onValueChange={setCategory} required>
                                                <SelectTrigger id="category" className={`h-10 ${formErrors.category ? "border-red-300 dark:border-red-800" : ""}`}>
                                                   <SelectValue placeholder={t("support.selectCategory")} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   <SelectItem value="account">{t("support.accountIssue")}</SelectItem>
                                                   <SelectItem value="billing">{t("support.billingIssue")}</SelectItem>
                                                   <SelectItem value="technical">
                                                      {t("support.technicalIssue")}
                                                   </SelectItem>
                                                   <SelectItem value="feature">{t("support.featureRequest")}</SelectItem>
                                                   <SelectItem value="other">{t("support.other")}</SelectItem>
                                                </SelectContent>
                                             </Select>
                                             {formErrors.category && (
                                                <p className="text-red-500 text-sm mt-1">{formErrors.category}</p>
                                             )}
                                          </div>
                                       </div>

                                       <div className="space-y-2">
                                          <Label htmlFor="message" className="text-sm font-medium">{t("support.message")}</Label>
                                          <Textarea
                                             id="message"
                                             value={message}
                                             onChange={(e) => setMessage(e.target.value)}
                                             rows={5}
                                             required
                                             placeholder={t("support.messagePlaceholder", "Please describe your issue or question in detail...")}
                                             className={`resize-none ${formErrors.message ? "border-red-300 dark:border-red-800" : ""}`}
                                          />
                                          {formErrors.message && (
                                             <p className="text-red-500 text-sm mt-1">{formErrors.message}</p>
                                          )}
                                       </div>

                                       {error && (
                                          <Alert variant="destructive">
                                             <AlertCircle className="h-4 w-4" />
                                             <AlertDescription>{error}</AlertDescription>
                                          </Alert>
                                       )}

                                       <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                                          {isSubmitting ? t("common.loading") : t("support.sendMessage")}
                                       </Button>
                                    </form>
                                 </CardContent>
                              </Card>
                           </TabsContent>

                           {/* FAQ TAB */}
                           <TabsContent value="faq" className="px-6 pb-6">
                              <div className="bg-background/80 shadow-sm rounded-lg p-6 border">
                                 <div className="mb-6 flex items-start">
                                    <HelpCircle className="h-6 w-6 mr-3 text-primary mt-1" />
                                    <div>
                                       <h2 className="text-2xl font-semibold mb-2 text-foreground">{t("support.frequentlyAskedQuestions")}</h2>
                                       <p className="text-muted-foreground">
                                          {t("support.faqDesc", { appName: config.appName })}
                                       </p>
                                    </div>
                                 </div>

                                 <Accordion type="single" collapsible className="w-full">
                                    {[...Array(5)].map((_, i) => (
                                       <AccordionItem
                                          key={`item-${i}`}
                                          value={`item-${i}`}
                                          className="border-b border-muted last:border-0"
                                       >
                                          <AccordionTrigger className="py-4 text-left hover:no-underline hover:text-primary">
                                             {t(`support.faq${i + 1}`, { appName: config.appName })}
                                          </AccordionTrigger>
                                          <AccordionContent className="text-muted-foreground pb-4 pt-1">
                                             {t(`support.faq${i + 1}Answer`, { appName: config.appName })}
                                          </AccordionContent>
                                       </AccordionItem>
                                    ))}
                                 </Accordion>

                                 <div className="mt-8 pt-6 border-t border-muted flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-sm text-muted-foreground">
                                       {t("support.cantFindHelp", "Can't find what you're looking for?")}
                                    </p>
                                    <Button
                                       onClick={() => setActiveTab("contact")}
                                       variant="outline"
                                       className="group"
                                    >
                                       {t("support.contactSupport", "Contact our support team")}
                                       <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                 </div>
                              </div>
                           </TabsContent>

                           {/* HELP CENTER TAB */}
                           <TabsContent value="help" className="px-6 pb-6">
                              <div className="bg-background/80 shadow-sm rounded-lg p-6 border">
                                 <div className="mb-6 flex items-start">
                                    <BookOpen className="h-6 w-6 mr-3 text-primary mt-1" />
                                    <div>
                                       <h2 className="text-2xl font-semibold mb-2 text-foreground">{t("support.helpCenter", "Help Center")}</h2>
                                       <p className="text-muted-foreground">
                                          {t("support.helpCenterDesc", "Browse our help articles to learn more about BuddyBudget.")}
                                       </p>
                                    </div>
                                 </div>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* <Card className="bg-muted/30 border shadow-sm hover:shadow-md transition-all hover:bg-muted/50">
                                       <CardHeader className="pb-2">
                                          <CardTitle className="text-lg text-primary font-semibold">{t("support.gettingStarted", "Getting Started")}</CardTitle>
                                       </CardHeader>
                                       <CardContent>
                                          <ul className="space-y-3">
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article1", "Setting up your account")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article2", "Adding your first account")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article3", "Creating categories")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article4", "Recording transactions")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                          </ul>
                                       </CardContent>
                                    </Card> */}

                                    {/* <Card className="bg-muted/30 border shadow-sm hover:shadow-md transition-all hover:bg-muted/50">
                                       <CardHeader className="pb-2">
                                          <CardTitle className="text-lg text-primary font-semibold">{t("support.budgeting", "Budgeting")}</CardTitle>
                                       </CardHeader>
                                       <CardContent>
                                          <ul className="space-y-3">
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article5", "Creating a budget")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article6", "Setting budget goals")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article7", "Tracking budget progress")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article8", "Budget reports")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                          </ul>
                                       </CardContent>
                                    </Card> */}

                                    {/* <Card className="bg-muted/30 border shadow-sm hover:shadow-md transition-all hover:bg-muted/50">
                                       <CardHeader className="pb-2">
                                          <CardTitle className="text-lg text-primary font-semibold">{t("support.accountManagement", "Account Management")}</CardTitle>
                                       </CardHeader>
                                       <CardContent>
                                          <ul className="space-y-3">
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article9", "Managing multiple accounts")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article10", "Reconciling accounts")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article11", "Handling transfers")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article12", "Account balances")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                          </ul>
                                       </CardContent>
                                    </Card> */}

                                    {/* <Card className="bg-muted/30 border shadow-sm hover:shadow-md transition-all hover:bg-muted/50">
                                       <CardHeader className="pb-2">
                                          <CardTitle className="text-lg text-primary font-semibold">{t("support.reporting", "Reporting")}</CardTitle>
                                       </CardHeader>
                                       <CardContent>
                                          <ul className="space-y-3">
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article13", "Generating reports")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article14", "Understanding net worth")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article15", "Expense analysis")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                             <li>
                                                <Link href="#" className="text-foreground hover:text-primary flex items-center group">
                                                   <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary"></span>
                                                   {t("support.article16", "Exporting data")}
                                                   <ArrowRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                                </Link>
                                             </li>
                                          </ul>
                                       </CardContent>
                                    </Card> */}
                                 </div>
                                 <div className="mt-8 pt-6 border-t border-muted flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-sm text-muted-foreground">
                                       {t("support.cantFindHelp", "Can't find what you're looking for?")}
                                    </p>
                                    <Button
                                       onClick={() => setActiveTab("contact")}
                                       variant="outline"
                                       className="group"
                                    >
                                       {t("support.contactSupport", "Contact our support team")}
                                       <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                 </div>
                              </div>
                           </TabsContent>
                        </Tabs>
                     </CardContent>
                  </Card>
               </motion.div>
            </div>
         </main>
      </div>
   )
}

