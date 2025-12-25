"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({
  content,
  className = "",
}: MarkdownContentProps) {
  // Custom component renderers to match brand styling
  const components: Components = {
    h1: ({ children, ...props }) => (
      <h1
        className="text-4xl font-bold mb-6 bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent scroll-mt-24"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => {
      const id = String(children).toLowerCase().replace(/\s+/g, "-");

      return (
        <h2
          className="text-3xl font-bold mt-10 mb-4 text-default-900 dark:text-default-400 scroll-mt-24"
          id={id}
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3: ({ children, ...props }) => {
      const id = String(children).toLowerCase().replace(/\s+/g, "-");

      return (
        <h3
          className="text-2xl font-semibold mt-8 mb-3 text-default-800 dark:text-default-400 scroll-mt-24"
          id={id}
          {...props}
        >
          {children}
        </h3>
      );
    },
    a: ({ children, href, ...props }) => (
      <a
        className="text-brand-blue-500 dark:text-brand-blue-400 hover:text-brand-blue-600 dark:hover:text-brand-blue-300 underline font-medium transition-colors"
        href={href}
        rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
        target={href?.startsWith("http") ? "_blank" : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ children, ...props }) => (
      <ul className="my-6 ml-6 list-disc space-y-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-6 ml-6 list-decimal space-y-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li
        className="text-default-700 dark:text-default-400 leading-relaxed"
        {...props}
      >
        {children}
      </li>
    ),
    p: ({ children, ...props }) => (
      <p
        className="my-4 text-default-700 dark:text-default-400 leading-relaxed"
        {...props}
      >
        {children}
      </p>
    ),
    strong: ({ children, ...props }) => (
      <strong
        className="font-semibold text-default-900 dark:text-default-400"
        {...props}
      >
        {children}
      </strong>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-brand-blue-500 dark:border-brand-blue-400 pl-4 my-6 italic text-default-600 dark:text-default-200 bg-default-50 dark:bg-default-50/5 py-2 rounded-r-lg"
        {...props}
      >
        {children}
      </blockquote>
    ),
    code: ({ children, className, ...props }) => {
      const isInline = !className;

      return isInline ? (
        <code
          className="bg-default-100 dark:bg-default-100/10 px-1.5 py-0.5 rounded text-sm font-mono text-brand-blue-600 dark:text-brand-blue-400"
          {...props}
        >
          {children}
        </code>
      ) : (
        <code
          className={`block bg-default-100 dark:bg-default-100/10 p-4 rounded-lg overflow-x-auto text-sm font-mono ${className}`}
          {...props}
        >
          {children}
        </code>
      );
    },
    table: ({ children, ...props }) => (
      <div className="my-6 overflow-x-auto">
        <table
          className="min-w-full divide-y divide-default-200 dark:divide-default-100"
          {...props}
        >
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="px-4 py-3 text-left text-sm font-semibold text-default-900 dark:text-default-400 bg-default-100 dark:bg-default-100/10"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className="px-4 py-3 text-sm text-default-700 dark:text-default-400 border-t border-default-200 dark:border-default-100"
        {...props}
      >
        {children}
      </td>
    ),
  };

  return (
    <div className={`prose prose-lg dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        components={components}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
