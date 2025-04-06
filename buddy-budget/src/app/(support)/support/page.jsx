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
import { ChevronLeft, CheckCircle2, AlertCircle, Mail, HelpCircle, LifeBuoy } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { config } from "@/lib/config"
import { ModeToggle } from "@/components/theme-toggle"
import { z } from "zod"
import axios from "axios"

export default function SupportPage() {
   const { t } = useTranslation()
   const [activeTab, setActiveTab] = useState("contact")
   const [name, setName] = useState("")
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

   return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
         <header className="border-b bg-background/60 backdrop-blur sticky top-0 z-10 shadow-sm">
            <div className="container flex h-12 items-center justify-between px-4 md:px-6">
               <Link href="/" className="transition-transform hover:scale-105">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{config.appName}</h1>
               </Link>
               <div className="ml-auto">
                  <ModeToggle />
               </div>
            </div>
         </header>
         <main className="container py-8 px-4 md:px-6">

            <div className={`flex items-center mb-6 w-full max-w-4xl mx-auto ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>
               <Button variant="outline" size="sm" asChild className="mr-2 transition-all hover:shadow-md">
                  <Link href="/">
                     <ChevronLeft className="mr-2 h-4 w-4" />
                     {t("common.back")}
                  </Link>
               </Button>
            </div>

            <div className="max-w-4xl mx-auto">
               <h1 className={`text-3xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>
                  {t("support.title")}
               </h1>

               <Card className={`border rounded-lg shadow-lg ${mounted ? 'animate-fadeInUp' : 'opacity-0'}`}>
                  <CardContent className="p-0">
                     <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        {/* TABS */}
                        <div className="flex justify-center pt-4">
                           <TabsList className="inline-flex mb-8 bg-muted/40 p-1 rounded-lg">
                              <TabsTrigger value="contact" className="flex items-center gap-2 px-4 py-2">
                                 <Mail className="h-4 w-4" />
                                 {t("support.contactUs")}
                              </TabsTrigger>
                              <TabsTrigger value="faq" className="flex items-center gap-2 px-4 py-2">
                                 <HelpCircle className="h-4 w-4" />
                                 {t("support.faq")}
                              </TabsTrigger>
                              <TabsTrigger value="help" className="flex items-center gap-2 px-4 py-2">
                                 <LifeBuoy className="h-4 w-4" />
                                 {t("support.helpCenter")}
                              </TabsTrigger>
                           </TabsList>
                        </div>

                        {/* CONTACT TAB */}
                        <TabsContent value="contact" className="px-6 pb-6">
                           <Card className={`hover:bg-muted/50`}>
                              <CardHeader>
                                 <CardTitle>{t("support.contactForm")}</CardTitle>
                                 <CardDescription>
                                    {t("support.contactFormDesc")}
                                 </CardDescription>
                              </CardHeader>
                              <CardContent>
                                 {isSubmitted && (
                                    <Alert className="bg-green-50 border-green-200 mb-4">
                                       <CheckCircle2 className="h-4 w-4 text-green-600" />
                                       <AlertDescription className="text-green-800">
                                          {t("support.messageSent")}
                                       </AlertDescription>
                                    </Alert>
                                 )}
                                 <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="gap-4">
                                       <div className="space-y-2">
                                          <Label htmlFor="email">{t("common.email")}</Label>
                                          <Input
                                             id="email"
                                             type="email"
                                             value={email}
                                             onChange={(e) => setEmail(e.target.value)}
                                             required
                                             className={formErrors.email ? "border-red-300" : ""}
                                          />
                                          {formErrors.email && (
                                             <p className="text-red-500 text-sm mt-1">{formErrors.email}</p>
                                          )}
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                       <div className="space-y-2">
                                          <Label htmlFor="subject">{t("support.subject")}</Label>
                                          <Input
                                             id="subject"
                                             value={subject}
                                             onChange={(e) => setSubject(e.target.value)}
                                             required
                                             className={formErrors.subject ? "border-red-300" : ""}
                                          />
                                          {formErrors.subject && (
                                             <p className="text-red-500 text-sm mt-1">{formErrors.subject}</p>
                                          )}
                                       </div>
                                       <div className="space-y-2">
                                          <Label htmlFor="category">{t("support.category")}</Label>
                                          <Select value={category} onValueChange={setCategory} required>
                                             <SelectTrigger id="category" className={formErrors.category ? "border-red-300" : ""}>
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
                                       <Label htmlFor="message">{t("support.message")}</Label>
                                       <Textarea
                                          id="message"
                                          value={message}
                                          onChange={(e) => setMessage(e.target.value)}
                                          rows={5}
                                          required
                                          className={formErrors.message ? "border-red-300" : ""}
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

                                    <Button type="submit" disabled={isSubmitting}>
                                       {isSubmitting ? t("common.loading") : t("support.sendMessage")}
                                    </Button>
                                 </form>
                              </CardContent>
                           </Card>
                        </TabsContent>

                        {/* FAQ TAB */}
                        {/* <TabsContent value="faq" className="px-6 pb-6">
                           <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-100' : 'opacity-0'}`}>
                              <h2 className="text-xl font-semibold mb-4 text-primary">{t("support.frequentlyAskedQuestions", "Frequently Asked Questions")}</h2>
                              <p className="text-muted-foreground mb-6">
                                 {t("support.faqDesc", "Find answers to the most common questions about BuddyBudget.")}
                              </p>
                              <Accordion type="single" collapsible className="w-full">
                                 <AccordionItem value="item-1">
                                    <AccordionTrigger>{t("support.faq1", "How do I add a new account?")}</AccordionTrigger>
                                    <AccordionContent>
                                       {t(
                                          "support.faq1Answer",
                                          "To add a new account, go to the Accounts page and click on the 'New Account' button. Fill in the required information and click 'Create Account'.",
                                       )}
                                    </AccordionContent>
                                 </AccordionItem>
                                 <AccordionItem value="item-2">
                                    <AccordionTrigger>{t("support.faq2", "How do I track my expenses?")}</AccordionTrigger>
                                    <AccordionContent>
                                       {t(
                                          "support.faq2Answer",
                                          "You can track your expenses by adding transactions. Go to the Transactions page and click on 'New Transaction'. Select 'Expense' as the transaction type, fill in the details, and click 'Add Transaction'.",
                                       )}
                                    </AccordionContent>
                                 </AccordionItem>
                                 <AccordionItem value="item-3">
                                    <AccordionTrigger>{t("support.faq3", "How do I create a budget?")}</AccordionTrigger>
                                    <AccordionContent>
                                       {t(
                                          "support.faq3Answer",
                                          "To create a budget, go to the Budgets page and click on 'New Budget'. Enter a name for your budget, set the amount, select a category, and choose a period. Then click 'Create Budget'.",
                                       )}
                                    </AccordionContent>
                                 </AccordionItem>
                                 <AccordionItem value="item-4">
                                    <AccordionTrigger>
                                       {t("support.faq4", "How do I transfer money between accounts?")}
                                    </AccordionTrigger>
                                    <AccordionContent>
                                       {t(
                                          "support.faq4Answer",
                                          "To transfer money between accounts, go to the Transactions page and click on 'New Transaction'. Select 'Transfer' as the transaction type, choose the source and destination accounts, enter the amount, and click 'Add Transaction'.",
                                       )}
                                    </AccordionContent>
                                 </AccordionItem>
                                 <AccordionItem value="item-5">
                                    <AccordionTrigger>{t("support.faq5", "Is my financial data secure?")}</AccordionTrigger>
                                    <AccordionContent>
                                       {t(
                                          "support.faq5Answer",
                                          "Yes, we take security very seriously. All your data is encrypted both in transit and at rest. We use industry-standard security measures to protect your information. For more details, please see our Privacy Policy.",
                                       )}
                                    </AccordionContent>
                                 </AccordionItem>
                              </Accordion>
                           </div>
                        </TabsContent> */}

                        {/* HELP CENTER TAB */}
                        {/* <TabsContent value="help" className="px-6 pb-6">
                           <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-100' : 'opacity-0'}`}>
                              <h2 className="text-xl font-semibold mb-4 text-primary">{t("support.helpCenter", "Help Center")}</h2>
                              <p className="text-muted-foreground mb-6">
                                 {t("support.helpCenterDesc", "Browse our help articles to learn more about BuddyBudget.")}
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-200' : 'opacity-0'}`}>
                                    <h3 className="text-primary font-semibold mb-3">{t("support.gettingStarted", "Getting Started")}</h3>
                                    <ul className="space-y-2">
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article1", "Setting up your account")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article2", "Adding your first account")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article3", "Creating categories")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article4", "Recording transactions")}
                                          </Link>
                                       </li>
                                    </ul>
                                 </div>

                                 <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-300' : 'opacity-0'}`}>
                                    <h3 className="text-primary font-semibold mb-3">{t("support.budgeting", "Budgeting")}</h3>
                                    <ul className="space-y-2">
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article5", "Creating a budget")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article6", "Setting budget goals")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article7", "Tracking budget progress")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article8", "Budget reports")}
                                          </Link>
                                       </li>
                                    </ul>
                                 </div>

                                 <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-400' : 'opacity-0'}`}>
                                    <h3 className="text-primary font-semibold mb-3">{t("support.accountManagement", "Account Management")}</h3>
                                    <ul className="space-y-2">
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article9", "Managing multiple accounts")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article10", "Reconciling accounts")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article11", "Handling transfers")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article12", "Account balances")}
                                          </Link>
                                       </li>
                                    </ul>
                                 </div>

                                 <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-500' : 'opacity-0'}`}>
                                    <h3 className="text-primary font-semibold mb-3">{t("support.reporting", "Reporting")}</h3>
                                    <ul className="space-y-2">
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article13", "Generating reports")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article14", "Understanding net worth")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article15", "Expense analysis")}
                                          </Link>
                                       </li>
                                       <li>
                                          <Link href="#" className="text-primary hover:underline">
                                             {t("support.article16", "Exporting data")}
                                          </Link>
                                       </li>
                                    </ul>
                                 </div>
                              </div>
                              <p className={`text-sm text-muted-foreground mt-6 ${mounted ? 'animate-fadeIn animate-delay-600' : 'opacity-0'}`}>
                                 {t("support.cantFindHelp", "Can't find what you're looking for?")}
                                 <Button variant="link" className="p-0 h-auto ml-1" onClick={() => setActiveTab("contact")}>
                                    {t("support.contactSupport", "Contact our support team")}
                                 </Button>
                              </p>
                           </div>
                        </TabsContent> */}
                     </Tabs>
                  </CardContent>
               </Card>
            </div>
         </main>
      </div>
   )
}

