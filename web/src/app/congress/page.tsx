import Link from "next/link";
import type { Metadata } from "next";
import CongressTradeCard from "@/components/CongressTradeCard";
import { PartyTag, PersonAvatar } from "@/components/media";
import PageHeader from "@/components/PageHeader";
import ResultsLimit, {
  DEFAULT_RESULT_LIMIT,
  parseResultLimit,
} from "@/components/ResultsLimit";
import SegmentedLinks from "@/components/SegmentedLinks";
import {
  getCongressActivity,
  getCongressTrades,
  getPoliticians,
  getUserWatchlist,
  type CongressFilter,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Congress" };

const sides = [
  { key: "all", label: "All" },
  { key: "buys", label: "Buys" },
  { key: "sells", label: "Sells" },
] as const;

const parties = [
  { key: "", label: "Any party" },
  { key: "D", label: "Democrat" },
  { key: "R", label: "Republican" },
] as const;

type Filters = { side: string; member: string; party: string; limit: number };

function filterHref({ side, member, party, limit }: Filters) {
  const params = new URLSearchParams();
  if (side !== "all") params.set("side", side);
  if (member) params.set("member", member);
  if (party) params.set("party", party);
  if (limit !== DEFAULT_RESULT_LIMIT) params.set("limit", String(limit));
  const qs = params.toString();
  return qs ? `/congress?${qs}` : "/congress";
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CongressPage({ searchParams }: PageProps<"/congress">) {
  const params = await searchParams;
  const sideRaw = first(params.side);
  const side = (["buys", "sells", "all"].includes(String(sideRaw))
    ? sideRaw
    : "all") as CongressFilter["side"];
  const partyRaw = first(params.party);
  const party = partyRaw === "D" || partyRaw === "R" ? partyRaw : "";
  const memberRaw = first(params.member);
  const member = typeof memberRaw === "string" ? memberRaw : "";
  const limit = parseResultLimit(params.limit);
  const current: Filters = { side, member, party, limit };

  const [trades, politicians, activity, { user, watched }] = await Promise.all([
    getCongressTrades(
      { side, politician: member || undefined, party: party || undefined },
      limit,
    ),
    getPoliticians(),
    getCongressActivity(90).catch(() => new Map<string, number>()),
    getUserWatchlist(),
  ]);

  const members = [...politicians].sort(
    (a, b) => (activity.get(b.slug) ?? 0) - (activity.get(a.slug) ?? 0),
  );

  return (
    <main>
      <PageHeader
        eyebrow="STOCK Act · Periodic transaction reports"
        title="What Congress is trading"
        description="Stock trades disclosed by a curated set of House members. Amounts are reported as ranges. Members have up to 45 days to report — lags over 30 days are flagged."
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 md:px-6">
        <section aria-labelledby="members-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 id="members-heading" className="text-lg font-semibold">
              Most active · last 90 days
            </h2>
            {member && (
              <Link
                href={filterHref({ ...current, member: "" })}
                scroll={false}
                className="text-sm font-medium text-primary hover:underline"
              >
                Clear member
              </Link>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {members.map((m) => {
              const count = activity.get(m.slug) ?? 0;
              const selected = member === m.slug;
              return (
                <li key={m.id}>
                  <Link
                    href={filterHref({ ...current, member: selected ? "" : m.slug })}
                    scroll={false}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex w-full flex-col items-center gap-3 rounded-lg border bg-card px-3 py-5 text-center transition-colors hover:border-primary/50",
                      selected && "border-primary ring-1 ring-primary",
                    )}
                  >
                    <PersonAvatar name={m.name} size="xl" />
                    <span className="flex flex-col items-center gap-1">
                      <span className="text-sm font-semibold">{m.name}</span>
                      <span className="flex items-center gap-1.5">
                        <PartyTag party={m.party} state={m.state} />
                        <span className="text-xs text-muted-foreground">{m.chamber}</span>
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {count} trade{count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="disclosures-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 id="disclosures-heading" className="text-lg font-semibold">
              Latest disclosures
            </h2>
            <div className="flex flex-wrap gap-2">
              <SegmentedLinks
                label="Trade type"
                options={sides.map((s) => ({
                  key: s.key,
                  label: s.label,
                  href: filterHref({ ...current, side: s.key }),
                  active: side === s.key,
                }))}
              />
              <SegmentedLinks
                label="Party"
                options={parties.map((p) => ({
                  key: p.key || "any",
                  label: p.label,
                  href: filterHref({ ...current, party: p.key }),
                  active: party === p.key,
                }))}
              />
            </div>
          </div>

          {trades.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {trades.map((t) => (
                <CongressTradeCard
                  key={t.id}
                  trade={t}
                  watching={!!t.ticker && watched.has(t.ticker)}
                  signedIn={!!user}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
              No disclosures match these filters.
            </p>
          )}

          <ResultsLimit
            current={limit}
            shown={trades.length}
            buildHref={(n) => filterHref({ ...current, limit: n })}
          />
        </section>
      </div>
    </main>
  );
}
