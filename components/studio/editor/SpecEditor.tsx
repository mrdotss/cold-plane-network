"use client";

import { useCallback, useEffect, useRef } from "react";

interface SpecEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** Line number to scroll to (1-based). */
  scrollToLine?: number;
}

export function SpecEditor({ value, onChange, scrollToLine }: SpecEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Scroll to a specific line when scrollToLine changes
  useEffect(() => {
    if (scrollToLine && textareaRef.current) {
      const lineHeight = 20; // approximate
      textareaRef.current.scrollTop = (scrollToLine - 1) * lineHeight;
    }
  }, [scrollToLine]);

  return (
    <div className="h-full flex flex-col">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        spellCheck={false}
        aria-label="Spec editor"
        placeholder={`resources:\n  - name: production\n    type: vpc\n    properties:\n      cidr: "10.0.0.0/16"\n    children:\n      - name: web-tier\n        type: subnet\n        properties:\n          cidr: "10.0.1.0/24"`}
        className="flex-1 w-full resize-none bg-background p-3 font-mono text-sm leading-5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none border-0"
      />
    </div>
  );
}
