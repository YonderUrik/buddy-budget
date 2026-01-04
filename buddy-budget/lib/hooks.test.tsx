/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from "@testing-library/react";

import { useDebounce, useIsMobile } from "./hooks";

describe("hooks", () => {
  describe("useDebounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return the initial value immediately", () => {
      const { result } = renderHook(() => useDebounce("initial", 500));

      expect(result.current).toBe("initial");
    });

    it("should debounce value changes", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      expect(result.current).toBe("first");

      // Change the value
      rerender({ value: "second", delay: 500 });

      // Value should not change immediately
      expect(result.current).toBe("first");

      // Fast-forward time by 500ms
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Value should now be updated
      expect(result.current).toBe("second");
    });

    it("should cancel previous debounce on rapid changes", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      // Change value multiple times quickly
      rerender({ value: "second", delay: 500 });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ value: "third", delay: 500 });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      rerender({ value: "fourth", delay: 500 });

      // Value should still be the original
      expect(result.current).toBe("first");

      // Fast-forward to complete the debounce
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should only update to the last value
      expect(result.current).toBe("fourth");
    });

    it("should handle different delay values", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 1000 },
        },
      );

      rerender({ value: "second", delay: 1000 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe("first");

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe("second");
    });

    it("should work with different data types", () => {
      // Test with number
      const { result: numberResult, rerender: numberRerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: 0, delay: 500 },
        },
      );

      numberRerender({ value: 42, delay: 500 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(numberResult.current).toBe(42);

      // Test with boolean
      const { result: boolResult, rerender: boolRerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: false, delay: 500 },
        },
      );

      boolRerender({ value: true, delay: 500 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(boolResult.current).toBe(true);

      // Test with object
      const { result: objResult, rerender: objRerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: { name: "John" }, delay: 500 },
        },
      );

      objRerender({ value: { name: "Jane" }, delay: 500 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(objResult.current).toEqual({ name: "Jane" });
    });

    it("should update when delay changes", () => {
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      rerender({ value: "second", delay: 1000 });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Should still be first because delay increased
      expect(result.current).toBe("first");

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(result.current).toBe("second");
    });

    it("should cleanup timeout on unmount", () => {
      const { result, rerender, unmount } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        {
          initialProps: { value: "first", delay: 500 },
        },
      );

      rerender({ value: "second", delay: 500 });

      unmount();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      // After unmount, the value should not update
      expect(result.current).toBe("first");
    });
  });

  describe("useIsMobile", () => {
    const originalInnerWidth = window.innerWidth;

    beforeEach(() => {
      // Reset window.innerWidth before each test
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    afterEach(() => {
      // Restore original value
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: originalInnerWidth,
      });
    });

    it("should return true when viewport is below default breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it("should return false when viewport is above default breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });

    it("should use custom breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 700,
      });

      const { result } = renderHook(() => useIsMobile(768));

      expect(result.current).toBe(true);
    });

    it("should return false when viewport equals breakpoint", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 640,
      });

      const { result } = renderHook(() => useIsMobile(640));

      expect(result.current).toBe(false);
    });

    it("should update on window resize", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);

      // Simulate resize to mobile
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it("should update on window resize from mobile to desktop", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);

      // Simulate resize to desktop
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 1200,
        });
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });

    it("should cleanup event listener on unmount", () => {
      const removeEventListenerSpy = jest.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useIsMobile());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );

      removeEventListenerSpy.mockRestore();
    });

    it("should work with different breakpoints", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1000,
      });

      const { result: result1 } = renderHook(() => useIsMobile(768));

      expect(result1.current).toBe(false);

      const { result: result2 } = renderHook(() => useIsMobile(1024));

      expect(result2.current).toBe(true);

      const { result: result3 } = renderHook(() => useIsMobile(1200));

      expect(result3.current).toBe(true);
    });

    it("should handle rapid resize events", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 800,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);

      // Simulate multiple rapid resizes
      act(() => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          configurable: true,
          value: 500,
        });
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("resize"));
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it("should update when breakpoint prop changes", async () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 700,
      });

      const { result, rerender } = renderHook(
        ({ breakpoint }) => useIsMobile(breakpoint),
        {
          initialProps: { breakpoint: 640 },
        },
      );

      // With breakpoint 640, window width 700 should not be mobile
      expect(result.current).toBe(false);

      // Change breakpoint to 768
      rerender({ breakpoint: 768 });

      await waitFor(() => {
        // With breakpoint 768, window width 700 should be mobile
        expect(result.current).toBe(true);
      });
    });
  });
});
