import type { Metadata } from "next";
import ClusterCard from "@/components/ClusterCard";
import PageHeader from "@/components/PageHeader";
import {
  clusterKey,
  getClusterBuys,
  getClusterInsiders,
  getUserWatchlist,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cluster Buys" };

export default async function ClustersPage() {
  const clusters = await getClusterBuys();
  const [insiders, { user, watched }] = await Promise.all([
    getClusterInsiders(clusters),
    getUserWatchlist(),
  ]);

  return (
    <main>
      <PageHeader
        eyebrow="Signal · 2+ insiders within 14 days"
        title="Cluster buys"
        description="When several insiders at the same company buy on the open market within two weeks, it's one of the strongest signals in the filings."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {clusters.length === 0 ? (
          <p className="rounded-lg border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
            No clusters yet. Check back after the next ingest run.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clusters.map((c) => (
              <ClusterCard
                key={clusterKey(c)}
                cluster={c}
                buys={insiders.get(clusterKey(c)) ?? []}
                watching={!!c.ticker && watched.has(c.ticker)}
                signedIn={!!user}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
