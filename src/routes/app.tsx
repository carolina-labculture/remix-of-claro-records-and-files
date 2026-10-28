import { createFileRoute } from '@tanstack/react-router';
import { ClaroApp, ClaroError } from '@/components/claro-app';
import { claroQuery } from '@/lib/claro.functions';

export const Route = createFileRoute('/app')({
  loader: ({ context }) => context.queryClient.ensureQueryData(claroQuery),
  head: () => ({ meta: [
    { title: 'Claro · App' },
    { name: 'description', content: 'Seus documentos e registros na versão app do Claro.' },
    { property: 'og:title', content: 'Claro · App' },
    { property: 'og:description', content: 'Seus documentos e registros na versão app do Claro.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: () => <ClaroApp view="home" preferredLayout="app" />,
  errorComponent: ClaroError,
});