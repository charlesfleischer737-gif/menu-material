import {
  entryPrice,
  menuPrice,
  visibleMenuSections,
  type DesignedMenu,
  type MenuEntry,
  type MenuSection,
} from "./menu-document";
import { menuDesignSpec, menuTheme, type MenuFont } from "./menu-design-system";

export type MenuText = {
  kind: "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  font: MenuFont;
  color: string;
  align: "left" | "center" | "right";
  entryId?: string;
  sectionId?: string;
  role: string;
};
export type MenuShape = {
  kind: "line" | "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  thickness?: number;
};
export type MenuImage = {
  kind: "photo" | "logo";
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  entryId?: string;
  crop?: MenuEntry["crop"];
};
export type MenuElement = MenuText | MenuShape | MenuImage;
export type MenuPage = {
  elements: MenuElement[];
  hits: {
    entryId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
};
export type MenuLayout = {
  width: number;
  height: number;
  pages: MenuPage[];
  warnings: string[];
  columns: number;
  density: DesignedMenu["density"];
  theme: ReturnType<typeof menuTheme>;
};
export type MenuMeasure = (
  text: string,
  font: MenuFont,
  size: number,
) => number;

export function wrapMenuText(
  value: string,
  width: number,
  size: number,
  font: MenuFont,
  measure: MenuMeasure,
) {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (measure(line ? `${line} ${word}` : word, font, size) <= width) {
        line = line ? `${line} ${word}` : word;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && measure(line + character, font, size) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

/** Every coordinate is in PDF points, measured from the top of the finished page. */
export function composeMenu(
  menu: DesignedMenu,
  measure: MenuMeasure,
): MenuLayout {
  const spec = menuDesignSpec(menu.design),
    theme = menuTheme(menu);
  const width = menu.paper === "a4" ? 595.28 : 612,
    height = menu.paper === "a4" ? 841.89 : 792;
  const margin = 42,
    gap = 30,
    bodyWidth = width - margin * 2;
  const sections = visibleMenuSections(menu),
    count = sections.reduce((n, s) => n + s.items.length, 0);
  const columns = menu.columns || (count < 6 ? 1 : spec.columns),
    columnWidth = (bodyWidth - gap * (columns - 1)) / columns;
  const hero =
    menu.layout === "featured"
      ? sections
          .flatMap((s) => s.items)
          .find((i) => i.photoId && i.featured && i.available)
      : undefined;
  const logo =
    menu.showLogo && (menu.restaurant.logoId || menu.restaurant.logo_id);
  const centered = ["centered", "feature"].includes(spec.architecture);
  const street = spec.architecture === "street",
    bar = spec.architecture === "taproom",
    cocktail = spec.architecture === "cocktail",
    fresh = spec.architecture === "fresh",
    titleLed = spec.architecture === "feature" || cocktail,
    displaySection = ["poster", "street", "taproom"].includes(
      spec.architecture,
    ),
    uppercaseSection = [
      "editorial",
      "centered",
      "poster",
      "feature",
      "street",
      "taproom",
      "cocktail",
    ].includes(spec.architecture),
    priceSize = street || bar ? 14 : 11;
  const headingWidth = hero ? bodyWidth - 168 : bodyWidth;
  const nameSize = titleLed ? 14 : spec.titleSize;
  const nameFont = titleLed ? "sans" : spec.heading;
  const lines = (
    text: string,
    w: number,
    fs: number,
    font: MenuFont = "sans",
  ) => wrapMenuText(text, w, fs, font, measure);
  const nameLines = lines(
    ["poster", "street", "taproom"].includes(spec.architecture)
      ? menu.restaurant.name.toUpperCase()
      : menu.restaurant.name,
    headingWidth - (logo && !centered ? 46 : 0),
    nameSize,
    nameFont,
  );
  const nameHeight = nameLines.length * nameSize * 1.27;
  const titleSize = titleLed ? (cocktail ? 42 : 33) : fresh ? 17 : 10.5;
  const subtitleHeight = menu.subtitle
    ? lines(menu.subtitle, headingWidth, 11).length * 14 + 8
    : 0;
  const fixedPriceText =
    menu.fixedPrice != null
      ? `${menuPrice(menu.fixedPrice, menu.restaurant.currency, menu.priceFormat, menu.language)} ${menu.fixedPriceLabel}`
      : "";
  const continuationTop =
    Math.max(
      32 +
        lines(menu.restaurant.name, bodyWidth * 0.7, 17, spec.heading).length *
          17 *
          1.27,
      37 + lines(menu.title.toUpperCase(), bodyWidth * 0.3, 10).length * 12.7,
    ) + 32;
  const firstHeader = Math.max(
    hero ? 150 : 0,
    31 +
      nameHeight +
      lines(
        titleLed ? menu.title : menu.title.toUpperCase(),
        headingWidth,
        titleSize,
        titleLed ? "italic" : "sans",
      ).length *
        titleSize *
        1.27 +
      26 +
      subtitleHeight +
      (fixedPriceText
        ? 7 + lines(fixedPriceText, headingWidth, 11).length * 13.97
        : 0) +
      (logo && centered ? 40 : 0),
  );
  const firstTop = firstHeader + 24;
  if (firstTop > height * 0.58)
    throw Error(
      "Your restaurant name or introduction is too long for this page. Shorten it before preparing the menu.",
    );
  const footerLines = menu.footer ? lines(menu.footer, bodyWidth, 10.5) : [];
  const footerHeight = footerLines.length * 13.5 + (menu.footer ? 18 : 0) + 16;
  if (footerHeight > height * 0.28)
    throw Error(
      "Your footer is too long for a menu page. Shorten the notes or move details into a section.",
    );
  const bottom = height - margin - footerHeight;
  const warningSet = new Set<string>();

  function build(
    density: DesignedMenu["density"],
    balancedLimit?: number,
  ): MenuLayout {
    const itemGap =
      density === "compact" ? 8 : density === "spacious" ? 20 : 13;
    const sectionGap =
      density === "compact" ? 17 : density === "spacious" ? 30 : 23;
    const pages: MenuPage[] = [];
    let page!: MenuPage;
    let pageIndex = -1,
      column = 0,
      top = firstTop,
      y = firstTop;
    const addText = (
      text: string,
      x: number,
      yy: number,
      w: number,
      size: number,
      font: MenuFont,
      color: string,
      align: MenuText["align"] = "left",
      role = "body",
      entryId?: string,
      sectionId?: string,
    ) => {
      const wrapped = lines(text, w, size, font),
        leading = size * 1.27;
      for (const [n, text] of wrapped.entries())
        if (text)
          page.elements.push({
            kind: "text",
            text,
            x,
            y: yy + n * leading,
            width: w,
            height: leading,
            size,
            font,
            color,
            align,
            role,
            entryId,
            sectionId,
          });
      return wrapped.length * leading;
    };
    const shape = (
      kind: MenuShape["kind"],
      x: number,
      yy: number,
      w: number,
      h: number,
      color: string,
      thickness = 0.5,
    ) =>
      page.elements.push({
        kind,
        x,
        y: yy,
        width: w,
        height: h,
        color,
        thickness,
      });
    const startPage = () => {
      page = { elements: [], hits: [] };
      pages.push(page);
      pageIndex++;
      column = 0;
      top = pageIndex === 0 ? firstTop : continuationTop;
      y = top;
      if (!pageIndex) {
        const poster = spec.architecture === "poster",
          ink = poster ? theme.onAccent : theme.accent;
        if (poster)
          shape("rect", -9, -9, width + 18, firstHeader + 9, theme.accent);
        let yy = 31;
        const align = centered && !hero ? "center" : "left";
        let nx = margin,
          nw = headingWidth;
        if (logo) {
          page.elements.push({
            kind: "logo",
            photoId: String(logo),
            x: centered ? (width - 32) / 2 : margin,
            y: yy,
            width: 32,
            height: 32,
          });
          if (centered) yy += 40;
          else {
            nx += 46;
            nw -= 46;
          }
        }
        yy += addText(
          ["poster", "street", "taproom"].includes(spec.architecture)
            ? menu.restaurant.name.toUpperCase()
            : menu.restaurant.name,
          nx,
          yy,
          nw,
          nameSize,
          nameFont,
          ink,
          align,
          "restaurant",
        );
        yy += 8;
        yy += addText(
          titleLed ? menu.title : menu.title.toUpperCase(),
          margin,
          yy,
          headingWidth,
          titleSize,
          titleLed ? "italic" : "sans",
          ink,
          align,
          "title",
        );
        if (menu.fixedPrice != null)
          yy +=
            7 +
            addText(
              fixedPriceText,
              margin,
              yy + 7,
              headingWidth,
              11,
              "sans",
              ink,
              align,
              "fixed-price",
            );
        if (menu.subtitle)
          addText(
            menu.subtitle,
            margin,
            yy + 8,
            headingWidth,
            11,
            "sans",
            poster ? ink : theme.muted,
            align,
            "subtitle",
          );
        if (hero?.photoId)
          page.elements.push({
            kind: "photo",
            photoId: hero.photoId,
            x: width - margin - 142,
            y: 27,
            width: 142,
            height: 104,
            entryId: hero.id,
            crop: hero.crop,
          });
        if (!poster) {
          shape(
            "line",
            margin,
            firstHeader,
            bodyWidth,
            0,
            theme.accent,
            spec.architecture === "editorial" || spec.architecture === "list"
              ? 0.8
              : street || bar || fresh
                ? 4
                : 0.5,
          );
          if (["editorial", "list", "taproom"].includes(spec.architecture))
            shape(
              "line",
              margin,
              firstHeader + (bar ? 7 : 4),
              bodyWidth,
              0,
              theme.accent,
              0.35,
            );
        }
      } else {
        addText(
          menu.restaurant.name,
          margin,
          32,
          bodyWidth * 0.7,
          17,
          spec.heading,
          theme.accent,
          "left",
          "restaurant",
        );
        addText(
          menu.title.toUpperCase(),
          margin + bodyWidth * 0.7,
          37,
          bodyWidth * 0.3,
          10,
          "sans",
          theme.muted,
          "right",
          "title",
        );
        shape("line", margin, continuationTop - 23, bodyWidth, 0, theme.rule);
      }
    };
    startPage();
    const x = () => margin + column * (columnWidth + gap);
    const limit = () =>
      pageIndex === 0 && balancedLimit
        ? Math.min(bottom, top + balancedLimit)
        : bottom;
    const advance = (forcePage = false) => {
      if (!forcePage && column + 1 < columns) {
        column++;
        y = top;
      } else startPage();
    };
    function priceColumns(section: MenuSection) {
      if (!["ledger", "list", "taproom", "fresh"].includes(spec.architecture))
        return null;
      const first = section.items[0]?.variants;
      if (!first || first.length < 2 || first.length > 3) return null;
      if (
        section.items.some(
          (item) =>
            item.priceMode !== "variants" ||
            item.variants.length !== first.length ||
            item.variants.some((v, n) => v.label !== first[n].label) ||
            (item.photoId &&
              item.photoId !== hero?.photoId &&
              (menu.layout === "grid" ||
                (menu.layout === "featured" && item.featured))),
        )
      )
        return null;
      const widths = first.map(
        (v, n) =>
          Math.max(
            measure(v.label, "sans", 11),
            ...section.items.map((i) =>
              measure(
                menuPrice(
                  i.variants[n].price,
                  menu.restaurant.currency,
                  menu.priceFormat,
                  menu.language,
                ),
                "sans",
                11,
              ),
            ),
          ) + 9,
      );
      const total = widths.reduce((sum, w) => sum + w, 0);
      const nameWidth = columnWidth - total - 15;
      if (nameWidth < Math.max(96, columnWidth * 0.46)) return null;
      return { widths, nameWidth, labels: first.map((v) => v.label) };
    }
    type PriceColumns = ReturnType<typeof priceColumns>;
    function sectionMeasure(
      name: string,
      description: string,
      grid: PriceColumns = null,
    ) {
      return (
        lines(
          uppercaseSection ? name.toUpperCase() : name,
          columnWidth,
          spec.sectionSize,
          displaySection
            ? "display"
            : spec.architecture === "list"
              ? "serif"
              : "sans",
        ).length *
          spec.sectionSize *
          1.27 +
        12 +
        (description
          ? lines(description, columnWidth, 11).length * 14 + 6
          : 0) +
        (grid ? 18 : 0)
      );
    }
    function drawSection(
      name: string,
      description: string,
      id: string,
      grid: PriceColumns,
    ) {
      const headerFont = displaySection
        ? "display"
        : spec.architecture === "list"
          ? "serif"
          : "sans";
      const label = uppercaseSection ? name.toUpperCase() : name;
      if (spec.architecture === "ledger" || street || fresh)
        shape(
          "rect",
          x() - 7,
          y - 5,
          columnWidth + 14,
          lines(label, columnWidth, spec.sectionSize, headerFont).length *
            spec.sectionSize *
            1.27 +
            10,
          street ? theme.accent : theme.subtle,
        );
      y += addText(
        label,
        x(),
        y,
        columnWidth,
        spec.sectionSize,
        headerFont,
        street ? theme.onAccent : theme.accent,
        centered ? "center" : "left",
        "section",
        undefined,
        id,
      );
      if (
        ["editorial", "poster", "taproom", "cocktail"].includes(
          spec.architecture,
        )
      )
        shape(
          "line",
          x(),
          y + 5,
          columnWidth,
          0,
          theme.rule,
          spec.architecture === "poster" || bar ? 1.4 : 0.4,
        );
      y += 12;
      if (description)
        y +=
          addText(
            description,
            x(),
            y,
            columnWidth,
            11,
            "sans",
            theme.muted,
            centered ? "center" : "left",
            "section-description",
            undefined,
            id,
          ) + 6;
      if (grid) {
        let xx = x() + grid.nameWidth + 15;
        grid.labels.forEach((label, n) => {
          addText(
            label,
            xx,
            y,
            grid.widths[n],
            11,
            "sans",
            theme.muted,
            "right",
            "price-column",
            undefined,
            id,
          );
          xx += grid.widths[n];
        });
        y += 18;
      }
    }
    function entryMetrics(item: MenuEntry, grid: PriceColumns) {
      const price = entryPrice(item, menu),
        priceWidth = price
          ? measure(price, "sans", priceSize) + (street ? 20 : 12)
          : 0;
      const priceBelow = priceWidth > columnWidth * 0.38;
      const nameWidth =
        grid?.nameWidth ?? columnWidth - (priceBelow ? 0 : priceWidth);
      const photo =
        !!item.photoId &&
        item.photoId !== hero?.photoId &&
        (menu.layout === "grid" ||
          (menu.layout === "featured" && item.featured));
      const photoHeight = photo ? Math.min(160, columnWidth * 0.59) + 11 : 0;
      const nameHeight =
        lines(item.name || "Untitled dish", nameWidth, spec.itemSize, spec.item)
          .length *
        spec.itemSize *
        1.27;
      const descriptionHeight = item.description
        ? 4 +
          lines(item.description, grid?.nameWidth ?? columnWidth, 11).length *
            14
        : 0;
      const extra = [
        ...(item.priceMode === "variants" && !grid ? item.variants : []).map(
          (v) => ({
            label: v.label,
            price: menuPrice(
              v.price,
              menu.restaurant.currency,
              menu.priceFormat,
              menu.language,
            ),
          }),
        ),
        ...item.additions.map((v) => ({
          label: `+ ${v.label}`,
          price: menuPrice(
            v.price,
            menu.restaurant.currency,
            menu.priceFormat,
            menu.language,
          ),
        })),
      ].map((v) => {
        const priceWidth = measure(v.price, "sans", 11) + 12;
        const labelWidth = columnWidth - priceWidth;
        return {
          ...v,
          priceWidth,
          labelWidth,
          height: lines(v.label, labelWidth, 11).length * 13.97,
        };
      });
      const extraHeight =
        extra.reduce((n, v) => n + v.height + 3, 0) + (extra.length ? 5 : 0);
      const tags = item.dietary.join(" · ");
      const tagsHeight = tags
        ? 5 + lines(tags, columnWidth, 10.5).length * 13.4
        : 0;
      return {
        price,
        priceBelow,
        nameWidth,
        photoHeight,
        extra,
        tags,
        height:
          photoHeight +
          nameHeight +
          descriptionHeight +
          extraHeight +
          tagsHeight +
          (priceBelow
            ? lines(price, columnWidth, priceSize).length * priceSize * 1.27 + 4
            : 0) +
          (!item.available ? 19 : 0) +
          itemGap,
      };
    }
    for (const section of sections) {
      if (section.pageBreakBefore && y > top + 1) advance(true);
      else if (section.pageBreakBefore && column > 0) advance(true);
      const grid = priceColumns(section);
      const sh = sectionMeasure(section.name, section.description, grid);
      const whole =
        sh +
        section.items.reduce((n, i) => n + entryMetrics(i, grid).height, 0);
      if (whole < (bottom - top) * 0.55 && y + whole > limit() && y > top + 1)
        advance();
      let started = false;
      for (const item of section.items) {
        const metrics = entryMetrics(item, grid),
          needed = metrics.height + (started ? 0 : sh);
        if (metrics.height + sh > bottom - Math.min(firstTop, continuationTop))
          throw Error(
            `${item.name || "This dish"} is too long for one column. Shorten its description or choose one column.`,
          );
        let needsHeading = !started;
        let continued = false;
        if (y + needed > limit() && y > top + 1) {
          advance();
          needsHeading = true;
          continued = started;
        }
        const headingName = continued
          ? `${section.name} (continued)`
          : section.name;
        const headingDescription = continued ? "" : section.description;
        if (
          y +
            metrics.height +
            (needsHeading
              ? sectionMeasure(headingName, headingDescription, grid)
              : 0) >
          bottom
        )
          throw Error(
            `${item.name || "This dish"} does not fit comfortably. Choose one column or shorten its description.`,
          );
        if (needsHeading)
          drawSection(headingName, headingDescription, section.id, grid);
        started = true;
        const start = y;
        if (metrics.photoHeight && item.photoId) {
          page.elements.push({
            kind: "photo",
            photoId: item.photoId,
            x: x(),
            y,
            width: columnWidth,
            height: metrics.photoHeight - 11,
            entryId: item.id,
            crop: item.crop,
          });
          y += metrics.photoHeight;
        }
        const align = centered ? "center" : "left";
        const nameHeight = addText(
          item.name || "Untitled dish",
          x(),
          y,
          metrics.nameWidth,
          spec.itemSize,
          spec.item,
          theme.ink,
          align,
          "item",
          item.id,
        );
        if (cocktail)
          shape("line", x() - 10, y + 2, 0, nameHeight - 3, theme.accent, 1.2);
        if (grid) {
          let xx = x() + grid.nameWidth + 15;
          item.variants.forEach((variant, n) => {
            addText(
              menuPrice(
                variant.price,
                menu.restaurant.currency,
                menu.priceFormat,
                menu.language,
              ),
              xx,
              y + (spec.itemSize - 11) * 0.8,
              grid.widths[n],
              11,
              "sans",
              theme.ink,
              "right",
              "price-option",
              item.id,
            );
            xx += grid.widths[n];
          });
        }
        if (street && metrics.price && !metrics.priceBelow)
          shape(
            "rect",
            x() + metrics.nameWidth + 5,
            y - 1,
            columnWidth - metrics.nameWidth,
            priceSize * 1.27 + 7,
            theme.subtle,
          );
        if (metrics.price && !metrics.priceBelow)
          addText(
            metrics.price,
            x() + metrics.nameWidth + 8,
            y + (spec.itemSize - priceSize) * 0.8,
            columnWidth - metrics.nameWidth - 8,
            priceSize,
            "sans",
            theme.ink,
            "right",
            "price",
            item.id,
          );
        y += nameHeight;
        if (metrics.priceBelow)
          y +=
            4 +
            addText(
              metrics.price,
              x(),
              y + 4,
              columnWidth,
              priceSize,
              "sans",
              theme.ink,
              align,
              "price",
              item.id,
            );
        if (item.description)
          y +=
            4 +
            addText(
              item.description,
              x(),
              y + 4,
              grid?.nameWidth ?? columnWidth,
              11,
              "sans",
              theme.muted,
              align,
              "description",
              item.id,
            );
        if (metrics.extra.length) {
          y += 5;
          for (const extra of metrics.extra) {
            addText(
              extra.label,
              x(),
              y,
              extra.labelWidth,
              11,
              "sans",
              theme.ink,
              "left",
              "price-option",
              item.id,
            );
            addText(
              extra.price,
              x() + extra.labelWidth,
              y,
              extra.priceWidth,
              11,
              "sans",
              theme.ink,
              "right",
              "price-option",
              item.id,
            );
            y += extra.height + 3;
          }
        }
        if (metrics.tags)
          y +=
            5 +
            addText(
              metrics.tags,
              x(),
              y + 5,
              columnWidth,
              10.5,
              "sans",
              theme.accent,
              align,
              "dietary",
              item.id,
            );
        if (!item.available)
          y +=
            5 +
            addText(
              "Currently unavailable",
              x(),
              y + 5,
              columnWidth,
              10.5,
              "sans",
              theme.muted,
              align,
              "availability",
              item.id,
            );
        page.hits.push({
          entryId: item.id,
          x: x() - 4,
          y: start - 3,
          width: columnWidth + 8,
          height: y - start + 6,
        });
        y += itemGap;
      }
      y += sectionGap;
    }
    for (const [index, p] of pages.entries()) {
      page = p;
      if (menu.footer) {
        shape(
          "line",
          margin,
          height - margin - footerHeight + 8,
          bodyWidth,
          0,
          theme.rule,
          0.4,
        );
        addText(
          menu.footer,
          margin,
          height - margin - footerHeight + 19,
          bodyWidth,
          10.5,
          "sans",
          theme.muted,
          "left",
          "footer",
        );
      }
      if (pages.length > 1)
        addText(
          `${index + 1} / ${pages.length}`,
          width - margin - 48,
          height - 36,
          48,
          9,
          "sans",
          theme.muted,
          "right",
          "page-number",
        );
    }
    return { width, height, pages, columns, density, warnings: [], theme };
  }
  let result = build(menu.density);
  if (
    menu.pageTarget &&
    result.pages.length > menu.pageTarget &&
    menu.density !== "compact"
  ) {
    const compact = build("compact");
    if (compact.pages.length <= menu.pageTarget) {
      result = compact;
      warningSet.add(
        "Spacing was gently tightened to meet your page preference. Text sizes are unchanged.",
      );
    }
  }
  if (
    columns === 2 &&
    result.pages.length === 1 &&
    !sections.some((s) => s.pageBreakBefore)
  ) {
    let low = 120,
      high = bottom - firstTop;
    for (let n = 0; n < 9; n++) {
      const mid = (low + high) / 2;
      try {
        const candidate = build(result.density, mid);
        if (candidate.pages.length === 1) {
          result = candidate;
          high = mid;
        } else low = mid;
      } catch {
        low = mid;
      }
    }
  }
  if (menu.pageTarget && result.pages.length > menu.pageTarget)
    warningSet.add(
      `This content needs ${result.pages.length} pages at a readable size. Try two columns, fewer photos, or shorter descriptions to reach ${menu.pageTarget}.`,
    );
  result.warnings = [...warningSet];
  return result;
}
