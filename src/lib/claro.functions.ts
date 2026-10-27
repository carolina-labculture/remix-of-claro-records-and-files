import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { queryOptions } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

export const getClaro = createServerFn({ method: 'GET' }).handler(async () => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error('Não foi possível conectar aos dados.');
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } },
  });
  const [people, workspaces, members, folders, documents, versions, clients, suppliers, invoices, favorites, audit] = await Promise.all([
    db.from('people').select('*').order('name'), db.from('workspaces').select('*').order('created_at'),
    db.from('workspace_members').select('*'), db.from('folders').select('*').order('name'),
    db.from('documents').select('*').order('updated_at', { ascending: false }),
    db.from('document_versions').select('*').order('version', { ascending: false }),
    db.from('clients').select('*').order('name'), db.from('suppliers').select('*').order('name'),
    db.from('invoices').select('*').order('created_at', { ascending: false }), db.from('favorites').select('*'),
    db.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  for (const result of [people, workspaces, members, folders, documents, versions, clients, suppliers, invoices, favorites, audit]) {
    if (result.error) throw new Error('Não foi possível carregar os dados. Tente novamente.');
  }
  return { people: people.data ?? [], workspaces: workspaces.data ?? [], members: members.data ?? [], folders: folders.data ?? [], documents: documents.data ?? [], versions: versions.data ?? [], clients: clients.data ?? [], suppliers: suppliers.data ?? [], invoices: invoices.data ?? [], favorites: favorites.data ?? [], audit: audit.data ?? [] };
});
export const claroQuery = queryOptions({ queryKey: ['claro'], queryFn: () => getClaro() });
export type ClaroData = Awaited<ReturnType<typeof getClaro>>;