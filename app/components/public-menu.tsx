"use client";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Phone navigation for the information pages, whose header links hide below
// 760px (marketing.css). The homepage has its own, with in-page links.
export default function PublicMenu({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="pw-mobile-menu-trigger" aria-label="Open navigation">
          <Menu size={20} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="pw-mobile-menu"
        align="end"
        sideOffset={10}
      >
        {links.map((link) => (
          <DropdownMenuItem asChild key={link.href}>
            <Link href={link.href}>{link.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
