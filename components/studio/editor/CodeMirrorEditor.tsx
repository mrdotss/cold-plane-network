"use client";

import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { yaml } from "@codemirror/lang-yaml";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  scrollToLine?: number;
  className?: string;
}

export function CodeMirrorEditor({ value, onChange, scrollToLine, className }: CodeMirrorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track whether we're currently applying an external update
  const isExternalUpdate = useRef(false);

  const createExtensions = useCallback(() => {
    return [
      yaml(),
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      drawSelection(),
      rectangularSelection(),
      bracketMatching(),
      foldGutter(),
      indentOnInput(),
      closeBrackets(),
      autocompletion(),
      highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([...defaultKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isExternalUpdate.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
          backgroundColor: "#ffffff",
          color: "#1e293b",
        },
        ".cm-scroller": {
          overflow: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        },
        ".cm-content": {
          padding: "8px 0",
          caretColor: "#1e293b",
        },
        ".cm-gutters": {
          borderRight: "1px solid #e2e8f0",
          backgroundColor: "#f8fafc",
          color: "#94a3b8",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#f1f5f9",
          color: "#475569",
        },
        ".cm-activeLine": {
          backgroundColor: "#f1f5f9",
        },
        ".cm-selectionBackground": {
          backgroundColor: "#bfdbfe !important",
        },
        "&.cm-focused .cm-selectionBackground": {
          backgroundColor: "#93c5fd !important",
        },
        ".cm-cursor": {
          borderLeftColor: "#1e293b",
        },
      }),
    ];
  }, []);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: createExtensions(),
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  // Scroll to line when scrollToLine changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !scrollToLine || scrollToLine < 1) return;

    const lineCount = view.state.doc.lines;
    const targetLine = Math.min(scrollToLine, lineCount);
    const line = view.state.doc.line(targetLine);

    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      selection: { anchor: line.from },
    });
  }, [scrollToLine]);

  return (
    <div
      ref={containerRef}
      className={`h-full w-full overflow-hidden ${className ?? ""}`}
    />
  );
}
