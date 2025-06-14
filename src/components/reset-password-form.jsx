"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InteractiveHoverButton } from "./magicui/interactive-hover-button"
import { Lock } from "lucide-react"
import { TypingAnimation } from "./magicui/typing-animation"
import { PasswordStrength, validatePasswordStrength } from "./ui/password-strength"
import { useState } from "react"
import { useRouter } from "next/navigation"

export function ResetPasswordForm({
  className,
  token,
  ...props
}) {
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const router = useRouter()

  const handleInputChange = (e) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    setSuccess("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(formData.password)
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors[0])
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong")
      }

      setSuccess("Password reset successfully! Redirecting to login...")
      
      setTimeout(() => {
        router.push("/login")
      }, 2000)

    } catch (error) {
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <div className="flex flex-col items-center gap-2 text-center">
        <TypingAnimation duration={30} className="text-2xl font-bold">
          Set new password
        </TypingAnimation>
        <p className="text-muted-foreground text-sm">
          Enter your new password below.
        </p>
      </div>
      
      {error && (
        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md border border-green-200">
          {success}
        </div>
      )}

      <div className="grid gap-6">
        <div className="grid gap-3">
          <Label htmlFor="password">New Password</Label>
          <Input 
            id="password" 
            type="password" 
            placeholder="Create a strong password"
            required 
            value={formData.password}
            onChange={handleInputChange}
            disabled={isLoading}
          />
          <PasswordStrength password={formData.password} />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input 
            id="confirmPassword" 
            type="password" 
            placeholder="Confirm your new password"
            required 
            value={formData.confirmPassword}
            onChange={handleInputChange}
            disabled={isLoading}
          />
        </div>
        <InteractiveHoverButton 
          type="submit" 
          className="w-full" 
          icon={Lock}
          disabled={isLoading}
        >
          {isLoading ? "Resetting..." : "Reset Password"}
        </InteractiveHoverButton>
      </div>
      
      <div className="text-center text-sm">
        Remember your password?{" "}
        <a href="/login" className="underline underline-offset-4">
          Back to login
        </a>
      </div>
    </form>
  );
} 