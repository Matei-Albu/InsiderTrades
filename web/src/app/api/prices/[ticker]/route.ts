import { NextResponse } from "next/server";
import { fetchYahooPrices } from "@/lib/prices/yahoo";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** On-demand price bars (used for 1D intraday from the client chart). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker: raw } = await context.params;
  const ticker = decodeURIComponent(raw).toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }

  try {
    const bars = await fetchYahooPrices(ticker, "1d");
    const payload = bars
      .filter((b) => b.close != null)
      .map((b) => ({ date: b.date, close: b.close as number }));
    return NextResponse.json(payload, {
      headers: {
        // Short cache — empty results should not stick around long.
        "Cache-Control":
          payload.length > 0
            ? "public, s-maxage=60, stale-while-revalidate=300"
            : "public, s-maxage=10, stale-while-revalidate=30",
      },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
