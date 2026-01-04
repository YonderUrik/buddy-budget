import {
  commonIgnoreErrors,
  shouldIgnoreError,
  isUserError,
} from "./filters";

describe("Sentry Filters", () => {
  describe("commonIgnoreErrors", () => {
    it("should contain ResizeObserver errors", () => {
      expect(commonIgnoreErrors).toContain(
        "ResizeObserver loop limit exceeded",
      );
      expect(commonIgnoreErrors).toContain(
        "ResizeObserver loop completed with undelivered notifications",
      );
    });

    it("should contain network errors", () => {
      expect(commonIgnoreErrors).toContain("Network request failed");
      expect(commonIgnoreErrors).toContain("NetworkError");
      expect(commonIgnoreErrors).toContain("Failed to fetch");
      expect(commonIgnoreErrors).toContain("Load failed");
    });

    it("should contain browser extension errors", () => {
      expect(commonIgnoreErrors).toContain("chrome-extension://");
      expect(commonIgnoreErrors).toContain("moz-extension://");
      expect(commonIgnoreErrors).toContain("safari-extension://");
    });

    it("should contain hydration errors", () => {
      expect(commonIgnoreErrors).toContain("Hydration failed");
      expect(commonIgnoreErrors).toContain(
        "There was an error while hydrating",
      );
    });

    it("should contain navigation errors", () => {
      expect(commonIgnoreErrors).toContain("Navigation cancelled");
      expect(commonIgnoreErrors).toContain("Navigation interrupted");
    });
  });

  describe("shouldIgnoreError", () => {
    describe("Browser Extension Errors", () => {
      it("should ignore chrome extension errors", () => {
        const error = new Error(
          "chrome-extension://abc123/script.js failed to load",
        );

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore moz extension errors", () => {
        const error = new Error("moz-extension://def456/background.js error");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore safari extension errors", () => {
        const error = new Error("safari-extension://ghi789/inject.js");

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Ad Blocker Errors", () => {
      it("should ignore adsbygoogle errors", () => {
        const error = new Error("adsbygoogle is not defined");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore google_ad errors", () => {
        const error = new Error("google_ad failed to initialize");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore blocked by client errors", () => {
        const error = new Error("Request blocked by client");

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Network Errors", () => {
      it("should ignore NetworkError", () => {
        const error = new Error("NetworkError: Connection failed");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore Failed to fetch errors", () => {
        const error = new Error("Failed to fetch resource");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore ERR_NETWORK errors", () => {
        const error = new Error("ERR_NETWORK_CHANGED");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore ERR_INTERNET_DISCONNECTED", () => {
        const error = new Error("ERR_INTERNET_DISCONNECTED");

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Hydration Errors", () => {
      it("should ignore Hydration failed errors", () => {
        const error = new Error("Hydration failed because...");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore did not match errors", () => {
        const error = new Error("Text content did not match");

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Third-party Script Errors", () => {
      it("should ignore Script error.", () => {
        const error = new Error("Script error.");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it('should ignore "Script error." exactly', () => {
        const error = "Script error.";

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should ignore Non-Error promise rejection", () => {
        const error = new Error("Non-Error promise rejection captured");

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should return false for null", () => {
        expect(shouldIgnoreError(null)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(shouldIgnoreError(undefined)).toBe(false);
      });

      it("should handle non-Error objects", () => {
        const errorString = "chrome-extension://test";

        expect(shouldIgnoreError(errorString)).toBe(true);
      });

      it("should return false for errors that should NOT be ignored", () => {
        const error = new Error("Actual application error");

        expect(shouldIgnoreError(error)).toBe(false);
      });

      it("should handle Error objects with message property", () => {
        const error = new Error("NetworkError occurred");

        expect(shouldIgnoreError(error)).toBe(true);
      });

      it("should handle string errors", () => {
        const error = "Failed to fetch";

        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    describe("Case Sensitivity", () => {
      it("should be case sensitive for browser extensions", () => {
        const error = new Error("CHROME-EXTENSION://test");

        expect(shouldIgnoreError(error)).toBe(false);
      });

      it("should handle actual errors that contain similar words", () => {
        const error = new Error("Failed validation on fetch request");

        expect(shouldIgnoreError(error)).toBe(false);
      });
    });
  });

  describe("isUserError", () => {
    describe("Validation Errors", () => {
      it("should identify validation errors", () => {
        const error = new Error("validation failed for field");

        expect(isUserError(error)).toBe(true);
      });

      it("should identify invalid input errors", () => {
        const error = new Error("invalid input provided");

        expect(isUserError(error)).toBe(true);
      });

      it("should identify required field errors", () => {
        const error = new Error("required field is missing");

        expect(isUserError(error)).toBe(true);
      });
    });

    describe("Authentication Errors", () => {
      it("should identify unauthorized errors", () => {
        const error = new Error("unauthorized access");

        expect(isUserError(error)).toBe(true);
      });

      it("should identify not authenticated errors", () => {
        const error = new Error("user not authenticated");

        expect(isUserError(error)).toBe(true);
      });

      it("should identify session expired errors", () => {
        const error = new Error("session expired, please login again");

        expect(isUserError(error)).toBe(true);
      });
    });

    describe("Rate Limiting Errors", () => {
      it("should identify rate limit errors", () => {
        const error = new Error("rate limit exceeded");

        expect(isUserError(error)).toBe(true);
      });

      it("should identify too many requests errors", () => {
        const error = new Error("too many requests, try again later");

        expect(isUserError(error)).toBe(true);
      });
    });

    describe("Edge Cases", () => {
      it("should return false for null", () => {
        expect(isUserError(null)).toBe(false);
      });

      it("should return false for undefined", () => {
        expect(isUserError(undefined)).toBe(false);
      });

      it("should handle non-Error objects", () => {
        const errorString = "validation error";

        expect(isUserError(errorString)).toBe(true);
      });

      it("should return false for system errors", () => {
        const error = new Error("Database connection failed");

        expect(isUserError(error)).toBe(false);
      });

      it("should return false for application errors", () => {
        const error = new Error("Unexpected null pointer");

        expect(isUserError(error)).toBe(false);
      });
    });

    describe("Case Sensitivity", () => {
      it("should handle lowercase validation", () => {
        const error = new Error("validation failed");

        expect(isUserError(error)).toBe(true);
      });

      it("should handle uppercase unauthorized", () => {
        const error = new Error("UNAUTHORIZED");

        expect(isUserError(error)).toBe(false); // Case sensitive
      });
    });
  });

  describe("Integration Tests", () => {
    it("should filter common browser errors using shouldIgnoreError", () => {
      // Note: shouldIgnoreError has specific logic, not all commonIgnoreErrors
      // ResizeObserver errors should be in ignoreErrors config, not shouldIgnoreError
      const browserErrors = [
        new Error("Failed to fetch"),
        new Error("chrome-extension://test/script.js"),
        new Error("Hydration failed"),
      ];

      browserErrors.forEach((error) => {
        expect(shouldIgnoreError(error)).toBe(true);
      });
    });

    it("should NOT filter application errors", () => {
      const appErrors = [
        new Error("Cannot read property 'name' of undefined"),
        new Error("TypeError: x is not a function"),
        new Error("ReferenceError: foo is not defined"),
        new Error("Database query failed"),
        new Error("API request timeout"),
      ];

      appErrors.forEach((error) => {
        expect(shouldIgnoreError(error)).toBe(false);
      });
    });

    it("should identify user vs system errors correctly", () => {
      const userErrors = [
        new Error("validation failed"),
        new Error("unauthorized"),
        new Error("rate limit exceeded"),
      ];

      const systemErrors = [
        new Error("Internal server error"),
        new Error("Database connection lost"),
        new Error("Memory allocation failed"),
      ];

      userErrors.forEach((error) => {
        expect(isUserError(error)).toBe(true);
      });

      systemErrors.forEach((error) => {
        expect(isUserError(error)).toBe(false);
      });
    });
  });
});
