// Password validation utility - shared between frontend and backend

export const passwordRequirements = [
  {
    test: (pwd) => pwd.length >= 8,
    message: "Password must be at least 8 characters long"
  },
  {
    test: (pwd) => /[A-Z]/.test(pwd),
    message: "Password must contain at least one uppercase letter"
  },
  {
    test: (pwd) => /[a-z]/.test(pwd),
    message: "Password must contain at least one lowercase letter"
  },
  {
    test: (pwd) => /\d/.test(pwd),
    message: "Password must contain at least one number"
  },
  {
    test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    message: "Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;':\"\\,.<>/?)"
  }
]

export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      errors: ["Password is required"],
      strength: 0
    }
  }

  const failedRequirements = passwordRequirements.filter(req => !req.test(password))
  
  return {
    isValid: failedRequirements.length === 0,
    errors: failedRequirements.map(req => req.message),
    strength: passwordRequirements.length - failedRequirements.length
  }
}

export function getPasswordStrengthLevel(strength) {
  if (strength === 0) return { level: "empty", text: "", color: "gray" }
  if (strength <= 2) return { level: "weak", text: "Weak", color: "red" }
  if (strength <= 3) return { level: "fair", text: "Fair", color: "yellow" }
  if (strength <= 4) return { level: "good", text: "Good", color: "blue" }
  return { level: "strong", text: "Strong", color: "green" }
} 