import Link from "next/link";
import { ArrowLeft, Plane } from "lucide-react";
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-shell">
      <header className="page-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Plane size={20} />
          </span>
          <span>
            avi<span className="brand-light">track</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <nav>
          <Link href="/map" className="text-button">
            <ArrowLeft size={14} />
            Live map
          </Link>
          <Link href="/about/data-sources">Data sources</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>
      <div className="page-content">{children}</div>
      <footer className="page-footer">
        <span>
          Informational only. Not an approved source for flight planning,
          navigation or safety-of-flight decisions.
        </span>
        <Link href="/about/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
