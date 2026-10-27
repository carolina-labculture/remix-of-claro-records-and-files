<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Content routes share ClaroApp and load the public demo snapshot through a server function and TanStack Query; this keeps navigation and mutations consistent.
- The selected simulated person and workspace persist locally; they are presentation filters, never authentication or security boundaries.
- Store real file bytes in the files bucket and immutable document_versions rows; documents points to the current version for history and download.
- Keep folder-cycle, inbox and upload validation in claro-rules with focused tests to prevent regressions.
