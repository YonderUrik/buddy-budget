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

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      message: "errors.unexpectedError"
    };
  }
}; 