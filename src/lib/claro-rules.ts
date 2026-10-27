export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export function validateFile(size: number) {
  if (size > MAX_FILE_BYTES) throw new Error('O arquivo deve ter até 50 MB.');
}
export function canMoveFolder(id: string, target: string | null, folders: { id: string; parent_id: string | null }[]) {
  let current = target;
  const seen = new Set<string>();
  while (current) {
    if (current === id || seen.has(current)) return false;
    seen.add(current);
    current = folders.find(f => f.id === current)?.parent_id ?? null;
  }
  return true;
}
export function visibleInbox<T extends { folder_id: string | null; owner_id: string | null; archived_at: string | null }>(docs: T[], person: string) {
  return docs.filter(d => !d.folder_id && d.owner_id === person && !d.archived_at);
}