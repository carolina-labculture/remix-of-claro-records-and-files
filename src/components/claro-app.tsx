import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowRight, Archive, Building2, Camera, Check, ChevronDown, ChevronRight, CircleHelp, File, FileText, Folder, FolderOpen, History, Home, Inbox, LayoutGrid, List, Loader2, Menu, MoreHorizontal, Plus, Search, Star, Trash2, Upload, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { claroQuery, type ClaroData } from '@/lib/claro.functions';
import { canMoveFolder, validateFile, visibleInbox } from '@/lib/claro-rules';
import type { Tables } from '@/integrations/supabase/types';
import desk from '@/assets/desk.jpg';

export type View = 'home' | 'inbox' | 'files' | 'clients' | 'suppliers' | 'sales' | 'purchases' | 'search' | 'history' | 'settings';
type RecordKind = 'clients' | 'suppliers' | 'sales' | 'purchases';
type RecordItem = Tables<'clients'> | Tables<'suppliers'> | Tables<'invoices'>;
type Modal = { type: 'folder'; item?: Tables<'folders'> } | { type: 'record'; kind: RecordKind; item?: RecordItem } | { type: 'upload'; doc?: Tables<'documents'> } | { type: 'document'; id: string } | { type: 'workspace' } | { type: 'move'; item: Tables<'folders'> | Tables<'documents'>; kind: 'folder' | 'document' } | { type: 'confirm'; title: string; action: () => Promise<void> };
const navigation = [
  { view: 'home', to: '/', label: 'Início', icon: Home },
  { view: 'inbox', to: '/inbox', label: 'Inbox', icon: Inbox },
  { view: 'files', to: '/arquivo', label: 'Arquivo', icon: FolderOpen },
  { view: 'clients', to: '/clientes', label: 'Clientes', icon: Users },
  { view: 'suppliers', to: '/fornecedores', label: 'Fornecedores', icon: Building2 },
  { view: 'sales', to: '/vendas', label: 'Faturas de venda', icon: FileText },
  { view: 'purchases', to: '/compras', label: 'Faturas de compra', icon: FileText },
  { view: 'history', to: '/historico', label: 'Histórico', icon: History },
  { view: 'settings', to: '/ajustes', label: 'Área de trabalho', icon: LayoutGrid },
] as const;
const titles: Record<View, string> = { home: 'Início', inbox: 'Inbox', files: 'Arquivo', clients: 'Clientes', suppliers: 'Fornecedores', sales: 'Faturas de venda', purchases: 'Faturas de compra', search: 'Busca', history: 'Histórico de atividades', settings: 'Área de trabalho' };
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const date = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const statusLabels: Record<string, string> = { open: 'Em aberto', paid: 'Paga', draft: 'Rascunho', cancelled: 'Cancelada' };
const meta = (doc: Tables<'documents'>, key: string) => typeof doc.metadata === 'object' && doc.metadata && !Array.isArray(doc.metadata) ? String(doc.metadata[key] ?? '') : '';
function must<T>(result: { data: T; error: { message: string } | null }): T { if (result.error) throw new Error(result.error.message); return result.data; }
export function ClaroError() {
  const router = useRouter();
  return <div className="p-12 text-center"><h1 className="text-xl font-semibold">Não foi possível abrir o Claro</h1><Button className="mt-5" onClick={() => router.invalidate()}>Tentar novamente</Button></div>;
}
export function ClaroApp({ view, q = '', sort = 'recent', filter = 'all', folderId = '' }: { view: View; q?: string; sort?: string; filter?: string; folderId?: string }) {
  const { data } = useSuspenseQuery(claroQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [personId, setPerson] = useState('');
  const [workspaceId, setWorkspace] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [busy, setBusy] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [grid, setGrid] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [rowMenu, setRowMenu] = useState('');
  const [preview, setPreview] = useState('');
  const [draftSearch, setDraftSearch] = useState(q);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const person = data.people.find(p => p.id === personId) ?? data.people[0];
  const pid = person?.id ?? '';
  const areas = data.workspaces.filter(w => data.members.some(m => m.workspace_id === w.id && m.person_id === pid));
  const workspace = areas.find(w => w.id === workspaceId) ?? areas[0];
  const wid = workspace?.id ?? '';
  const folders = data.folders.filter(f => f.workspace_id === wid);
  const docs = data.documents.filter(d => d.workspace_id === wid);
  const inbox = visibleInbox(docs, pid);
  const favorites = data.favorites.filter(f => f.person_id === pid);
  const activeFolder = folders.find(f => f.id === folderId);
  const favoriteFolders = folders.filter(f => !f.archived_at && favorites.some(x => x.item_id === f.id));
  const clients = data.clients.filter(c => c.workspace_id === wid);
  const suppliers = data.suppliers.filter(c => c.workspace_id === wid);
  const invoices = data.invoices.filter(i => i.workspace_id === wid);
  useEffect(() => { setPerson(localStorage.getItem('claro-person') ?? ''); setWorkspace(localStorage.getItem('claro-workspace') ?? ''); }, []);
  useEffect(() => { setDraftSearch(q); }, [q]);
  const document = modal?.type === 'document' ? data.documents.find(d => d.id === modal.id) : undefined;
  useEffect(() => {
    let live = true;
    setPreview('');
    const version = document && data.versions.find(v => v.document_id === document.id);
    if (version) supabase.storage.from('files').createSignedUrl(version.storage_path, 3600).then(result => { if (live && result.data) setPreview(result.data.signedUrl); });
    return () => { live = false; };
  }, [document?.id, document?.current_version, data.versions]);
  function choosePerson(id: string) { setPerson(id); localStorage.setItem('claro-person', id); setUserMenu(false); }
  function chooseArea(id: string) { setWorkspace(id); localStorage.setItem('claro-workspace', id); updateSearch({ folder: '' }); }
  function updateSearch(values: { q?: string; sort?: string; filter?: string; folder?: string }) {
    navigate({ to: '.', search: (previous: Record<string, unknown>) => ({ ...previous, ...values }) });
  }
  async function refresh() { await qc.invalidateQueries({ queryKey: ['claro'] }); }
  async function audit(action: string, entity_type: string, entity_id: string | null, entity_label: string, workspace = wid) {
    must(await supabase.from('audit_log').insert({ action, entity_type, entity_id, entity_label, actor_id: pid || null, workspace_id: workspace || null }));
  }
  async function run(action: () => Promise<void>, success = 'Alteração salva', close = true) {
    setBusy(true);
    try { await action(); await refresh(); toast.success(success); if (close) setModal(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  async function favorite(kind: 'folder' | 'document', id: string, name: string) {
    await run(async () => {
      if (favorites.some(f => f.item_id === id)) must(await supabase.from('favorites').delete().eq('person_id', pid).eq('item_id', id).eq('item_type', kind));
      else must(await supabase.from('favorites').insert({ person_id: pid, item_id: id, item_type: kind }));
      await audit('alterou favorito', kind, id, name);
    }, 'Favoritos atualizados', false);
  }
  async function archiveFolder(f: Tables<'folders'>) {
    await run(async () => { must(await supabase.from('folders').update({ archived_at: f.archived_at ? null : new Date().toISOString() }).eq('id', f.id)); await audit(f.archived_at ? 'restaurou' : 'arquivou', 'folder', f.id, f.name); }, f.archived_at ? 'Pasta restaurada' : 'Pasta arquivada');
  }
  function deleteFolder(f: Tables<'folders'>) {
    setModal({ type: 'confirm', title: `Excluir a pasta “${f.name}”?`, action: async () => {
      if (folders.some(x => x.parent_id === f.id) || docs.some(x => x.folder_id === f.id) || [...clients, ...suppliers, ...invoices].some(x => x.folder_id === f.id)) throw new Error('Mova os itens ou desvincule o cadastro antes de excluir a pasta.');
      must(await supabase.from('favorites').delete().eq('item_type', 'folder').eq('item_id', f.id));
      must(await supabase.from('folders').delete().eq('id', f.id)); await audit('excluiu', 'folder', f.id, f.name);
    } });
  }
  async function download(doc: Tables<'documents'>, version?: Tables<'document_versions'>) {
    await run(async () => {
      const v = version ?? data.versions.find(v => v.document_id === doc.id);
      let blob: Blob;
      let filename = v?.file_name ?? `${doc.name}.txt`;
      if (v) blob = must(await supabase.storage.from('files').download(v.storage_path)) as Blob;
      else { const content = meta(doc, 'sample_content'); if (!content) throw new Error('Este documento ainda não tem arquivo.'); blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); }
      const url = URL.createObjectURL(blob); const a = window.document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      await audit('baixou', 'document', doc.id, doc.name);
    }, 'Download iniciado', false);
  }
  async function upload(file: File, existing?: Tables<'documents'>) {
    await run(async () => {
      validateFile(file.size);
      if (!wid || !pid) throw new Error('Crie uma área de trabalho antes de enviar.');
      const id = existing?.id ?? crypto.randomUUID();
      const version = (existing?.current_version ?? 0) + 1;
      const path = `${wid}/${id}/${crypto.randomUUID()}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      must(await supabase.storage.from('files').upload(path, file));
      try {
        if (!existing) must(await supabase.from('documents').insert({ id, workspace_id: wid, name: file.name, owner_id: pid, mime_type: file.type || 'application/octet-stream', folder_id: view === 'files' ? folderId || null : null }));
        must(await supabase.from('document_versions').insert({ document_id: id, version, storage_path: path, file_name: file.name, mime_type: file.type || 'application/octet-stream', size_bytes: file.size, uploaded_by: pid }));
        must(await supabase.from('documents').update({ current_version: version, mime_type: file.type || 'application/octet-stream', updated_at: new Date().toISOString() }).eq('id', id));
      } catch (e) { await supabase.storage.from('files').remove([path]); if (!existing) await supabase.from('documents').delete().eq('id', id); throw e; }
      await audit(existing ? 'enviou nova versão' : 'enviou', 'document', id, existing?.name ?? file.name);
    }, existing ? 'Nova versão salva' : 'Arquivo enviado');
  }
  async function saveForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    const val = (key: string) => String(fields.get(key) ?? '').trim();
    const current = modal;
    await run(async () => {
      if (current?.type === 'folder') {
        const name = val('name');
        if (!name) throw new Error('Informe o nome da pasta.');
        let id = current.item?.id;
        if (id) must(await supabase.from('folders').update({ name }).eq('id', id));
        else id = must(await supabase.from('folders').insert({ name, workspace_id: wid, parent_id: folderId || null, created_by: pid }).select('id').single()).id;
        await audit(current.item ? 'renomeou' : 'criou', 'folder', id ?? null, name);
      } else if (current?.type === 'workspace') {
        const name = val('name'); if (!name) throw new Error('Informe o nome da área.');
        const created = must(await supabase.from('workspaces').insert({ name }).select('id').single());
        must(await supabase.from('workspace_members').insert(data.people.filter(p => fields.getAll('members').includes(p.id) || p.id === pid).map(p => ({ workspace_id: created.id, person_id: p.id, role: 'editor' }))));
        setWorkspace(created.id); localStorage.setItem('claro-workspace', created.id); await audit('criou', 'workspace', created.id, name, created.id);
      } else if (current?.type === 'move') {
        const target = val('target') || null;
        if (current.kind === 'folder') {
          if (!canMoveFolder(current.item.id, target, folders)) throw new Error('Uma pasta não pode ficar dentro dela mesma.');
          must(await supabase.from('folders').update({ parent_id: target }).eq('id', current.item.id));
        } else must(await supabase.from('documents').update({ folder_id: target, updated_at: new Date().toISOString() }).eq('id', current.item.id));
        await audit('moveu', current.kind, current.item.id, current.item.name);
      } else if (current?.type === 'record') {
        const isInvoice = current.kind === 'sales' || current.kind === 'purchases';
        const name = val(isInvoice ? 'number' : 'name'); if (!name) throw new Error('Preencha o nome ou número.');
        let id = current.item?.id;
        let recordFolder = current.item?.folder_id;
        if (!recordFolder) recordFolder = must(await supabase.from('folders').insert({ workspace_id: wid, name, created_by: pid, entity_type: current.kind }).select('id').single()).id;
        if (isInvoice) {
          const values = { workspace_id: wid, kind: current.kind === 'sales' ? 'sale' : 'purchase', number: name, amount: Number(val('amount')), issue_date: val('issue_date'), due_date: val('due_date') || null, status: val('status'), notes: val('notes'), client_id: current.kind === 'sales' ? val('party') || null : null, supplier_id: current.kind === 'purchases' ? val('party') || null : null, folder_id: recordFolder, updated_at: new Date().toISOString() };
          if (id) must(await supabase.from('invoices').update(values).eq('id', id)); else id = must(await supabase.from('invoices').insert(values).select('id').single()).id;
        } else {
          const values = { workspace_id: wid, name, tax_id: val('tax_id'), email: val('email'), phone: val('phone'), city: val('city'), notes: val('notes'), folder_id: recordFolder, updated_at: new Date().toISOString() };
          if (id) must(await supabase.from(current.kind === 'clients' ? 'clients' : 'suppliers').update(values).eq('id', id));
          else id = must(await supabase.from(current.kind === 'clients' ? 'clients' : 'suppliers').insert(values).select('id').single()).id;
        }
        must(await supabase.from('folders').update({ entity_id: id }).eq('id', recordFolder));
        await audit(current.item ? 'editou' : 'criou', current.kind, id ?? null, name);
      } else if (current?.type === 'document' && document) {
        must(await supabase.from('documents').update({ name: val('name'), metadata: { ...(typeof document.metadata === 'object' && document.metadata && !Array.isArray(document.metadata) ? document.metadata : {}), tags: val('tags') }, updated_at: new Date().toISOString() }).eq('id', document.id));
        await audit('editou', 'document', document.id, val('name'));
      }
    });
  }
  const matches = (item: unknown) => JSON.stringify(item).toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR'));
  const sortItems = <T extends { name?: string; number?: string; created_at: string }>(items: T[]) => [...items].sort((a, b) => sort === 'name' ? (a.name ?? a.number ?? '').localeCompare(b.name ?? b.number ?? '') : sort === 'oldest' ? a.created_at.localeCompare(b.created_at) : b.created_at.localeCompare(a.created_at));
  const listingFolders = folders.filter(f => matches(f) && (filter === 'archived' ? !!f.archived_at : !f.archived_at) && (filter === 'favorites' ? favorites.some(x => x.item_id === f.id) : f.parent_id === (folderId || null)));
  const listingDocs = (view === 'inbox' ? inbox : docs.filter(d => d.folder_id === (folderId || null) && (d.folder_id || d.owner_id === pid))).filter(d => matches(d) && (filter === 'archived' ? !!d.archived_at : !d.archived_at));
  const records = sortItems((view === 'clients' ? clients : view === 'suppliers' ? suppliers : invoices.filter(i => i.kind === (view === 'sales' ? 'sale' : 'purchase'))) as RecordItem[]).filter(item => matches(item) && (filter === 'all' || ('status' in item ? item.status === filter : item.city === filter)));
  function goFolder(id: string) { navigate({ to: '/arquivo', search: { folder: id } }); setModal(null); }
  function sectionHeading(title: string, link?: () => void) { return <div className="section-heading"><h2>{title}</h2>{link && <Button variant="ghost" size="sm" onClick={link}>Ver todos <ArrowRight /></Button>}</div>; }
  function docRows(items: Tables<'documents'>[]) {
    if (!items.length) return <Empty icon={FileText} title="Nenhum documento por aqui" />;
    return <div className={grid ? 'document-grid' : 'document-list'}>{items.map(d => <div key={d.id} className="document-row">
      <Button variant="ghost" className="document-open" onClick={() => setModal({ type: 'document', id: d.id })}><span className={`file-icon ${d.mime_type?.startsWith('image') ? 'image-file' : ''}`}><FileText /></span><span className="min-w-0 text-left"><strong className="block truncate">{d.name}</strong><span className="block text-xs font-normal text-muted-foreground">{folders.find(f => f.id === d.folder_id)?.name ?? 'Inbox'} · {d.current_version ? `v${d.current_version}` : 'Exemplo'}</span></span></Button>
      <span className="row-date">{date(d.updated_at)}</span><span className="row-owner"><span className="mini-avatar">{data.people.find(p => p.id === d.owner_id)?.name.charAt(0)}</span>{data.people.find(p => p.id === d.owner_id)?.name.split(' ')[0]}</span>
      <Button variant="ghost" size="icon" title="Favoritar documento" aria-label={`Favoritar ${d.name}`} className={favorites.some(f => f.item_id === d.id) ? 'text-primary' : 'text-muted-foreground'} onClick={() => favorite('document', d.id, d.name)}><Star className={favorites.some(f => f.item_id === d.id) ? 'fill-current' : ''} /></Button>
    </div>)}</div>;
  }
  function folderCards(items: Tables<'folders'>[]) { return <div className="folder-grid">{items.map((f, index) => <div className={`folder-item tone-${index % 4}`} key={f.id}>
    <div className="flex items-center justify-between"><Folder className="folder-symbol" /><Button size="icon" variant="ghost" title="Opções da pasta" aria-label={`Opções de ${f.name}`} onClick={() => setRowMenu(rowMenu === f.id ? '' : f.id)}><MoreHorizontal /></Button></div>
    <Button variant="ghost" className="folder-name" onClick={() => goFolder(f.id)}>{f.name}</Button><div className="folder-meta"><span>{docs.filter(d => d.folder_id === f.id).length} documentos</span><Button variant="ghost" size="icon" title="Favoritar pasta" onClick={() => favorite('folder', f.id, f.name)}><Star className={favorites.some(x => x.item_id === f.id) ? 'fill-current text-primary' : ''} /></Button></div>
    {rowMenu === f.id && <div className="row-menu"><Button variant="ghost" onClick={() => { setModal({ type: 'folder', item: f }); setRowMenu(''); }}>Renomear</Button><Button variant="ghost" onClick={() => { setModal({ type: 'move', item: f, kind: 'folder' }); setRowMenu(''); }}>Mover</Button><Button variant="ghost" onClick={() => { archiveFolder(f); setRowMenu(''); }}>{f.archived_at ? 'Restaurar' : 'Arquivar'}</Button><Button variant="ghost" className="text-destructive" onClick={() => { deleteFolder(f); setRowMenu(''); }}>Excluir</Button></div>}
  </div>)}</div>; }
  return <div className="app-shell">
    <aside className={`app-sidebar ${mobileMenu ? 'is-open' : ''}`}>
      <Link to="/" className="brand"><span className="brand-mark"><FolderOpen /></span>claro<span className="brand-dot">.</span></Link>
      <div className="workspace-picker"><span className="workspace-icon">{workspace?.name.charAt(0) ?? 'C'}</span><label className="min-w-0 flex-1"><span className="block text-[10px] uppercase text-muted-foreground">Área de trabalho</span><select aria-label="Área de trabalho" value={wid} onChange={e => chooseArea(e.target.value)}>{areas.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}{!areas.length && <option value="">Criar uma área</option>}</select></label><ChevronDown className="size-3 text-muted-foreground" /></div>
      <nav className="sidebar-nav">{navigation.map((n, i) => <div key={n.view}>{i === 3 && <div className="nav-label">REGISTROS</div>}{i === 7 && <div className="nav-divider" />}<Button variant="ghost" asChild className={`nav-link ${view === n.view ? 'active' : ''}`}><Link to={n.to} onClick={() => setMobileMenu(false)}><n.icon />{n.label}{n.view === 'inbox' && inbox.length > 0 && <span className="nav-count">{inbox.length}</span>}</Link></Button></div>)}</nav>
      <div className="sidebar-bottom"><div className="demo-indicator"><span />Modo de demonstração</div><p>Sem login. Não envie dados sigilosos.</p><Button variant="ghost" asChild className="w-full justify-start"><Link to="/ajustes"><CircleHelp />Sobre esta área</Link></Button></div>
      <Button className="mobile-menu-close" variant="ghost" size="icon" onClick={() => setMobileMenu(false)} aria-label="Fechar menu"><X /></Button>
    </aside>
    {mobileMenu && <div className="menu-backdrop" onClick={() => setMobileMenu(false)} />}
    <div className="app-main">
      <header className="app-header"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="mobile-menu-trigger" onClick={() => setMobileMenu(true)} aria-label="Abrir menu"><Menu /></Button><span className="header-location">{workspace?.name ?? 'Claro'}<ChevronRight /> <strong>{titles[view]}</strong></span></div>
        <div className="header-actions"><Button variant="ghost" size="icon" title="Buscar" asChild><Link to="/busca"><Search /></Link></Button><span className="header-divider" /><div className="user-picker"><Button variant="ghost" className="user-button" onClick={() => setUserMenu(!userMenu)}><span className="avatar">{person?.name.charAt(0) ?? 'A'}</span><span className="user-name">{person?.name.split(' ')[0]}</span><ChevronDown className="size-3" /></Button>{userMenu && <div className="user-menu">{data.people.map(p => <Button variant="ghost" key={p.id} className="w-full justify-start" onClick={() => choosePerson(p.id)}><span className="mini-avatar">{p.name.charAt(0)}</span><span>{p.name}<small className="block text-left text-muted-foreground">{p.role_title}</small></span>{pid === p.id && <Check className="ml-auto" />}</Button>)}</div>}</div></div>
      </header>
      <main className="page-content">
        {view === 'home' ? <>
          <div className="page-heading"><div><div className="eyebrow">SEU ESPAÇO, EM ORDEM</div><h1>Olá, {person?.name.split(' ')[0] ?? 'bem-vinda'} <span className="greeting-dot">☀</span></h1><p>Um novo dia para deixar tudo no lugar.</p></div><Button className="upload-cta" onClick={() => setModal({ type: 'upload' })} disabled={!wid}><Plus />Enviar documento</Button></div>
          <section className="home-banner"><img src={desk} width={1536} height={512} alt="Documentos organizados em uma pasta verde" /><div><span className="eyebrow">MENOS RUÍDO. MAIS CLAREZA.</span><h2>Tudo o que importa,<br />no mesmo lugar.</h2><Button variant="link" onClick={() => navigate({ to: '/arquivo' })}>Abrir meu arquivo <ArrowRight /></Button></div></section>
          <div className="summary-grid"><Button variant="ghost" className="summary-item" onClick={() => navigate({ to: '/inbox' })}><span className="summary-icon inbox-tone"><Inbox /></span><span><strong>{inbox.length}</strong><small>Na sua inbox</small></span><ChevronRight /></Button><Button variant="ghost" className="summary-item" onClick={() => navigate({ to: '/arquivo' })}><span className="summary-icon files-tone"><FileText /></span><span><strong>{docs.filter(d => !d.archived_at).length}</strong><small>Documentos</small></span><ChevronRight /></Button><Button variant="ghost" className="summary-item" onClick={() => navigate({ to: '/vendas' })}><span className="summary-icon invoice-tone"><FileText /></span><span><strong>{invoices.filter(i => i.status === 'open').length}</strong><small>Faturas em aberto</small></span><ChevronRight /></Button></div>
          <section>{sectionHeading('Sempre à mão', () => navigate({ to: '/arquivo', search: { filter: 'favorites' } }))}{favoriteFolders.length ? folderCards(favoriteFolders) : <Empty icon={Star} title="Seus favoritos aparecem aqui" />}</section>
          <section className="recent-section">{sectionHeading('Documentos recentes', () => navigate({ to: '/arquivo' }))}<div className="list-header"><span>DOCUMENTO</span><span>ATUALIZADO</span><span>ENVIADO POR</span><span /></div>{docRows(docs.filter(d => !d.archived_at && (d.folder_id || d.owner_id === pid)).slice(0, 5))}</section>
          <div className="home-foot"><span><span className="status-dot" />Tudo salvo no seu espaço</span><span>Claro · Simples por natureza</span></div>
        </> : <>
          <div className="page-heading"><div><div className="eyebrow">{view === 'clients' || view === 'suppliers' || view === 'sales' || view === 'purchases' ? 'REGISTROS' : workspace?.name ?? 'CLARO'}</div><h1>{activeFolder && view === 'files' ? activeFolder.name : titles[view]}</h1><p>{view === 'inbox' ? `${inbox.length} documentos aguardando classificação` : view === 'files' ? 'Cada documento no seu lugar.' : view === 'history' ? 'O que aconteceu por aqui.' : view === 'settings' ? 'Pessoas e preferências do seu espaço.' : view === 'search' ? 'Encontre documentos, pastas e registros.' : `${records.length} registros nesta área`}</p></div>
            {view === 'files' && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setModal({ type: 'folder' })} disabled={!wid}><Folder />Nova pasta</Button><Button onClick={() => setModal({ type: 'upload' })} disabled={!wid}><Upload />Enviar</Button></div>}
            {view === 'inbox' && <Button onClick={() => setModal({ type: 'upload' })} disabled={!wid}><Plus />Enviar documento</Button>}
            {(['clients', 'suppliers', 'sales', 'purchases'] as string[]).includes(view) && <Button disabled={!wid} onClick={() => setModal({ type: 'record', kind: view as RecordKind })}><Plus />{view === 'clients' ? 'Novo cliente' : view === 'suppliers' ? 'Novo fornecedor' : 'Nova fatura'}</Button>}
            {view === 'settings' && <Button onClick={() => setModal({ type: 'workspace' })}><Plus />Nova área</Button>}
          </div>
          {!['settings', 'history'].includes(view) && <div className="filter-bar"><form onSubmit={e => { e.preventDefault(); updateSearch({ q: draftSearch }); }} className="search-field"><Search /><input aria-label="Buscar nesta lista" placeholder={view === 'search' ? 'Buscar em toda a área...' : 'Buscar por nome...'} value={draftSearch} onChange={e => { setDraftSearch(e.target.value); updateSearch({ q: e.target.value }); }} /></form>{view !== 'search' && <><select aria-label="Filtrar" value={filter} onChange={e => updateSearch({ filter: e.target.value })}><option value="all">Todos</option>{view === 'files' ? <><option value="favorites">Favoritos</option><option value="archived">Arquivados</option></> : view === 'sales' || view === 'purchases' ? Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>) : view === 'clients' || view === 'suppliers' ? [...new Set((view === 'clients' ? clients : suppliers).map(c => c.city).filter(Boolean))].map(city => <option key={city} value={city ?? ''}>{city}</option>) : null}</select><select aria-label="Ordenar" value={sort} onChange={e => updateSearch({ sort: e.target.value })}><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option><option value="oldest">Mais antigos</option></select>{(view === 'files' || view === 'inbox') && <Button variant="ghost" size="icon" title={grid ? 'Ver lista' : 'Ver grade'} onClick={() => setGrid(!grid)}>{grid ? <List /> : <LayoutGrid />}</Button>}</>}</div>}
          {view === 'files' && <><div className="breadcrumbs"><Button variant="link" onClick={() => updateSearch({ folder: '' })}>Arquivo</Button>{activeFolder && <><ChevronRight /><Button variant="link" onClick={() => updateSearch({ folder: activeFolder.parent_id ?? '' })}>{activeFolder.parent_id ? folders.find(f => f.id === activeFolder.parent_id)?.name : 'Raiz'}</Button><ChevronRight /><span>{activeFolder.name}</span></>}</div>{folderCards(sortItems(listingFolders))}{docRows(sortItems(listingDocs))}</>}
          {view === 'inbox' && docRows(sortItems(listingDocs))}
          {(['clients', 'suppliers', 'sales', 'purchases'] as string[]).includes(view) && <div className="records-table">{records.length ? records.map(item => <Button variant="ghost" className="record-row" key={item.id} onClick={() => setModal({ type: 'record', kind: view as RecordKind, item })}><span className="record-symbol">{'number' in item ? <FileText /> : <Building2 />}</span><span className="record-main"><strong>{'number' in item ? item.number : item.name}</strong><small>{'number' in item ? clients.find(c => c.id === item.client_id)?.name ?? suppliers.find(s => s.id === item.supplier_id)?.name ?? 'Sem vínculo' : item.email || item.tax_id || 'Sem contato'}</small></span>{'amount' in item ? <><span className="record-amount">{money(item.amount)}<small>{item.due_date ? `Vence ${date(item.due_date)}` : 'Sem vencimento'}</small></span><span className={`status-badge status-${item.status}`}>{statusLabels[item.status]}</span></> : <span className="record-city">{item.city || '—'}</span>}<ChevronRight /></Button>) : <Empty icon={Users} title="Nenhum registro encontrado" />}</div>}
          {view === 'search' && <div className="search-results">{!q ? <Empty icon={Search} title="O que você está procurando?" /> : <>{sectionHeading('Documentos')}{docRows(docs.filter(d => !d.archived_at && matches(d) && (d.folder_id || d.owner_id === pid)))}{sectionHeading('Pastas')}{folderCards(folders.filter(f => !f.archived_at && matches(f)))}{sectionHeading('Registros')}{[...clients, ...suppliers, ...invoices].filter(matches).map(item => <Button key={item.id} variant="ghost" className="record-row" onClick={() => setModal({ type: 'record', kind: 'kind' in item ? item.kind === 'sale' ? 'sales' : 'purchases' : clients.some(c => c.id === item.id) ? 'clients' : 'suppliers', item })}><FileText />{'number' in item ? item.number : item.name}<ChevronRight /></Button>)}</>}</div>}
          {view === 'history' && <div className="activity-list">{data.audit.filter(a => a.workspace_id === wid && matches(a)).map(a => <div className="activity-row" key={a.id}><span className="avatar">{data.people.find(p => p.id === a.actor_id)?.name.charAt(0) ?? 'C'}</span><div><strong>{data.people.find(p => p.id === a.actor_id)?.name ?? 'Claro'}</strong> {a.action} <strong>{a.entity_label}</strong><small>{new Date(a.created_at).toLocaleString('pt-BR')}</small></div></div>)}{!data.audit.some(a => a.workspace_id === wid) && <Empty icon={History} title="Ainda não há atividades" />}</div>}
          {view === 'settings' && <div className="settings-sections"><section><h2>Pessoas nesta área</h2>{data.people.filter(p => data.members.some(m => m.workspace_id === wid && m.person_id === p.id)).map(p => <div className="member-row" key={p.id}><span className="avatar">{p.name.charAt(0)}</span><div><strong>{p.name}</strong><small>{p.role_title}</small></div><span className="status-badge">Pessoa de exemplo</span></div>)}</section><section><h2>Acesso sem login</h2><p>As pessoas e suas áreas são simuladas. Qualquer pessoa com o link pode acessar e alterar os dados. Não utilize documentos confidenciais.</p></section><section><h2>Dados de exemplo</h2><p>Remova os exemplos de uma vez. Seus documentos e cadastros serão preservados.</p><Button variant="outline" className="text-destructive" onClick={() => setModal({ type: 'confirm', title: 'Remover todos os dados de exemplo?', action: async () => { must(await supabase.rpc('clear_sample_data')); await audit('removeu exemplos', 'workspace', null, 'Dados de exemplo', ''); } })}><Trash2 />Remover exemplos</Button></section></div>}
        </>}
      </main>
    </div>
    <nav className="mobile-bottom"><Button variant="ghost" asChild className={view === 'home' ? 'text-primary' : ''}><Link to="/"><Home /><span>Início</span></Link></Button><Button variant="ghost" asChild><Link to="/inbox"><Inbox /><span>Inbox</span></Link></Button><Button className="capture-button" size="icon" title="Capturar documento" onClick={() => setModal({ type: 'upload' })}><Plus /></Button><Button variant="ghost" asChild><Link to="/busca"><Search /><span>Busca</span></Link></Button><Button variant="ghost" onClick={() => setMobileMenu(true)}><Menu /><span>Menu</span></Button></nav>
    <input hidden type="file" ref={fileRef} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, modal?.type === 'upload' ? modal.doc : undefined); e.target.value = ''; }} />
    <input hidden type="file" accept="image/*" capture="environment" ref={cameraRef} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, modal?.type === 'upload' ? modal.doc : undefined); e.target.value = ''; }} />
    <Dialog open={!!modal} onOpenChange={open => { if (!open && !busy) setModal(null); }}><DialogContent className={modal?.type === 'document' ? 'document-dialog' : 'app-dialog'}><DialogTitle>{modal?.type === 'upload' ? modal.doc ? 'Enviar nova versão' : 'Enviar documento' : modal?.type === 'folder' ? modal.item ? 'Renomear pasta' : 'Nova pasta' : modal?.type === 'workspace' ? 'Nova área de trabalho' : modal?.type === 'record' ? modal.item ? 'Detalhes do registro' : 'Novo registro' : modal?.type === 'move' ? 'Escolher destino' : modal?.type === 'confirm' ? modal.title : document?.name ?? 'Documento'}</DialogTitle><DialogDescription className="sr-only">{modal?.type === 'upload' ? 'Escolha um arquivo do dispositivo ou tire uma foto.' : 'Consulte ou altere os dados.'}</DialogDescription>
      {modal?.type === 'upload' && <div className="upload-options"><div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !busy) upload(f, modal.doc); }}><Upload /><h3>{busy ? 'Enviando...' : 'Seu próximo documento começa aqui'}</h3><span>Arquivos de até 50 MB</span><Button disabled={busy} onClick={() => fileRef.current?.click()}><FolderOpen />Escolher arquivo</Button></div><Button variant="outline" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera />Tirar uma foto</Button>{busy && <Loader2 className="animate-spin mx-auto" />}</div>}
      {(modal?.type === 'folder' || modal?.type === 'workspace') && <form onSubmit={saveForm} className="form-stack"><Field label="Nome" name="name" value={modal.type === 'folder' ? modal.item?.name : ''} required />{modal.type === 'workspace' && <fieldset><legend className="mb-2 text-sm font-medium">Pessoas</legend>{data.people.map(p => <label className="checkbox-line" key={p.id}><input type="checkbox" name="members" value={p.id} defaultChecked disabled={p.id === pid} />{p.name}</label>)}</fieldset>}<Button disabled={busy || (!wid && modal.type === 'folder')} type="submit">{busy ? 'Salvando...' : 'Salvar'}</Button></form>}
      {modal?.type === 'move' && <form onSubmit={saveForm} className="form-stack"><label>Destino<select className="form-input" name="target" defaultValue={modal.kind === 'folder' ? 'parent_id' in modal.item ? modal.item.parent_id ?? '' : '' : 'folder_id' in modal.item ? modal.item.folder_id ?? '' : ''}><option value="">{modal.kind === 'folder' ? 'Raiz do arquivo' : 'Inbox'}</option>{folders.filter(f => !f.archived_at && (modal.kind === 'document' || canMoveFolder(modal.item.id, f.id, folders))).map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label><Button type="submit" disabled={busy}>Mover</Button></form>}
      {modal?.type === 'confirm' && <div className="form-stack"><p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setModal(null)}>Cancelar</Button><Button variant="destructive" disabled={busy} onClick={() => run(modal.action, 'Exclusão concluída')}>{busy ? 'Aguarde...' : 'Confirmar'}</Button></div></div>}
      {modal?.type === 'record' && <RecordForm modal={modal} clients={clients} suppliers={suppliers} busy={busy} onSubmit={saveForm} onFolder={() => { if (modal.item?.folder_id) goFolder(modal.item.folder_id); else toast.info('Salve o registro para criar sua pasta.'); }} />}
      {document && <div className="document-detail"><div className="document-preview">{preview ? document.mime_type?.startsWith('image/') ? <img src={preview} alt={document.name} /> : document.mime_type === 'application/pdf' ? <iframe title="Prévia do documento" src={preview} /> : <div className="preview-placeholder"><FileText /><span>{document.name}</span><Button variant="outline" onClick={() => download(document)}><ArrowDownToLine />Baixar arquivo</Button></div> : meta(document, 'sample_content') ? <div className="sample-paper"><FileText /><pre>{meta(document, 'sample_content')}</pre><span>EXEMPLO · SEM VALOR LEGAL</span></div> : <div className="preview-placeholder"><FileText /><span>{document.current_version ? 'Carregando prévia...' : 'Sem arquivo'}</span></div>}</div><div className="document-info"><form onSubmit={saveForm} className="form-stack"><Field label="Nome" name="name" value={document.name} required /><Field label="Palavras-chave" name="tags" value={meta(document, 'tags')} /><Button type="submit" variant="outline" disabled={busy}>Salvar dados</Button></form><div className="document-actions"><Button onClick={() => download(document)} disabled={busy}><ArrowDownToLine />Baixar</Button><Button variant="outline" onClick={() => setModal({ type: 'upload', doc: document })}><Upload />Nova versão</Button><Button variant="outline" onClick={() => setModal({ type: 'move', kind: 'document', item: document })}><Folder />{document.folder_id ? 'Mover' : 'Classificar'}</Button><Button variant="ghost" onClick={() => run(async () => { must(await supabase.from('documents').update({ archived_at: document.archived_at ? null : new Date().toISOString() }).eq('id', document.id)); await audit(document.archived_at ? 'restaurou' : 'arquivou', 'document', document.id, document.name); }, 'Documento atualizado')}><Archive />{document.archived_at ? 'Restaurar' : 'Arquivar'}</Button></div><h3>Histórico de versões</h3>{data.versions.filter(v => v.document_id === document.id).map(v => <div className="version-row" key={v.id}><div><strong>Versão {v.version}</strong><small>{date(v.created_at)} · {((v.size_bytes ?? 0) / 1024).toFixed(0)} KB</small></div><Button variant="ghost" size="icon" title={`Baixar versão ${v.version}`} onClick={() => download(document, v)}><ArrowDownToLine /></Button></div>)}{document.current_version === 0 && <p className="text-sm text-muted-foreground">Documento de exemplo. Envie um arquivo para iniciar o histórico.</p>}</div></div>}
    </DialogContent></Dialog>
  </div>;
}
function Field({ label, name, value = '', type = 'text', required = false }: { label: string; name: string; value?: string | number | null; type?: string; required?: boolean }) { return <label className="field-label">{label}<input className="form-input" name={name} defaultValue={value ?? ''} type={type} required={required} min={type === 'number' ? 0 : undefined} step={type === 'number' ? '0.01' : undefined} /></label>; }
function Empty({ icon: Icon, title }: { icon: typeof File; title: string }) { return <div className="empty-state"><Icon /><p>{title}</p></div>; }
function RecordForm({ modal, clients, suppliers, busy, onSubmit, onFolder }: { modal: Extract<Modal, { type: 'record' }>; clients: ClaroData['clients']; suppliers: ClaroData['suppliers']; busy: boolean; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onFolder: () => void }) {
  const item = modal.item;
  const invoice = item && 'amount' in item ? item : undefined;
  const contact = item && 'email' in item ? item : undefined;
  const isInvoice = modal.kind === 'sales' || modal.kind === 'purchases';
  return <form onSubmit={onSubmit} className="form-stack">
    {isInvoice ? <><Field label="Número" name="number" value={invoice?.number} required /><label className="field-label">{modal.kind === 'sales' ? 'Cliente' : 'Fornecedor'}<select name="party" className="form-input" defaultValue={invoice?.client_id ?? invoice?.supplier_id ?? ''}><option value="">Sem vínculo</option>{(modal.kind === 'sales' ? clients : suppliers).map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><div className="form-grid"><Field label="Valor (R$)" name="amount" type="number" value={invoice?.amount ?? 0} required /><label className="field-label">Situação<select className="form-input" name="status" defaultValue={invoice?.status ?? 'open'}>{Object.entries(statusLabels).map(([key, value]) => <option value={key} key={key}>{value}</option>)}</select></label><Field label="Emissão" type="date" name="issue_date" value={invoice?.issue_date ?? new Date().toISOString().slice(0, 10)} required /><Field label="Vencimento" type="date" name="due_date" value={invoice?.due_date} /></div></> : <><Field label="Nome" name="name" value={contact?.name} required /><div className="form-grid"><Field label="CPF / CNPJ" name="tax_id" value={contact?.tax_id} /><Field label="Cidade" name="city" value={contact?.city} /><Field label="E-mail" name="email" value={contact?.email} type="email" /><Field label="Telefone" name="phone" value={contact?.phone} /></div></>}
    <label className="field-label">Observações<textarea className="form-input" rows={3} name="notes" defaultValue={item?.notes ?? ''} /></label><div className="flex justify-between gap-2"><Button type="button" variant="outline" onClick={onFolder}><FolderOpen />Documentos</Button><Button disabled={busy} type="submit">{busy ? 'Salvando...' : 'Salvar registro'}</Button></div>
  </form>;
}
