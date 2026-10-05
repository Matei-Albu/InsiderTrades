import Link from "next/link";
import Brand from "@/components/Brand";
import { NAV_LINKS } from "@/components/nav-links";

export default function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex max-w-sm flex-col gap-3">
          <Brand />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Data from SEC EDGAR Form 4, 13F filings and House STOCK Act
            disclosures. Filings can lag trades by up to 2 business days. Not
            investment advice.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
