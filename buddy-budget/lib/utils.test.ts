import { cn } from "./utils";

describe("utils", () => {
  describe("cn", () => {
    it("should merge class names", () => {
      const result = cn("foo", "bar");

      expect(result).toBe("foo bar");
    });

    it("should handle conditional classes", () => {
      const result = cn("foo", false && "bar", "baz");

      expect(result).toBe("foo baz");
    });

    it("should merge Tailwind classes correctly", () => {
      const result = cn("px-2 py-1", "px-4");

      expect(result).toBe("py-1 px-4");
    });

    it("should handle arrays of classes", () => {
      const result = cn(["foo", "bar"], "baz");

      expect(result).toBe("foo bar baz");
    });

    it("should handle objects with boolean values", () => {
      const result = cn({
        foo: true,
        bar: false,
        baz: true,
      });

      expect(result).toBe("foo baz");
    });

    it("should handle undefined and null values", () => {
      const result = cn("foo", undefined, null, "bar");

      expect(result).toBe("foo bar");
    });

    it("should handle empty strings", () => {
      const result = cn("foo", "", "bar");

      expect(result).toBe("foo bar");
    });

    it("should return empty string for no arguments", () => {
      const result = cn();

      expect(result).toBe("");
    });

    it("should handle complex Tailwind class conflicts", () => {
      const result = cn(
        "bg-red-500 text-white",
        "bg-blue-500",
        "hover:bg-green-500",
      );

      expect(result).toBe("text-white bg-blue-500 hover:bg-green-500");
    });

    it("should handle padding/margin conflicts", () => {
      const result = cn("p-4 px-2", "py-1");

      expect(result).toBe("p-4 px-2 py-1");
    });

    it("should preserve important modifiers", () => {
      const result = cn("text-sm", "text-lg");

      expect(result).toBe("text-lg");
    });

    it("should handle responsive classes", () => {
      const result = cn("text-sm md:text-lg", "text-base");

      expect(result).toBe("md:text-lg text-base");
    });

    it("should handle hover/focus states", () => {
      const result = cn("hover:bg-blue-500", "focus:bg-red-500");

      expect(result).toBe("hover:bg-blue-500 focus:bg-red-500");
    });

    it("should handle dark mode classes", () => {
      const result = cn("bg-white dark:bg-black", "text-black dark:text-white");

      expect(result).toBe("bg-white dark:bg-black text-black dark:text-white");
    });

    it("should work with component variants pattern", () => {
      const baseStyles = "rounded-md font-semibold";
      const variantStyles = "bg-blue-500 text-white";
      const result = cn(baseStyles, variantStyles);

      expect(result).toBe("rounded-md font-semibold bg-blue-500 text-white");
    });

    it("should handle mixed inputs", () => {
      const result = cn(
        "foo",
        ["bar", "baz"],
        { qux: true, quux: false },
        undefined,
        null,
        "",
        "corge",
      );

      expect(result).toBe("foo bar baz qux corge");
    });
  });
});
