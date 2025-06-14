"use client"

import { GalleryVerticalEnd, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME, LEGAL_BUSINESS_ADDRESS, LEGAL_CONTACT_EMAIL, TERMS_LAST_UPDATED } from "@/lib/config"
import Link from "next/link"

export default function TermsPage() {
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
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <p className="text-muted-foreground mb-8">
            <strong>Last updated:</strong> {TERMS_LAST_UPDATED}
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By accessing and using {APP_NAME} ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                {APP_NAME} is a personal finance management application that helps users track their budgets, expenses, investments, and financial goals. The Service is provided to you free of charge for personal, non-commercial use.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <div className="space-y-4">
                <p>
                  To access certain features of the Service, you must register for an account. When you register, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security of your password and account</li>
                  <li>Accept all risks of unauthorized access to your account</li>
                  <li>Notify us immediately of any unauthorized use of your account</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Privacy and Data Protection</h2>
              <div className="space-y-4">
                <p>
                  Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy. By using the Service, you consent to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>The collection and use of your information as set forth in our Privacy Policy</li>
                  <li>The storage of your financial data in encrypted format</li>
                  <li>The use of cookies and similar technologies to enhance your experience</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
              <div className="space-y-4">
                <p>You agree not to use the Service to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Transmit any harmful, threatening, or offensive content</li>
                  <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
                  <li>Use the Service for any commercial purposes without our written consent</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Financial Information Disclaimer</h2>
              <div className="space-y-4">
                <p>
                  {APP_NAME} is a tool for personal finance management and does not provide financial advice. You acknowledge that:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>The Service is for informational purposes only</li>
                  <li>We do not provide investment, tax, or financial planning advice</li>
                  <li>You should consult with qualified professionals for financial decisions</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>All investment and financial decisions are made at your own risk</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Data Security</h2>
              <p className="mb-4">
                While we implement reasonable security measures to protect your data, no method of transmission over the internet is 100% secure. You acknowledge that you provide your information at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
              <p className="mb-4">
                We strive to maintain the Service's availability but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, or circumstances beyond our control.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property</h2>
              <p className="mb-4">
                The Service and its original content, features, and functionality are owned by {APP_NAME} and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
              <div className="space-y-4">
                <p>
                  We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Breach of these Terms of Service</li>
                  <li>Violation of applicable laws</li>
                  <li>Fraudulent or illegal activity</li>
                  <li>Extended periods of inactivity</li>
                </ul>
                <p>
                  Upon termination, your right to use the Service will cease immediately, and we may delete your account and data.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Disclaimers</h2>
              <div className="space-y-4">
                <p>
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE</li>
                  <li>NON-INFRINGEMENT</li>
                  <li>ACCURACY, RELIABILITY, OR COMPLETENESS OF CONTENT</li>
                  <li>UNINTERRUPTED OR ERROR-FREE OPERATION</li>
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Limitation of Liability</h2>
              <p className="mb-4">
                IN NO EVENT SHALL {APP_NAME.toUpperCase()} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR USE, ARISING OUT OF YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">13. Indemnification</h2>
              <p className="mb-4">
                You agree to indemnify and hold harmless {APP_NAME} and its affiliates from any claims, damages, losses, or expenses arising from your use of the Service or violation of these terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">14. Governing Law</h2>
              <p className="mb-4">
                These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">15. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these terms at any time. We will notify users of significant changes via email or through the Service. Your continued use of the Service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">16. Contact Information</h2>
              <p className="mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Email:</strong> {LEGAL_CONTACT_EMAIL}</p>
                <p><strong>Address:</strong> {LEGAL_BUSINESS_ADDRESS}</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">17. Severability</h2>
              <p className="mb-4">
                If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that the Terms will otherwise remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">18. Entire Agreement</h2>
              <p className="mb-4">
                These Terms constitute the entire agreement between you and {APP_NAME} regarding the use of the Service and supersede all prior agreements and understandings.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
} 