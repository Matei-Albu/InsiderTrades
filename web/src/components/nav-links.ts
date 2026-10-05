export const NAV_LINKS = [
  { href: "/", label: "Live feed" },
  { href: "/congress", label: "Congress" },
  { href: "/clusters", label: "Cluster buys" },
  { href: "/institutions", label: "Institutions" },
  { href: "/watchlist", label: "Watchlist" },
] as const;

/** Whether a nav link should render as active for the current pathname. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
