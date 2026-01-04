import fs from "fs";
import path from "path";

import { getLegalDocument, getAllLegalDocuments } from "../markdown";

jest.mock("fs");

const mockFs = fs as jest.Mocked<typeof fs>;

describe("markdown", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe("getLegalDocument", () => {
    it("should read and parse a markdown file with frontmatter", () => {
      const mockContent = `---
title: Privacy Policy
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

# Privacy Policy

This is the content of the privacy policy.`;

      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = getLegalDocument("privacy.md");

      expect(result.frontmatter).toEqual({
        title: "Privacy Policy",
        lastUpdated: "2024-01-01",
        effectiveDate: "2024-01-01",
      });
      expect(result.content).toBe(
        "# Privacy Policy\n\nThis is the content of the privacy policy.",
      );
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "content", "legal", "privacy.md"),
        "utf8",
      );
    });

    it("should trim whitespace from content", () => {
      const mockContent = `---
title: Terms of Service
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---


# Terms

Content here

  `;

      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = getLegalDocument("terms.md");

      expect(result.content).toBe("# Terms\n\nContent here");
    });

    it("should handle files with minimal frontmatter", () => {
      const mockContent = `---
title: Cookie Policy
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

Cookie information.`;

      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = getLegalDocument("cookies.md");

      expect(result.frontmatter.title).toBe("Cookie Policy");
      expect(result.content).toBe("Cookie information.");
    });

    it("should throw an error when file read fails", () => {
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      expect(() => getLegalDocument("nonexistent.md")).toThrow(
        "Failed to load legal document: nonexistent.md",
      );
    });

    it("should log error when file read fails", () => {
      const consoleErrorSpy = jest.spyOn(console, "error");

      mockFs.readFileSync.mockImplementation(() => {
        throw new Error("File not found");
      });

      try {
        getLegalDocument("nonexistent.md");
      } catch {
        // Expected error
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error reading legal document nonexistent.md:",
        expect.any(Error),
      );
    });

    it("should handle files in the correct directory", () => {
      const mockContent = `---
title: Test
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

Content`;

      mockFs.readFileSync.mockReturnValue(mockContent);

      getLegalDocument("test.md");

      const expectedPath = path.join(
        process.cwd(),
        "content",
        "legal",
        "test.md",
      );

      expect(mockFs.readFileSync).toHaveBeenCalledWith(expectedPath, "utf8");
    });

    it("should handle complex markdown content", () => {
      const mockContent = `---
title: Complex Document
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

# Heading 1

## Heading 2

- List item 1
- List item 2

**Bold text** and *italic text*.

\`\`\`javascript
const code = "example";
\`\`\`

[Link](https://example.com)`;

      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = getLegalDocument("complex.md");

      expect(result.content).toContain("# Heading 1");
      expect(result.content).toContain("## Heading 2");
      expect(result.content).toContain("- List item 1");
      expect(result.content).toContain("**Bold text**");
      expect(result.content).toContain("const code = \"example\";");
      expect(result.content).toContain("[Link](https://example.com)");
    });

    it("should handle frontmatter with additional fields", () => {
      const mockContent = `---
title: Extended Document
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
author: "Legal Team"
version: "1.0"
---

Content here`;

      mockFs.readFileSync.mockReturnValue(mockContent);

      const result = getLegalDocument("extended.md");

      expect(result.frontmatter).toMatchObject({
        title: "Extended Document",
        lastUpdated: "2024-01-01",
        effectiveDate: "2024-01-01",
      });
    });
  });

  describe("getAllLegalDocuments", () => {
    it("should return list of markdown files", () => {
      const mockFiles = [
        "privacy.md",
        "terms.md",
        "cookies.md",
        "README.txt",
        "index.html",
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = getAllLegalDocuments();

      expect(result).toEqual(["privacy.md", "terms.md", "cookies.md"]);
      expect(mockFs.readdirSync).toHaveBeenCalledWith(
        path.join(process.cwd(), "content", "legal"),
      );
    });

    it("should filter out non-markdown files", () => {
      const mockFiles = [
        "document.md",
        "image.png",
        "script.js",
        "style.css",
        "data.json",
      ];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = getAllLegalDocuments();

      expect(result).toEqual(["document.md"]);
    });

    it("should return empty array if no markdown files found", () => {
      const mockFiles = ["README.txt", "image.png", "data.json"];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = getAllLegalDocuments();

      expect(result).toEqual([]);
    });

    it("should return empty array on read error", () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Directory not found");
      });

      const result = getAllLegalDocuments();

      expect(result).toEqual([]);
    });

    it("should log error when directory read fails", () => {
      const consoleErrorSpy = jest.spyOn(console, "error");

      mockFs.readdirSync.mockImplementation(() => {
        throw new Error("Directory not found");
      });

      getAllLegalDocuments();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error reading legal documents directory:",
        expect.any(Error),
      );
    });

    it("should handle empty directory", () => {
      mockFs.readdirSync.mockReturnValue([] as any);

      const result = getAllLegalDocuments();

      expect(result).toEqual([]);
    });

    it("should handle directory with only markdown files", () => {
      const mockFiles = ["privacy.md", "terms.md", "cookies.md"];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = getAllLegalDocuments();

      expect(result).toEqual(mockFiles);
    });

    it("should check the correct directory path", () => {
      mockFs.readdirSync.mockReturnValue([]);

      getAllLegalDocuments();

      const expectedPath = path.join(process.cwd(), "content", "legal");

      expect(mockFs.readdirSync).toHaveBeenCalledWith(expectedPath);
    });

    it("should handle files with .MD extension (case sensitivity)", () => {
      const mockFiles = ["document.md", "TERMS.MD", "Privacy.Md"];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const result = getAllLegalDocuments();

      // Only lowercase .md files should be included
      expect(result).toEqual(["document.md"]);
    });
  });

  describe("Integration", () => {
    it("should be able to read all documents returned by getAllLegalDocuments", () => {
      const mockFiles = ["privacy.md", "terms.md"];

      mockFs.readdirSync.mockReturnValue(mockFiles as any);

      const allDocs = getAllLegalDocuments();

      expect(allDocs).toHaveLength(2);

      // Mock content for each file
      mockFs.readFileSync.mockImplementation((filePath: any) => {
        const filename = path.basename(filePath);

        if (filename === "privacy.md") {
          return `---
title: Privacy Policy
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

Privacy content`;
        }
        if (filename === "terms.md") {
          return `---
title: Terms of Service
lastUpdated: "2024-01-01"
effectiveDate: "2024-01-01"
---

Terms content`;
        }

        throw new Error(`Unexpected file: ${filename}`);
      });

      allDocs.forEach((filename) => {
        const doc = getLegalDocument(filename);

        expect(doc).toHaveProperty("frontmatter");
        expect(doc).toHaveProperty("content");
        expect(doc.frontmatter).toHaveProperty("title");
      });
    });
  });
});
