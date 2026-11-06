/**
 * A strict, dependency-free reader for the XML Interactive Brokers' Flex Web Service returns. Flex documents are
 * elements with attributes, a few with text content (`<Status>Success</Status>`), no namespaces, CDATA or DTDs.
 * Anything outside that shape (a DOCTYPE, an unclosed tag, a stray `<`) throws instead of being guessed.
 */

export interface XmlElement {
  name: string;
  attributes: Record<string, string>;
  children: XmlElement[];
  /** Concatenated text directly inside the element, entities decoded and trimmed. */
  text: string;
}

export class XmlParseError extends Error {
  constructor(message: string) { super(message); this.name = "XmlParseError"; }
}

const NAME = /^[A-Za-z_][\w.-]*/;
const ATTRIBUTE = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/;
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };

function decode(raw: string): string {
  return raw.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) throw new XmlParseError("Invalid character reference");
      return String.fromCodePoint(code);
    }
    const value = ENTITIES[entity];
    if (value === undefined) throw new XmlParseError("Unknown entity");
    return value;
  });
}

/** Parse a document and return its single root element. */
export function parseXml(source: string): XmlElement {
  const text = source.replace(/^﻿/, "");
  let position = 0;
  const stack: XmlElement[] = [];
  let root: XmlElement | null = null;
  const fail = (message: string): never => { throw new XmlParseError(`${message} at offset ${position}`); };

  while (position < text.length) {
    const next = text.indexOf("<", position);
    const chunk = next === -1 ? text.slice(position) : text.slice(position, next);
    if (chunk.trim()) {
      if (!stack.length) fail("Text outside the root element");
      stack.at(-1)!.text += decode(chunk);
    }
    if (next === -1) break;
    position = next;
    if (text.startsWith("<?", position)) {
      const end = text.indexOf("?>", position);
      if (end === -1) fail("Unclosed processing instruction");
      position = end + 2;
    } else if (text.startsWith("<!--", position)) {
      const end = text.indexOf("-->", position);
      if (end === -1) fail("Unclosed comment");
      position = end + 3;
    } else if (text.startsWith("<!", position)) {
      fail("DOCTYPE and CDATA are not supported");
    } else if (text.startsWith("</", position)) {
      const match = NAME.exec(text.slice(position + 2));
      if (!match) fail("Invalid closing tag");
      const end = text.indexOf(">", position);
      if (end === -1 || text.slice(position + 2 + match![0].length, end).trim()) fail("Invalid closing tag");
      const open = stack.pop();
      if (!open || open.name !== match![0]) fail("Mismatched closing tag");
      open!.text = open!.text.trim();
      position = end + 1;
    } else {
      const match = NAME.exec(text.slice(position + 1));
      if (!match) fail("Invalid tag");
      const element: XmlElement = { name: match![0], attributes: {}, children: [], text: "" };
      position += 1 + match![0].length;
      for (;;) {
        const rest = text.slice(position, position + 4096);
        const attribute = ATTRIBUTE.exec(rest);
        if (attribute) {
          if (attribute[1] in element.attributes) fail("Duplicate attribute");
          const value = attribute[3] ?? attribute[4] ?? "";
          if (value.includes("<")) fail("Invalid attribute value");
          element.attributes[attribute[1]] = decode(value);
          position += attribute[0].length;
          continue;
        }
        const close = /^\s*(\/?)>/.exec(rest);
        if (!close) fail("Invalid attribute or unclosed tag");
        position += close![0].length;
        if (stack.length) stack.at(-1)!.children.push(element);
        else if (root) fail("More than one root element");
        else root = element;
        if (!close![1]) stack.push(element);
        break;
      }
    }
  }
  if (stack.length) fail("Unclosed element");
  if (!root) throw new XmlParseError("Empty document");
  return root;
}

/** Direct children with a given name. */
export function childrenNamed(element: XmlElement, name: string): XmlElement[] {
  return element.children.filter((child) => child.name === name);
}

/** The first direct child with a given name, if any. */
export function childNamed(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((child) => child.name === name);
}
