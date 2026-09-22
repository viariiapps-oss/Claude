import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border/70 pb-24 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">
            Independent analytics for Roblox experiences. Not affiliated with, endorsed or sponsored by Roblox Corporation.
          </p>
          <p className="mt-3 max-w-sm text-xs text-subtle">
            Revenue figures are <strong className="text-muted">estimates</strong> derived from public data and documented assumptions — never official revenue.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-subtle">Product</p>
          <ul className="mt-3 space-y-2 text-sm">
            {siteConfig.nav.slice(0, 6).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-muted hover:text-fg">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-subtle">Company</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/about" className="text-muted hover:text-fg">About & data sources</Link></li>
            <li><Link href="/about#methodology" className="text-muted hover:text-fg">Revenue methodology</Link></li>
            <li><Link href="/about#privacy" className="text-muted hover:text-fg">Privacy</Link></li>
            <li><Link href="/about#api" className="text-muted hover:text-fg">API</Link></li>
            <li><Link href="/admin" className="text-muted hover:text-fg">Admin</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-subtle">
        © {new Date().getFullYear()} {siteConfig.name}. Roblox is a trademark of Roblox Corporation.
      </div>
    </footer>
  );
}
