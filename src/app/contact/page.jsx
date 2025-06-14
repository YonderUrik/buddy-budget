"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { GalleryVerticalEnd, Mail, MessageSquare, Send, CheckCircle, AlertCircle, Clock, HelpCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/config"
import Link from "next/link"
import { InteractiveHoverButton } from "@/components/magicui/interactive-hover-button"

const SUPPORT_CATEGORIES = [
   { value: "general", label: "General Question" },
   { value: "technical", label: "Technical Issue" },
   { value: "billing", label: "Billing & Account" },
   { value: "feature", label: "Feature Request" },
   { value: "bug", label: "Bug Report" },
   { value: "privacy", label: "Privacy & Data" },
   { value: "other", label: "Other" },
]

export default function ContactPage() {
   const { data: session } = useSession()
   const router = useRouter()
   const [isSubmitting, setIsSubmitting] = useState(false)
   const [submitted, setSubmitted] = useState(false)
   const [error, setError] = useState("")

   const [formData, setFormData] = useState({
      name: "",
      email: "",
      category: "",
      subject: "",
      message: "",
   })

   // Auto-populate form fields when session is available
   useEffect(() => {
      if (session?.user) {
         setFormData(prev => ({
            ...prev,
            name: session.user.name || "",
            email: session.user.email || "",
            // Auto-suggest subject based on user status
            subject: "",
         }))
      }
   }, [session])

   const handleInputChange = (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }))
      if (error) setError("")
   }

   const handleSubmit = async (e) => {
      e.preventDefault()
      setIsSubmitting(true)
      setError("")

      try {
         const response = await fetch("/api/contact", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
         })

         const data = await response.json()

         if (response.ok) {
            setSubmitted(true)
         } else {
            setError(data.error || "Failed to send message. Please try again.")
         }
      } catch (error) {
         setError("Failed to send message. Please try again.")
      } finally {
         setIsSubmitting(false)
      }
   }

   if (submitted) {
      return (
         <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b">
               <div className="flex h-16 items-center px-4 gap-4">
                  <Button
                     variant="outline" size="sm"
                     onClick={() => router.back()}
                  >
                     <ArrowLeft className="size-4 mr-2" />
                     Back
                  </Button>
                  <div className="flex items-center gap-2 font-medium">
                     <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                        <GalleryVerticalEnd className="size-4" />
                     </div>
                     {APP_NAME}
                  </div>
                  <div className="ml-auto flex items-center gap-4">
                     <ThemeToggle />
                  </div>
               </div>
            </header>

            {/* Success Message */}
            <main className="container mx-auto py-8 px-4 max-w-2xl">
               <Card>
                  <CardHeader className="text-center">
                     <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                        <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
                     </div>
                     <CardTitle className="text-2xl">Message Sent Successfully!</CardTitle>
                     <CardDescription>
                        Thank you for contacting us. We've received your message and will get back to you soon.
                     </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                     <Alert>
                        <Mail className="size-4" />
                        <AlertDescription>
                           A confirmation email has been sent to <strong>{formData.email}</strong> with a copy of your message.
                        </AlertDescription>
                     </Alert>

                     <div className="bg-muted p-4 rounded-lg">
                        <h4 className="font-medium mb-2">What happens next?</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                           <li>• Our support team will review your request</li>
                           <li>• We typically respond within 24-48 hours</li>
                           <li>• You'll receive updates at your email address</li>
                           <li>• For urgent issues, we'll prioritize your request</li>
                        </ul>
                     </div>

                     <div className="flex gap-2">
                        <Link href="/dashboard" className="flex-1">
                           <Button variant="outline" className="w-full">
                              Back to Dashboard
                           </Button>
                        </Link>
                        <Button
                           onClick={() => {
                              setSubmitted(false)
                              setFormData({
                                 name: session?.user?.name || "",
                                 email: session?.user?.email || "",
                                 category: "",
                                 subject: session?.user?.name ? `Support request from ${session.user.name}` : "",
                                 message: "",
                              })
                           }}
                           className="flex-1"
                        >
                           Send Another Message
                        </Button>
                     </div>
                  </CardContent>
               </Card>
            </main>
         </div>
      )
   }

   return (
      <div className="min-h-screen bg-background">
         {/* Header */}
         <header className="border-b">
            <div className="flex h-16 items-center px-4 gap-4">
               <div className="flex items-center gap-2 font-medium">
                  <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                     <GalleryVerticalEnd className="size-4" />
                  </div>
                  {APP_NAME}
               </div>
               <div className="ml-auto flex items-center gap-4">
                  <ThemeToggle />
                  <Button
                     variant="outline" size="sm"
                     onClick={() => router.back()}
                  >
                     <ArrowLeft className="size-4 mr-2" />
                     Back
                  </Button>
               </div>
            </div>
         </header>

         {/* Main Content */}
         <main className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="grid gap-8 lg:grid-cols-3">
               {/* Contact Form */}
               <div className="lg:col-span-2">
                  <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <MessageSquare className="size-5" />
                           Contact Support
                        </CardTitle>
                        <CardDescription>
                           Have a question or need help? Send us a message and we'll get back to you as soon as possible.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        {session?.user && (
                           <Alert className="mb-4 border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                              <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
                              <AlertDescription>
                                 <strong>Logged in as:</strong> {session.user.name || session.user.email}

                              </AlertDescription>
                           </Alert>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                           {error && (
                              <Alert variant="destructive">
                                 <AlertCircle className="size-4" />
                                 <AlertDescription>{error}</AlertDescription>
                              </Alert>
                           )}

                           <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                 <Label htmlFor="name">Name *</Label>
                                 <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange("name", e.target.value)}
                                    placeholder="Your full name"
                                    required
                                    readOnly={!!session?.user?.name}
                                 />
                                 {session?.user?.name && (
                                    <p className="text-xs text-muted-foreground">
                                       ✓ Auto-filled from your account
                                    </p>
                                 )}
                              </div>
                              <div className="space-y-2">
                                 <Label htmlFor="email">Email *</Label>
                                 <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => handleInputChange("email", e.target.value)}
                                    placeholder="your.email@example.com"
                                    required
                                    readOnly={!!session?.user?.email}
                                 />
                                 {session?.user?.email && (
                                    <p className="text-xs text-muted-foreground">
                                       ✓ Auto-filled from your account
                                    </p>
                                 )}
                              </div>
                           </div>

                           <div className="space-y-2">
                              <Label htmlFor="category">Category</Label>
                              <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                                 <SelectTrigger>
                                    <SelectValue placeholder="Select a category (optional)" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {SUPPORT_CATEGORIES.map((category) => (
                                       <SelectItem key={category.value} value={category.value}>
                                          {category.label}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>

                           <div className="space-y-2">
                              <Label htmlFor="subject">Subject *</Label>
                              <Input
                                 id="subject"
                                 value={formData.subject}
                                 onChange={(e) => handleInputChange("subject", e.target.value)}
                                 placeholder={session?.user ? "Brief description of your issue or question" : "Brief description of your issue or question"}
                                 required
                              />
                              {session?.user && formData.subject.includes(session.user.name) && (
                                 <p className="text-xs text-muted-foreground">
                                    ✓ Subject includes your name for easier identification
                                 </p>
                              )}
                           </div>

                           <div className="space-y-2">
                              <Label htmlFor="message">Message *</Label>
                              <Textarea
                                 id="message"
                                 value={formData.message}
                                 onChange={(e) => handleInputChange("message", e.target.value)}
                                 placeholder="Please provide as much detail as possible about your question or issue..."
                                 className="min-h-[120px]"
                                 required
                              />
                              <p className="text-xs text-muted-foreground">
                                 Minimum 10 characters ({formData.message.length}/10)
                              </p>
                           </div>

                           <InteractiveHoverButton type="submit" disabled={isSubmitting} className="w-full" icon={Send}>
                              {isSubmitting ? (
                                 <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Sending...
                                 </>
                              ) : (
                                 <>

                                    Send Message
                                 </>
                              )}
                           </InteractiveHoverButton>
                        </form>
                     </CardContent>
                  </Card>
               </div>

               {/* Contact Information & FAQ */}
               <div className="space-y-6">
                  {/* Contact Info */}
                  <Card>
                     <CardHeader>
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                           <Mail className="size-5 text-muted-foreground mt-0.5" />
                           <div>
                              <p className="font-medium">Email Support</p>
                              <p className="text-sm text-muted-foreground">{LEGAL_CONTACT_EMAIL}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-3">
                           <Clock className="size-5 text-muted-foreground mt-0.5" />
                           <div>
                              <p className="font-medium">Response Time</p>
                              <p className="text-sm text-muted-foreground">24-48 hours</p>
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  {/* Legal Links */}
                  <Card>
                     <CardHeader>
                        <CardTitle className="text-lg">Legal & Privacy</CardTitle>
                     </CardHeader>
                     <CardContent className="space-y-2">
                        <Link href="/terms" className="block text-sm text-primary hover:underline">
                           Terms of Service
                        </Link>
                        <Link href="/privacy" className="block text-sm text-primary hover:underline">
                           Privacy Policy
                        </Link>
                     </CardContent>
                  </Card>
               </div>
            </div>
         </main>
      </div>
   )
} 