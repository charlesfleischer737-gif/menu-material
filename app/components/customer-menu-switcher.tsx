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
  return (
    <nav
      className={`customer-menu-switcher ${className}`}
      aria-label="Our menus"
    >
      <label>
        <span>Menu</span>
        <select
          aria-label="Choose a menu"
          value={currentId || menus[0]?.id || ""}
          onChange={(event) => {
            window.location.assign(
              `/m/${encodeURIComponent(slug)}?menu=${encodeURIComponent(event.target.value)}`,
            );
          }}
        >
          {menus.map((menu) => (
            <option key={menu.id} value={menu.id}>
              {menu.name}
            </option>
          ))}
        </select>
      </label>
    </nav>
  );
}
