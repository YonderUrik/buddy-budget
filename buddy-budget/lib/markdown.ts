import fs from "fs";
import path from "path";

import matter from "gray-matter";

export interface LegalDocumentFrontmatter {
  title: string;
  lastUpdated: string;
  effectiveDate: string;
}

export interface LegalDocument {
  frontmatter: LegalDocumentFrontmatter;
  content: string;
}

/**
 * Reads a markdown file from the content/legal directory
 * and parses frontmatter + content
 */
export function getLegalDocument(filename: string): LegalDocument {
  const contentDir = path.join(process.cwd(), "content", "legal");
  const filePath = path.join(contentDir, filename);

  try {
    const fileContents = fs.readFileSync(filePath, "utf8");
    const { data, content } = matter(fileContents);

    return {
      frontmatter: data as LegalDocumentFrontmatter,
      content: content.trim(),
    };
  } catch (error) {
    console.error(`Error reading legal document ${filename}:`, error);
    throw new Error(`Failed to load legal document: ${filename}`);
  }
}

/**
 * Gets all available legal documents
 */
export function getAllLegalDocuments(): string[] {
  const contentDir = path.join(process.cwd(), "content", "legal");

  try {
    const files = fs.readdirSync(contentDir);

    return files.filter((file) => file.endsWith(".md"));
  } catch (error) {
    console.error("Error reading legal documents directory:", error);

    return [];
  }
}
