"use client"

import { GalleryVerticalEnd, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME, LEGAL_BUSINESS_ADDRESS, LEGAL_CONTACT_EMAIL, PRIVACY_CONTACT_EMAIL, PRIVACY_LAST_UPDATED } from "@/lib/config"
import Link from "next/link"

export default function PrivacyPage() {
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
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <p className="text-muted-foreground mb-8">
            <strong>Last updated:</strong> {PRIVACY_LAST_UPDATED}
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="mb-4">
                At {APP_NAME}, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our personal finance management application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-medium mb-3">2.1 Personal Information</h3>
              <div className="space-y-4">
                <p>We may collect personal information that you voluntarily provide to us when you:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Register for an account</li>
                  <li>Use our services</li>
                  <li>Contact us for support</li>
                  <li>Subscribe to our newsletter</li>
                </ul>
                <p>This information may include:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Name and email address</li>
                  <li>Profile picture (if provided)</li>
                  <li>Financial data you input (budgets, expenses, income, goals)</li>
                  <li>Account preferences and settings</li>
                </ul>
              </div>

              <h3 className="text-xl font-medium mb-3 mt-6">2.2 Automatically Collected Information</h3>
              <div className="space-y-4">
                <p>When you access our application, we may automatically collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Device information (type, operating system, browser)</li>
                  <li>IP address and location data</li>
                  <li>Usage patterns and preferences</li>
                  <li>Log files and analytics data</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </div>

              <h3 className="text-xl font-medium mb-3 mt-6">2.3 Third-Party Authentication</h3>
              <p className="mb-4">
                When you sign in using third-party services (such as Google or Apple), we receive basic profile information as permitted by your privacy settings with those services.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
              <div className="space-y-4">
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide, operate, and maintain our services</li>
                  <li>Process your transactions and manage your account</li>
                  <li>Improve and personalize your experience</li>
                  <li>Communicate with you about your account and our services</li>
                  <li>Send you technical notices and security alerts</li>
                  <li>Respond to your comments and questions</li>
                  <li>Analyze usage patterns to improve our application</li>
                  <li>Comply with legal obligations</li>
                  <li>Protect against fraudulent or illegal activity</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Information Sharing and Disclosure</h2>
              
              <h3 className="text-xl font-medium mb-3">4.1 We Do Not Sell Your Data</h3>
              <p className="mb-4">
                We do not sell, trade, or rent your personal information to third parties for marketing purposes.
              </p>

              <h3 className="text-xl font-medium mb-3">4.2 Limited Sharing</h3>
              <div className="space-y-4">
                <p>We may share your information only in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Service Providers:</strong> With trusted third-party service providers who assist us in operating our application (hosting, analytics, email services)</li>
                  <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
                  <li><strong>Safety and Security:</strong> To protect the rights, property, or safety of our users or others</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with notice to users)</li>
                  <li><strong>Consent:</strong> With your explicit consent for specific purposes</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
              <div className="space-y-4">
                <p>We implement appropriate security measures to protect your information:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Encryption:</strong> Data is encrypted in transit and at rest</li>
                  <li><strong>Access Controls:</strong> Limited access to personal data on a need-to-know basis</li>
                  <li><strong>Secure Infrastructure:</strong> Industry-standard security practices and monitoring</li>
                  <li><strong>Regular Updates:</strong> Security patches and updates are applied promptly</li>
                  <li><strong>Password Protection:</strong> Passwords are hashed and salted</li>
                </ul>
                <p className="mt-4">
                  However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
              <div className="space-y-4">
                <p>We retain your information for as long as necessary to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide our services to you</li>
                  <li>Comply with legal obligations</li>
                  <li>Resolve disputes and enforce agreements</li>
                  <li>Improve our services</li>
                </ul>
                <p>
                  When you delete your account, we will delete your personal information within 30 days, except where we are required to retain it for legal purposes.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Your Privacy Rights</h2>
              <div className="space-y-4">
                <p>Depending on your location, you may have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> Request access to your personal information</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                  <li><strong>Portability:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Restriction:</strong> Request restriction of processing</li>
                  <li><strong>Objection:</strong> Object to certain types of processing</li>
                  <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
                </ul>
                <p>
                  To exercise these rights, please contact us using the information provided in the "Contact Us" section.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking Technologies</h2>
              <div className="space-y-4">
                <p>We use cookies and similar technologies to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Remember your preferences and settings</li>
                  <li>Authenticate your identity</li>
                  <li>Analyze how our application is used</li>
                  <li>Improve our services</li>
                </ul>
                <p>
                  You can control cookies through your browser settings. However, disabling cookies may affect the functionality of our application.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Third-Party Services</h2>
              <div className="space-y-4">
                <p>Our application may integrate with third-party services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Authentication Providers:</strong> Google for account creation</li>
                  <li><strong>Analytics Services:</strong> To understand usage patterns</li>
                  <li><strong>Email Services:</strong> For transactional emails</li>
                  <li><strong>Hosting Services:</strong> For application infrastructure</li>
                </ul>
                <p>
                  These third parties have their own privacy policies. We encourage you to review their privacy practices.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
              <p className="mb-4">
                Our application is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. International Data Transfers</h2>
              <p className="mb-4">
                Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards to protect your information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. California Privacy Rights (CCPA)</h2>
              <div className="space-y-4">
                <p>If you are a California resident, you have additional rights under the California Consumer Privacy Act:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Right to know what personal information is collected</li>
                  <li>Right to delete personal information</li>
                  <li>Right to opt-out of the sale of personal information</li>
                  <li>Right to non-discrimination for exercising your rights</li>
                </ul>
                <p>
                  Note: We do not sell personal information as defined by the CCPA.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. European Privacy Rights (GDPR)</h2>
              <div className="space-y-4">
                <p>If you are in the European Economic Area, you have rights under the General Data Protection Regulation:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Lawful basis for processing your data</li>
                  <li>Right to access, rectify, or erase your data</li>
                  <li>Right to restrict or object to processing</li>
                  <li>Right to data portability</li>
                  <li>Right to lodge a complaint with supervisory authorities</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Changes to This Privacy Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. For significant changes, we may also send you an email notification.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Contact Us</h2>
              <p className="mb-4">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Email:</strong> {LEGAL_CONTACT_EMAIL}</p>
                <p><strong>Address:</strong> {LEGAL_BUSINESS_ADDRESS}</p>
                <p><strong>Subject Line:</strong> Privacy Policy Inquiry</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">16. Data Protection Officer</h2>
              <p className="mb-4">
                For privacy-related inquiries, you can also contact our Data Protection Officer at: {PRIVACY_CONTACT_EMAIL}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
} 