"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { LogOut, Menu, Star } from "lucide-react";
import Brand from "@/components/Brand";
import { PersonAvatar } from "@/components/media";
import { NAV_LINKS, isActivePath } from "@/components/nav-links";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export default function SiteHeaderClient({
  email,
  watchCount,
  signOutAction,
}: {
  email: string | null;
  watchCount: number;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Brand />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    active && "bg-secondary text-foreground",
                  )}
                >
                  {item.label}
                  {item.href === "/watchlist" && email && watchCount > 0 && (
                    <span className="rounded-sm bg-primary px-1 font-mono text-[10px] text-primary-foreground">
                      {watchCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {email ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex items-center gap-2 rounded-full p-0.5 pr-3 hover:bg-secondary"
                aria-label="Account menu"
              >
                <PersonAvatar name={email} size="sm" />
                <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
                  {email.split("@")[0]}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col">
                    <span className="text-xs font-normal text-muted-foreground">
                      Signed in as
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {email}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/watchlist" />}>
                  <Star /> Watchlist
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => startTransition(() => signOutAction())}
                >
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login" className={buttonVariants()}>
              Sign in
            </Link>
          )}

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent className="w-72">
              <SheetHeader>
                <SheetTitle>
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="Mobile" className="flex flex-col gap-1 px-4">
                {NAV_LINKS.map((item) => (
                  <SheetClose
                    key={item.href}
                    render={
                      <Link
                        href={item.href}
                        className={cn(
                          "rounded-md px-3 py-2.5 text-sm font-medium",
                          isActivePath(pathname, item.href)
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground",
                        )}
                      />
                    }
                  >
                    {item.label}
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
