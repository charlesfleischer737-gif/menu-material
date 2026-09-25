"use client";

export default function CustomerMenuSwitcher({
  menus,
  currentId,
  slug,
  className = "",
}: {
  menus: { id: string; name: string }[];
  currentId?: string;
  slug: string;
  className?: string;
}) {
  // Choosing a menu doesn't leave the page; "Open" does (WCAG 3.2.2).
  return (
    <nav
      className={`customer-menu-switcher ${className}`}
      aria-label="Our menus"
    >
      <form action={`/m/${encodeURIComponent(slug)}`} method="get">
        <label>
          <span>Menu</span>
          <select
            name="menu"
            aria-label="Choose a menu"
            defaultValue={currentId || menus[0]?.id || ""}
          >
            {menus.map((menu) => (
              <option key={menu.id} value={menu.id}>
                {menu.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Open</button>
      </form>
    </nav>
  );
}
