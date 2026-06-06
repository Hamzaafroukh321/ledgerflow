import { releaseInfo } from "../lib/releaseInfo";

export function ReleaseFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {releaseInfo.name} {releaseInfo.release}
        </span>
        <nav aria-label="Release resources" className="flex gap-4">
          <a className="font-semibold text-emerald-700" href={releaseInfo.docsPath}>
            API docs
          </a>
          <a className="font-semibold text-emerald-700" href={releaseInfo.openApiPath}>
            OpenAPI
          </a>
        </nav>
      </div>
    </footer>
  );
}
