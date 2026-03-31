/**
 * Surgical YAML string mutation utilities.
 * Operates on raw text to avoid full YAML reformatting.
 */

/**
 * Add a `connectTo` entry for `targetName` to the resource block named `sourceName`.
 * If the resource already has a `connectTo` list, appends to it.
 * If not, inserts a new `connectTo` block after the resource's existing fields.
 * Returns the mutated YAML string, or the original if the resource is not found
 * or the target already exists in connectTo.
 */
export function addConnectTo(
  yamlText: string,
  sourceName: string,
  targetName: string
): string {
  const lines = yamlText.split("\n");

  // Find the resource block: look for `- name: <sourceName>`
  let resourceLineIdx = -1;
  let resourceIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)- name:\s*(.+)$/);
    if (match && match[2].trim() === sourceName) {
      resourceLineIdx = i;
      resourceIndent = match[1].length;
      break;
    }
  }

  if (resourceLineIdx === -1) return yamlText;

  // Determine the block extent and find connectTo within it
  const blockContentIndent = resourceIndent + 2; // properties are indented 2 more than the `- `
  let blockEnd = resourceLineIdx + 1;
  let connectToLineIdx = -1;
  let connectToLastItemIdx = -1;

  for (let i = resourceLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // Empty line — continue (may be within block)
    if (line.trim() === "") {
      blockEnd = i + 1;
      continue;
    }

    // Check indent — if same or less indent than the `- name:` marker, we've left the block
    const lineIndent = line.search(/\S/);
    if (lineIndent <= resourceIndent) break;

    blockEnd = i + 1;

    // Check for connectTo key
    const connectToMatch = line.match(/^(\s*)connectTo:\s*$/);
    if (connectToMatch && connectToMatch[1].length === blockContentIndent) {
      connectToLineIdx = i;
      connectToLastItemIdx = i;

      // Scan connectTo list items
      for (let j = i + 1; j < lines.length; j++) {
        const itemLine = lines[j];
        if (itemLine.trim() === "") continue;
        const itemIndent = itemLine.search(/\S/);
        if (itemIndent <= blockContentIndent) break;
        if (itemLine.trim().startsWith("- ")) {
          connectToLastItemIdx = j;
          // Check for duplicate
          const existingTarget = itemLine.trim().replace(/^- /, "").trim();
          if (existingTarget === targetName) return yamlText; // already exists
        }
        blockEnd = j + 1;
      }
    }
  }

  const itemIndent = " ".repeat(blockContentIndent + 2);

  if (connectToLineIdx !== -1) {
    // Append to existing connectTo list
    const newLine = `${itemIndent}- ${targetName}`;
    lines.splice(connectToLastItemIdx + 1, 0, newLine);
  } else {
    // Insert new connectTo block before the block end
    const keyIndent = " ".repeat(blockContentIndent);
    const newLines = [
      `${keyIndent}connectTo:`,
      `${itemIndent}- ${targetName}`,
    ];
    lines.splice(blockEnd, 0, ...newLines);
  }

  return lines.join("\n");
}
