"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";

/** How long the button says «Copiato» before going back (ms). */
const COPIED_MS = 1800;

export interface CopyCommandProps {
  /** Small label above the block. */
  label: string;
  /** One shell command per line, copied joined by newlines. */
  lines: readonly string[];
  copy: string;
  copied: string;
}

/**
 * A terminal block with the commands to run and a copy button, like the install box of Hermes Agent. Copying sends
 * `self_host_command_copied`; without the clipboard API (old browsers, insecure origin) the button does nothing and
 * the text stays selectable.
 */
export function CopyCommand({ label, lines, copy, copied }: CopyCommandProps) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => setDone(false), COPIED_MS);
    return () => window.clearTimeout(t);
  }, [done]);

  const onCopy = async () => {
    try {
      if (!navigator.clipboard) return;
      await navigator.clipboard.writeText(lines.join("\n"));
      setDone(true);
      track("self_host_command_copied");
    } catch {
      // permission denied: the text stays selectable
    }
  };

  return (
    <div className="cmd">
      <div className="cmd-bar">
        <span>{label}</span>
        <button type="button" onClick={onCopy} aria-live="polite">
          {done ? <Check aria-hidden="true" size={14} strokeWidth={2.25} /> : <Copy aria-hidden="true" size={14} strokeWidth={2} />}
          {done ? copied : copy}
        </button>
      </div>
      <pre>
        <code>{lines.map((line) => `$ ${line}`).join("\n")}</code>
      </pre>
    </div>
  );
}
