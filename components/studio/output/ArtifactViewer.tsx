"use client";

import { useState, useMemo, useCallback } from "react";
import type { ArtifactManifest, ArtifactFile } from "@/lib/contracts/artifact-manifest";
import { cn } from "@/lib/utils";

interface ArtifactViewerProps {
  artifacts: ArtifactManifest | null;
}

/* ------------------------------------------------------------------ */
/*  Tree data structure                                                */
/* ------------------------------------------------------------------ */

interface TreeNode {
  name: string;
  /** Full path if this is a file node. */
  path?: string;
  children: TreeNode[];
  isDirectory: boolean;
}

/** Build a tree from flat file paths. */
function buildFileTree(files: ArtifactFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        // File node
        current.push({ name: segment, path: file.path, children: [], isDirectory: false });
      } else {
        // Directory — find or create
        let dir = current.find((n) => n.isDirectory && n.name === segment);
        if (!dir) {
          dir = { name: segment, children: [], isDirectory: true };
          current.push(dir);
        }
        current = dir.children;
      }
    }
  }

  // Sort: directories first, then files, alphabetically within each group
  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.isDirectory) sortNodes(n.children);
    }
  }
  sortNodes(root);
  return root;
}

/* ------------------------------------------------------------------ */
/*  Tree node component                                                */
/* ------------------------------------------------------------------ */

function FileTreeNode({
  node,
  depth,
  activePath,
  expandedDirs,
  onSelectFile,
  onToggleDir,
}: {
  node: TreeNode;
  depth: number;
  activePath: string | undefined;
  expandedDirs: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleDir: (dirKey: string) => void;
}) {
  const paddingLeft = 8 + depth * 12;

  if (node.isDirectory) {
    const dirKey = `${depth}:${node.name}`;
    const isExpanded = expandedDirs.has(dirKey);

    return (
      <>
        <button
          onClick={() => onToggleDir(dirKey)}
          className="flex items-center gap-1 w-full text-left text-xs py-0.5 px-1 hover:bg-muted/50 rounded text-muted-foreground"
          style={{ paddingLeft }}
        >
          <span className="text-[10px] w-3 text-center shrink-0">
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="truncate font-medium">{node.name}/</span>
        </button>
        {isExpanded &&
          node.children.map((child, i) => (
            <FileTreeNode
              key={child.path ?? `${dirKey}/${child.name}/${i}`}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              expandedDirs={expandedDirs}
              onSelectFile={onSelectFile}
              onToggleDir={onToggleDir}
            />
          ))}
      </>
    );
  }

  // File node
  const isActive = node.path === activePath;
  return (
    <button
      onClick={() => node.path && onSelectFile(node.path)}
      className={cn(
        "flex items-center gap-1 w-full text-left text-xs py-0.5 px-1 rounded truncate",
        isActive
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50"
      )}
      style={{ paddingLeft: paddingLeft + 14 }}
    >
      <span className="text-[10px] shrink-0">📄</span>
      <span className="truncate">{node.name}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

/** Threshold: if file count is this or fewer, show flat tabs instead of tree. */
const FLAT_TAB_THRESHOLD = 6;

export function ArtifactViewer({ artifacts }: ArtifactViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  const tree = useMemo(
    () => (artifacts ? buildFileTree(artifacts.files) : []),
    [artifacts]
  );

  // Auto-expand all directories on first render / when artifacts change
  const allDirKeys = useMemo(() => {
    const keys = new Set<string>();
    function collect(nodes: TreeNode[], depth: number) {
      for (const n of nodes) {
        if (n.isDirectory) {
          keys.add(`${depth}:${n.name}`);
          collect(n.children, depth + 1);
        }
      }
    }
    collect(tree, 0);
    return keys;
  }, [tree]);

  // Auto-expand dirs when artifacts change
  useState(() => {
    setExpandedDirs(allDirKeys);
  });

  const handleToggleDir = useCallback((dirKey: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirKey)) {
        next.delete(dirKey);
      } else {
        next.add(dirKey);
      }
      return next;
    });
  }, []);

  if (!artifacts) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
        No artifacts generated yet — click Generate
      </div>
    );
  }

  const activeFile =
    artifacts.files.find((f) => f.path === selectedFile) ?? artifacts.files[0];

  const useTreeLayout = artifacts.files.length > FLAT_TAB_THRESHOLD;

  return (
    <div className="flex flex-col h-full">
      {/* Warnings banner */}
      {artifacts.warnings.length > 0 && (
        <div className="shrink-0 border-b bg-yellow-50 dark:bg-yellow-900/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400">
          {artifacts.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}

      {useTreeLayout ? (
        /* -------- Tree + Content layout -------- */
        <div className="flex-1 flex min-h-0">
          {/* Tree sidebar */}
          <div className="shrink-0 w-[180px] border-r overflow-y-auto py-1">
            {tree.map((node, i) => (
              <FileTreeNode
                key={node.path ?? `root-${node.name}-${i}`}
                node={node}
                depth={0}
                activePath={activeFile?.path}
                expandedDirs={allDirKeys} // keep all expanded by default for tree view
                onSelectFile={setSelectedFile}
                onToggleDir={handleToggleDir}
              />
            ))}
          </div>

          {/* File content */}
          <div className="flex-1 min-w-0 overflow-auto">
            {activeFile && (
              <>
                <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b px-2 py-1 text-[10px] font-mono text-muted-foreground">
                  {activeFile.path}
                </div>
                <pre className="p-2 text-xs font-mono leading-5 text-foreground whitespace-pre-wrap">
                  {activeFile.content}
                </pre>
              </>
            )}
          </div>
        </div>
      ) : (
        /* -------- Flat tabs layout (for small file count) -------- */
        <>
          <div className="shrink-0 flex gap-0.5 border-b px-1 py-1 overflow-x-auto">
            {artifacts.files.map((f) => (
              <button
                key={f.path}
                onClick={() => setSelectedFile(f.path)}
                className={cn(
                  "rounded px-2 py-0.5 text-xs whitespace-nowrap transition-colors",
                  activeFile?.path === f.path
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {f.path}
              </button>
            ))}
          </div>

          {activeFile && (
            <div className="flex-1 overflow-auto">
              <pre className="p-2 text-xs font-mono leading-5 text-foreground whitespace-pre-wrap">
                {activeFile.content}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Stats bar */}
      <div className="shrink-0 border-t px-2 py-1 text-[10px] text-muted-foreground flex gap-3">
        <span>{artifacts.stats.totalFiles} files</span>
        <span>{(artifacts.stats.totalSizeBytes / 1024).toFixed(1)} KB</span>
        <span>{artifacts.stats.generatorDurationMs}ms</span>
      </div>
    </div>
  );
}
