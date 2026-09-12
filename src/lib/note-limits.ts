export const NOTE_MAX_LENGTH = 2000;
export function validNoteText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= NOTE_MAX_LENGTH &&
    value.trim().length > 0
  );
}
