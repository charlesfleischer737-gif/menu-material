import { UtensilsCrossed } from "lucide-react";
import { money, Row } from "@/lib/client";
export default function MenuView({
  menu,
  slug,
  preview = false,
}: {
  menu: Row;
  slug?: string;
  preview?: boolean;
}) {
  return (
    <article className="customer-menu">
      <header>
        {preview && <p className="eyebrow">PRIVATE PREVIEW</p>}
        {menu.restaurant.logoId ? (
          <img
            className="menu-logo"
            src={
              preview
                ? `/api/assets/${menu.restaurant.logoId}`
                : `/api/public/${slug}/assets/${menu.restaurant.logoId}`
            }
            alt="Restaurant logo"
          />
        ) : (
          <UtensilsCrossed className="menu-mark" />
        )}
        <h1>{menu.restaurant.name}</h1>
        <p>{menu.restaurant.cuisine}</p>
      </header>
      {menu.sections.map((section: Row) => (
        <section key={section.id}>
          <h2>{section.name}</h2>
          {section.items.map((dish: Row, index: number) => (
            <div
              className={"customer-dish " + (!dish.available ? "sold-out" : "")}
              key={dish.id + index}
            >
              <div>
                <div className="dish-title">
                  <h3>{dish.name}</h3>
                  <span>{money(dish.price, menu.restaurant.currency)}</span>
                </div>
                <p>{dish.description}</p>
                {!dish.available && (
                  <span className="tag">Currently unavailable</span>
                )}
              </div>
              {dish.photoId && (
                <img
                  src={
                    preview
                      ? `/api/assets/${dish.photoId}`
                      : `/api/public/${slug}/assets/${dish.photoId}`
                  }
                  alt={dish.name}
                />
              )}
            </div>
          ))}
        </section>
      ))}
      <footer>Made with Plateworthy</footer>
    </article>
  );
}
