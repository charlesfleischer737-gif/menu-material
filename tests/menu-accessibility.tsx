/// <reference types="vite/client" />
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import MenuDocumentView from "../app/components/menu-document-view";
import { menuDesignCollection } from "../lib/menu-design-system";
import {
  newMenuEntry,
  type DesignedMenu,
  type MenuDesignId,
} from "../lib/menu-document";
import { purposeFixtures } from "./menu-purpose-fixtures.mjs";
import "../app/globals.css";
import "../app/restaurant-look.css";
import "../app/menu-studio.css";

const fixtures = purposeFixtures();
const edge = structuredClone(fixtures[0].menu) as DesignedMenu;
edge.restaurant.name = "The Neighborhood Kitchen & Garden Room";
edge.sections[0].name = "Seasonal favorites from our neighborhood producers";
edge.sections[0].items[0] = newMenuEntry({
  name: "Slow-roasted seasonal vegetables with smoked almond dressing",
  description:
    "Roasted squash, charred cabbage, fresh herbs, preserved lemon, and toasted sourdough. Please ask your server about today's preparation.",
  priceMode: "label",
  priceLabel: "Seasonal price — ask your server",
  available: false,
  dietary: ["Contains almonds", "Vegetarian"],
});
edge.sections[0].items[1].variants = [
  { id: "small", label: "Small tasting pour", price: 450 },
  { id: "medium", label: "Regular serving", price: 800 },
  { id: "large", label: "Sharing carafe", price: 20050 },
];
fixtures.push({ key: "long-content", menu: edge });

function Harness() {
  const [fixture, setFixture] = useState("long-content");
  const [design, setDesign] = useState<MenuDesignId>("bistro");
  const [dark, setDark] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  useEffect(() => {
    document.documentElement.style.fontSize = enlarged ? "200%" : "100%";
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [enlarged]);
  const menu = {
    ...fixtures.find((f) => f.key === fixture)!.menu,
    design,
    appearance: dark ? "dark" : "light",
  } as DesignedMenu;
  return (
    <>
      <fieldset
        style={{
          font: "16px Arial",
          padding: 16,
          margin: 0,
          background: "#fff",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <legend>Local accessibility fixtures</legend>
        <label>
          Content{" "}
          <select value={fixture} onChange={(e) => setFixture(e.target.value)}>
            {fixtures.map((f) => (
              <option key={f.key}>{f.key}</option>
            ))}
          </select>
        </label>
        <label>
          Design{" "}
          <select
            value={design}
            onChange={(e) => setDesign(e.target.value as MenuDesignId)}
          >
            {menuDesignCollection.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />{" "}
          Dark appearance
        </label>
        <label>
          <input
            type="checkbox"
            checked={enlarged}
            onChange={(e) => setEnlarged(e.target.checked)}
          />{" "}
          200% text size
        </label>
      </fieldset>
      <MenuDocumentView key={`${fixture}-${design}-${dark}`} menu={menu} />
    </>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Harness />);
import.meta.hot?.dispose(() => root.unmount());
