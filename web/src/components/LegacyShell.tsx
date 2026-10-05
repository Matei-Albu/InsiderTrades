/**
 * Container for pages that haven't been remodelled yet (they used to get this
 * from the root layout). Delete this and the per-route `layout.tsx` files that
 * re-export it as each page is ported to the new design.
 */
export default function LegacyShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">{children}</main>
  );
}
