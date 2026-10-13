/**
 * Wraps a bio in curly “quotes” for display only — the stored bio text
 * itself (in the database, in the edit box, in the 300-character count)
 * never includes them. Returns null for an empty/missing bio so callers
 * can skip rendering anything rather than showing bare quote marks.
 */
export function quoteBio(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  return `\u201C${trimmed}\u201D`;
}
