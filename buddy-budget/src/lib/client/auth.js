import { signIn } from "next-auth/react";

/**
 * Register a new user and automatically sign them in
 * @param {string} name - User's name
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Promise<{ success: boolean, message?: string, user?: object }>}
 */
export const registerUser = async (name, email, password) => {
  try {
    // First, register the user
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name, email, password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || "errors.registrationFailed"
      };
    }

    // After successful registration, sign the user in
    const signInResult = await signIn("credentials", {
      email,
      password,
      redirect: false
    });
    
    if (signInResult.error) {
      return {
        success: false,
        message: signInResult.error
      };
    }

    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "errors.unexpectedError"
    };
  }
}; 