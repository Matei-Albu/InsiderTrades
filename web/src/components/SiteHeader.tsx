import { redirect } from "next/navigation";
import SiteHeaderClient from "@/components/SiteHeaderClient";
import { createClient } from "@/lib/supabase/server";

export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let watchCount = 0;
  if (user) {
    const { count } = await supabase
      .from("watchlists")
      .select("id", { count: "exact", head: true });
    watchCount = count ?? 0;
  }

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  }

  return (
    <SiteHeaderClient
      email={user?.email ?? null}
      watchCount={watchCount}
      signOutAction={signOut}
    />
  );
}
