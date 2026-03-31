"use client";

import { CodeMirrorEditor } from "./CodeMirrorEditor";

interface SpecEditorProps {
  value: string;
  onChange: (text: string) => void;
  /** Line number to scroll to (1-based). */
  scrollToLine?: number;
}

export function SpecEditor({ value, onChange, scrollToLine }: SpecEditorProps) {
  return (
    <div className="h-full flex flex-col">
      <CodeMirrorEditor
        value={value}
        onChange={onChange}
        scrollToLine={scrollToLine}
      />
    </div>
  );
}
