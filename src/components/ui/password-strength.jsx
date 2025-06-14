"use client"

import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"
import { passwordRequirements, validatePasswordStrength, getPasswordStrengthLevel } from "@/lib/password-validation"

export function PasswordStrength({ password, className }) {
  const requirements = passwordRequirements.map(req => ({
    test: req.test,
    text: req.message.replace("Password must ", "").replace("contain at least ", "").replace("be at least ", "")
  }))

  const validation = validatePasswordStrength(password)
  const strengthLevel = getPasswordStrengthLevel(validation.strength)
  
  const getColorClasses = (color) => {
    switch (color) {
      case "red": return "bg-red-500"
      case "yellow": return "bg-yellow-500"
      case "blue": return "bg-blue-500"
      case "green": return "bg-green-500"
      default: return "bg-gray-200"
    }
  }

  const getTextColorClasses = (color) => {
    switch (color) {
      case "red": return "text-red-600"
      case "yellow": return "text-yellow-600"
      case "blue": return "text-blue-600"
      case "green": return "text-green-600"
      default: return "text-muted-foreground"
    }
  }

  const strengthInfo = {
    ...strengthLevel,
    color: getColorClasses(strengthLevel.color),
    textColor: getTextColorClasses(strengthLevel.color)
  }

  if (!password) return null

  return (
    <div className={cn("space-y-3", className)}>
      {/* Strength Bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Password strength</span>
          <span className={cn("font-medium", strengthInfo.textColor)}>
            {strengthInfo.text}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={cn("h-2 rounded-full transition-all duration-300", strengthInfo.color)}
            style={{ width: `${(validation.strength / requirements.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Requirements List */}
      <div className="space-y-1">
        {requirements.map((requirement, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            {requirement.test(password) ? (
              <Check className="size-3 text-green-600" />
            ) : (
              <X className="size-3 text-red-500" />
            )}
            <span className={cn(
              requirement.test(password) 
                ? "text-green-700 dark:text-green-400" 
                : "text-muted-foreground"
            )}>
              {requirement.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Export the validation function for use in forms
export { validatePasswordStrength } from "@/lib/password-validation" 