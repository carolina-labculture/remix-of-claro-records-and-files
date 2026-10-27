import { describe, it, expect } from 'vitest';
import { validateFile, canMoveFolder, visibleInbox } from '@/lib/claro-rules';
describe('Phase 1 rules', () => {
  it('accepts 50 MB and rejects larger uploads', () => {
    expect(() => validateFile(50 * 1024 * 1024)).not.toThrow();
    expect(() => validateFile(50 * 1024 * 1024 + 1)).toThrow();
  });
  it('prevents moving a folder inside itself or a descendant', () => {
    const folders = [{ id: 'a', parent_id: null }, { id: 'b', parent_id: 'a' }];
    expect(canMoveFolder('a', 'b', folders)).toBe(false);
    expect(canMoveFolder('a', 'a', folders)).toBe(false);
    expect(canMoveFolder('b', null, folders)).toBe(true);
  });
  it('shows only the selected simulated person inbox', () => {
    expect(visibleInbox([{ folder_id: null, owner_id: 'Ana', archived_at: null }, { folder_id: null, owner_id: 'Bruno', archived_at: null }, { folder_id: 'a', owner_id: 'Ana', archived_at: null }], 'Ana')).toHaveLength(1);
  });
});