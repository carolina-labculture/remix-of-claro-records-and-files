import { createFileRoute } from '@tanstack/react-router';
import { ClaroApp, ClaroError } from '@/components/claro-app';
import { claroQuery } from '@/lib/claro.functions';
export const Route = createFileRoute('/busca')({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === 'string' ? s.q : '', sort: typeof s.sort === 'string' ? s.sort : 'recent', filter: typeof s.filter === 'string' ? s.filter : 'all', folder: typeof s.folder === 'string' ? s.folder : '' }),
  loader: ({ context }) => context.queryClient.ensureQueryData(claroQuery),
  head: () => ({ meta: [{ title: 'Busca · Claro' }, { name: 'description', content: 'Busca: documentos e registros organizados no Claro.' }, { property: 'og:title', content: 'Busca · Claro' }, { property: 'og:description', content: 'Busca: documentos e registros organizados no Claro.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Page,
  errorComponent: ClaroError,
  notFoundComponent: () => <div className="p-8">Não encontrado.</div>,
});
function Page() { const search = Route.useSearch(); return <ClaroApp view="search" q={search.q} sort={search.sort} filter={search.filter} folderId={search.folder} />; }
