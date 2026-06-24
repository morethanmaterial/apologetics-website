(function () {
  "use strict";

  function markReady() {
    if (typeof window.mtmMarkEffectReady === "function") {
      window.mtmMarkEffectReady("rough");
    }
  }

  if (!window.rough || typeof window.rough.svg !== "function") {
    markReady();
    return;
  }

  const svgNS = "http://www.w3.org/2000/svg";

  const outlineTargets = [
    "main article.post-entry",
    ".first-entry:not(.home-info)",
    "details.toc",
    "#menu .submenu",
    "#menu .menu-button > a",
    ".mtm-social-button",
    ".mtm-polemics-button",
    ".mtm-channel-buttons a",
    ".post-tags a",
    ".terms-tags a",
    ".share-buttons",
    ".paginav",
    "nav.pagination",
    ".infinite-scroll-button",
    ".search-input-wrap",
    ".searchResults li",
    ".mtm-rough-card",
    ".mtm-rough-button",
    ".mtm-post-square-icon",
    ".mtm-video-thumb",
    ".mtm-media-poster",
    ".mtm-type-pill",
    ".mtm-topic-pill"
  ].join(",");

  const lineTargets = [
    { selector: ".header", mode: "bottom" },
    { selector: ".mtm-site-footer", mode: "top" },
    { selector: ".md-content hr", mode: "middle" }
  ];

  let scheduled = false;
  let observing = false;
  const seeds = new WeakMap();
  const handledTocs = new WeakSet();
  let layer = null;

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }

  function stableChromeLabel(element) {
    const header = element.closest && element.closest(".header");
    if (!header) return "";

    const menuItem = element.closest("#menu > li");
    if (menuItem) {
      const triggerText = (menuItem.textContent || "").trim().replace(/\s+/g, " ");
      const menuIndex = Array.prototype.indexOf.call(menuItem.parentElement.children, menuItem);

      return [
        "site-chrome",
        "menu",
        menuIndex,
        triggerText,
        element.tagName,
        element.id,
        typeof element.className === "string" ? element.className.replace(/\bactive\b/g, "").trim() : ""
      ].join("|");
    }

    if (element.matches(".header")) return "site-chrome|header-line";
    if (element.closest(".logo")) return "site-chrome|logo|" + element.tagName + "|" + element.id;

    return [
      "site-chrome",
      element.tagName,
      element.id,
      typeof element.className === "string" ? element.className.replace(/\bactive\b/g, "").trim() : "",
      Array.prototype.indexOf.call(header.querySelectorAll(element.tagName), element)
    ].join("|");
  }

  function seedFor(element, salt) {
    if (!seeds.has(element)) {
      const label = stableChromeLabel(element) || [
        location.pathname,
        element.tagName,
        element.id,
        typeof element.className === "string" ? element.className : "",
        Array.prototype.indexOf.call(document.querySelectorAll(element.tagName), element)
      ].join("|");

      seeds.set(element, hash(label) || 1);
    }

    const size = element.clientWidth + "x" + element.clientHeight;
    return (hash(seeds.get(element) + "|" + salt + "|" + size) % 2147483646) + 1;
  }

  function randomFromSeed(seed) {
    let value = seed >>> 0;

    return function () {
      value = Math.imul(value || 1, 1664525) + 1013904223;
      return ((value >>> 0) / 4294967296);
    };
  }

  function cssVar(name, element) {
    return getComputedStyle(element || document.documentElement).getPropertyValue(name).trim();
  }

  function transparent(color) {
    return !color || color === "transparent" || /rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(color);
  }

  function colorFor(element, mode) {
    const styles = getComputedStyle(element);
    const fallbackNeutral = document.body.classList.contains("dark")
      ? (cssVar("--mtm-paper", element) || "#f5f8fa")
      : (cssVar("--mtm-ink", element) || "#292f33");

    if (mode === "bottom" && element.matches(".header")) {
      return (document.documentElement.classList.contains("mtm-dark") || document.body.classList.contains("dark"))
        ? (cssVar("--mtm-paper", element) || "#f5f8fa")
        : (cssVar("--mtm-ink", element) || "#292f33");
    }

    if (mode === "middle" && element.matches(".md-content hr")) {
      const parent = element.closest(".post-content") || document.body;
      const color = getComputedStyle(parent).color;
      return transparent(color) ? fallbackNeutral : color;
    }

    let color = styles.borderTopColor;
    if (mode === "bottom") color = styles.borderBottomColor;
    if (mode === "left") color = styles.borderLeftColor;

    if (transparent(color)) color = cssVar("--border", element);
    if (transparent(color)) color = styles.color;
    if (transparent(color)) color = fallbackNeutral;

    return color;
  }

  function headerFillColor(element) {
    const dark = document.documentElement.classList.contains("mtm-dark") ||
      document.body.classList.contains("dark");
    const fallback = dark ? "#14171a" : "#ffffff";
    return dark
      ? (cssVar("--mtm-dark-bg", element) || fallback)
      : (cssVar("--mtm-paper", element) || fallback);
  }

  function strokeWidthFor(element, mode) {
    const styles = getComputedStyle(element);

    if (mode === "bottom") return Math.max(3, parseFloat(styles.borderBottomWidth) || 3);
    if (mode === "top") return Math.max(3, parseFloat(styles.borderTopWidth) || 3);
    if (mode === "left") return Math.max(4, parseFloat(styles.borderLeftWidth) || 4);
    if (mode === "middle") return Math.max(2.5, element.clientHeight || 2.5);
    return Math.max(2.5, parseFloat(styles.borderTopWidth) || 3);
  }

  function ensureLayer() {
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "mtm-rough-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }

  function createSvg(kind, left, top, width, height, viewWidth, viewHeight) {
    const gutter = 6;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mtm-rough-svg " + kind);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", -gutter + " " + -gutter + " " + (viewWidth + gutter * 2) + " " + (viewHeight + gutter * 2));
    svg.style.left = (left - gutter) + "px";
    svg.style.top = (top - gutter) + "px";
    svg.style.width = (width + gutter * 2) + "px";
    svg.style.height = (height + gutter * 2) + "px";
    ensureLayer().appendChild(svg);
    return svg;
  }

  function createLocalSvg(element, kind, width, height) {
    const gutter = 6;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mtm-local-rough-svg " + kind);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", -gutter + " " + -gutter + " " + (width + gutter * 2) + " " + (height + gutter * 2));
    svg.setAttribute("width", String(width + gutter * 2));
    svg.setAttribute("height", String(height + gutter * 2));
    svg.style.left = -gutter + "px";
    svg.style.top = -gutter + "px";
    svg.style.width = (width + gutter * 2) + "px";
    svg.style.height = (height + gutter * 2) + "px";
    element.insertBefore(svg, element.firstChild);
    return svg;
  }

  function prepare(element) {
    element.classList.add("mtm-roughened");
  }

  function prepareOutlineContent(element) {
    if (element.matches(".searchResults li")) {
      if (!element.querySelector(":scope > .mtm-search-result-label")) {
        Array.from(element.childNodes).forEach(function (node) {
          if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue || !node.nodeValue.trim()) return;

          const wrapper = document.createElement("span");
          wrapper.className = "mtm-search-result-label";
          wrapper.textContent = node.nodeValue;
          element.replaceChild(wrapper, node);
        });
      }

      return;
    }

    if (!element.matches("a, button")) return;
    if (element.querySelector(":scope > .mtm-rough-content")) return;

    const nodes = Array.from(element.childNodes).filter(function (node) {
      return !(node.nodeType === 1 && node.classList.contains("mtm-local-rough-svg"));
    });
    const hasDirectText = nodes.some(function (node) {
      return node.nodeType === Node.TEXT_NODE && node.nodeValue && node.nodeValue.trim();
    });

    if (!hasDirectText) return;

    const wrapper = document.createElement("span");
    wrapper.className = "mtm-rough-content";

    for (const node of nodes) {
      wrapper.appendChild(node);
    }

    element.appendChild(wrapper);
  }

  function clearHeaderLine(element) {
    Array.from(element.children).forEach(function (svg) {
      if (!svg.classList || !svg.classList.contains("mtm-rough-header-line-svg")) return;
      svg.remove();
    });
  }

  function headerLineSvg(element) {
    const existing = Array.from(element.children).filter(function (child) {
      return child.classList && child.classList.contains("mtm-rough-header-line-svg");
    });

    existing.slice(1).forEach(function (svg) {
      svg.remove();
    });

    return existing[0] || document.createElementNS(svgNS, "svg");
  }

  function clearRectangle(element) {
    element.querySelectorAll(":scope > .mtm-rough-outline-svg").forEach(function (svg) {
      svg.remove();
    });
  }

  function bounds(element) {
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left + window.scrollX),
      top: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      bottom: Math.round(rect.bottom + window.scrollY)
    };
  }

  function applyPathDefaults(group) {
    group.querySelectorAll("path").forEach(function (path) {
      path.setAttribute("vector-effect", "non-scaling-stroke");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
    });
  }

  function roundedRectanglePath(x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    if (!r) {
      return [
        "M", x, y,
        "L", x + width, y,
        "L", x + width, y + height,
        "L", x, y + height,
        "Z"
      ].join(" ");
    }

    return [
      "M", x + r, y,
      "L", x + width - r, y,
      "C", x + width - r * 0.45, y, x + width, y + r * 0.45, x + width, y + r,
      "L", x + width, y + height - r,
      "C", x + width, y + height - r * 0.45, x + width - r * 0.45, y + height, x + width - r, y + height,
      "L", x + r, y + height,
      "C", x + r * 0.45, y + height, x, y + height - r * 0.45, x, y + height - r,
      "L", x, y + r,
      "C", x, y + r * 0.45, x + r * 0.45, y, x + r, y,
      "Z"
    ].join(" ");
  }

  function outlinePath(x, y, width, height, radius) {
    const pillThreshold = Math.min(width, height) * 0.38;
    if (radius >= pillThreshold) return roundedRectanglePath(x, y, width, height, radius);

    const softRadius = Math.max(2.75, Math.min(radius, width * 0.08, height * 0.08, 5.75));
    return roundedRectanglePath(x, y, width, height, softRadius);
  }

  function filledControl(element) {
    return element.matches([
      "#menu .menu-button > a",
      ".mtm-social-button",
      ".mtm-polemics-button",
      ".mtm-channel-buttons a",
      ".post-tags a",
      ".terms-tags a",
      ".infinite-scroll-button",
      ".mtm-rough-button",
      ".mtm-video-thumb",
      ".mtm-media-poster",
      ".mtm-type-pill",
      ".mtm-topic-pill"
    ].join(","));
  }

  function fillOverlapFor(element, strokeWidth) {
    if (filledControl(element)) {
      return Math.max(1.8, Math.min(2.7, strokeWidth * 0.7));
    }

    return Math.max(1.05, Math.min(1.85, strokeWidth * 0.42));
  }

  function strokeOptionsFor(element, width, height, strokeWidth) {
    const shortest = Math.max(1, Math.min(width, height));
    const compact = shortest < 76 || element.matches(".mtm-type-pill, .mtm-topic-pill");
    const control = filledControl(element);

    return {
      roughness: compact ? 0.82 : 1.02,
      bowing: compact ? 0.72 : 0.92,
      maxRandomnessOffset: control
        ? Math.max(0.9, Math.min(1.75, strokeWidth * 0.5, shortest * 0.036))
        : Math.max(1.15, Math.min(2.35, strokeWidth * 0.68, shortest * 0.032))
    };
  }

  function drawInsetFill(svg, path, overlap) {
    const fill = document.createElementNS(svgNS, "path");
    fill.setAttribute("class", "mtm-rough-fill-path");
    fill.setAttribute("d", path);
    fill.setAttribute("stroke-linecap", "round");
    fill.setAttribute("stroke-linejoin", "round");
    fill.setAttribute("vector-effect", "non-scaling-stroke");
    svg.style.setProperty("--mtm-rough-fill-overlap", overlap + "px");
    svg.appendChild(fill);
  }

  function drawRoughStroke(svg, path, color, strokeWidth, seed, options) {
    const group = rough.svg(svg).path(path, {
      stroke: color,
      strokeWidth,
      roughness: options.roughness,
      bowing: options.bowing,
      maxRandomnessOffset: options.maxRandomnessOffset,
      disableMultiStroke: true,
      fill: "none",
      preserveVertices: true,
      seed
    });

    group.setAttribute("class", "mtm-rough-stroke-group");
    applyPathDefaults(group);
    svg.appendChild(group);
  }

  function drawGlobalRectangle(element, index) {
    clearRectangle(element);
    prepare(element);

    const box = bounds(element);
    if (box.width < 8 || box.height < 8) return;

    const strokeWidth = strokeWidthFor(element, "outline");
    const pad = Math.ceil(strokeWidth / 2) + 3;
    const radius = Math.max(
      6,
      parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0,
      parseFloat(getComputedStyle(element).borderTopRightRadius) || 0,
      parseFloat(getComputedStyle(element).borderBottomRightRadius) || 0,
      parseFloat(getComputedStyle(element).borderBottomLeftRadius) || 0
    );
    const svg = createSvg(
      "mtm-rough-outline-svg mtm-rough-global-outline-svg",
      box.left,
      box.top,
      box.width,
      box.height,
      box.width,
      box.height
    );
    const path = outlinePath(
      pad,
      pad,
      Math.max(1, box.width - pad * 2),
      Math.max(1, box.height - pad * 2),
      Math.min(radius, 22)
    );

    drawRoughStroke(
      svg,
      path,
      colorFor(element, "outline"),
      strokeWidth,
      seedFor(element, "rough-visible-global-stroke-" + index),
      strokeOptionsFor(element, box.width, box.height, strokeWidth)
    );
  }

  function cssPathValue(path) {
    return "path(\"" + path.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\")";
  }

  function prepareMediaClip(element, path) {
    if (!element.matches(".mtm-post-square-icon, .mtm-video-thumb, .mtm-media-poster")) return;

    const media = element.querySelectorAll(":scope > img, :scope > picture, :scope > video, :scope > iframe");
    const clipPath = cssPathValue(path);
    element.classList.toggle("mtm-rough-has-media", media.length > 0);
    element.style.setProperty("--mtm-rough-clip-path", clipPath);

    media.forEach(function (child) {
      child.style.clipPath = clipPath;
      child.style.webkitClipPath = clipPath;

      if (child.matches("picture")) {
        child.querySelectorAll("img").forEach(function (image) {
          image.style.clipPath = clipPath;
          image.style.webkitClipPath = clipPath;
        });
      }
    });
  }

  function drawRectangle(element, index) {
    clearRectangle(element);
    prepareOutlineContent(element);

    const rect = element.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width < 8 || height < 8) return;

    prepare(element);

    const svg = createLocalSvg(
      element,
      "mtm-rough-outline-svg",
      width,
      height
    );

    const styles = getComputedStyle(element);
    const strokeWidth = strokeWidthFor(element, "outline");
    const pad = Math.ceil(strokeWidth / 2) + 3;
    const radius = Math.max(
      6,
      parseFloat(styles.borderTopLeftRadius) || 0,
      parseFloat(styles.borderTopRightRadius) || 0,
      parseFloat(styles.borderBottomRightRadius) || 0,
      parseFloat(styles.borderBottomLeftRadius) || 0
    );
    const path = outlinePath(
      pad,
      pad,
      Math.max(1, width - pad * 2),
      Math.max(1, height - pad * 2),
      Math.min(radius, 22)
    );
    const strokeOptions = strokeOptionsFor(element, width, height, strokeWidth);
    drawInsetFill(svg, path, fillOverlapFor(element, strokeWidth));
    drawRoughStroke(
      svg,
      path,
      colorFor(element, "outline"),
      strokeWidth,
      seedFor(element, "rough-visible-stroke-" + index),
      strokeOptions
    );
    prepareMediaClip(element, path);
  }

  function drawHeaderLine(element, index, mode) {
    prepare(element);

    const edge = mode || "bottom";
    const isTop = edge === "top";
    const rect = element.getBoundingClientRect();
    const viewportWidth = Math.ceil(
      (window.visualViewport && window.visualViewport.width) ||
      window.innerWidth ||
      document.documentElement.clientWidth ||
      rect.width
    );
    const strokeWidth = strokeWidthFor(element, edge);
    const overscan = Math.max(8, Math.ceil(strokeWidth * 4));
    const width = Math.round(Math.max(rect.width, viewportWidth) + overscan * 2);
    if (width < 8 || rect.height < 1) {
      clearHeaderLine(element);
      return;
    }

    const headerHeight = Math.ceil(Math.max(rect.height, element.offsetHeight || 0, 1));
    const height = Math.max(headerHeight, Math.ceil(strokeWidth * 2 + 12));
    const edgeOffset = Math.max(4, strokeWidth * 1.45);
    const y = Math.round((isTop ? edgeOffset : height - edgeOffset) * 10) / 10;
    const svg = headerLineSvg(element);
    svg.setAttribute("class", "mtm-rough-header-line-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.left = Math.round(-rect.left - overscan) + "px";
    svg.style.top = "0px";
    svg.style.bottom = "auto";
    svg.style.width = width + "px";
    svg.style.height = height + "px";
    svg.style.overflow = isTop ? "visible" : "hidden";

    const rand = randomFromSeed(seedFor(element, "full-width-" + edge + "-path-" + index));
    const start = 0;
    const end = width;
    const travel = end - start;
    const step = Math.max(70, Math.min(112, travel / 18));
    const amplitude = Math.max(1.35, Math.min(2.25, strokeWidth * 0.58));
    const points = [[start, y]];

    for (let x = start + step; x < end - step * 0.45; x += step) {
      const offset = (rand() - 0.5) * amplitude * 2;
      const xWobble = (rand() - 0.5) * Math.min(5, step * 0.08);
      points.push([Math.round(x + xWobble), Math.round((y + offset) * 10) / 10]);
    }

    points.push([end, y + Math.round((rand() - 0.5) * amplitude * 5) / 10]);

    let pathData = "M " + points[0][0] + " " + points[0][1];
    const curves = [];
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      const controlX = Math.round(((previous[0] + current[0]) / 2 + (rand() - 0.5) * 5) * 10) / 10;
      const controlY = Math.round(((previous[1] + current[1]) / 2 + (rand() - 0.5) * amplitude * 0.55) * 10) / 10;
      curves.push({ previous, current, controlX, controlY });
      pathData += " Q " + controlX + " " + controlY + " " + current[0] + " " + current[1];
    }

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", colorFor(element, edge));
    path.setAttribute("stroke-width", String(strokeWidth));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");

    if (isTop) {
      svg.replaceChildren(path);
    } else {
      let fillData = "M 0 0 L " + width + " 0 L " + points[points.length - 1][0] + " " + points[points.length - 1][1];
      for (let i = curves.length - 1; i >= 0; i -= 1) {
        const curve = curves[i];
        fillData += " Q " + curve.controlX + " " + curve.controlY + " " + curve.previous[0] + " " + curve.previous[1];
      }
      fillData += " Z";

      const fill = document.createElementNS(svgNS, "path");
      fill.setAttribute("d", fillData);
      fill.setAttribute("fill", headerFillColor(element));
      fill.setAttribute("stroke", "none");
      svg.replaceChildren(fill, path);
    }

    if (!svg.parentNode) {
      element.appendChild(svg);
    }
  }

  function drawLine(element, mode, index) {
    if (mode === "bottom" && element.matches(".header")) {
      drawHeaderLine(element, index, mode);
      return;
    }

    if (mode === "top" && element.matches(".mtm-site-footer")) {
      drawHeaderLine(element, index, mode);
      return;
    }

    const box = bounds(element);
    if (box.width < 8 || box.height < 1) return;

    prepare(element);

    const strokeWidth = strokeWidthFor(element, mode);
    let left = box.left;
    let top = box.top + box.height - 9;
    let width = box.width;
    let height = 18;
    let viewWidth = width;
    let viewHeight = 18;
    let points = [3, 9, Math.max(4, viewWidth - 3), 9];

    if (mode === "top") {
      top = box.top - 9;
    } else if (mode === "left") {
      left = box.left - 9;
      top = box.top;
      width = 18;
      height = box.height;
      viewWidth = 18;
      viewHeight = box.height;
      points = [9, 2, 9, Math.max(3, viewHeight - 2)];
    } else if (mode === "middle") {
      top = box.top + Math.round(box.height / 2) - 9;
    }

    const svg = createSvg(
      "mtm-rough-line-svg mtm-rough-line-" + mode,
      left,
      top,
      width,
      height,
      viewWidth,
      viewHeight
    );
    const rc = rough.svg(svg);

    const lineOptions = {
      roughness: 1.2,
      bowing: 1.05,
      maxRandomnessOffset: 2.8,
      disableMultiStroke: true
    };

    if (mode === "bottom" || mode === "top") {
      lineOptions.roughness = 0.85;
      lineOptions.bowing = 0.55;
      lineOptions.maxRandomnessOffset = 1.1;
      lineOptions.disableMultiStroke = true;
    }

    const group = rc.line(points[0], points[1], points[2], points[3], {
      stroke: colorFor(element, mode),
      strokeWidth,
      roughness: lineOptions.roughness,
      bowing: lineOptions.bowing,
      maxRandomnessOffset: lineOptions.maxRandomnessOffset,
      disableMultiStroke: true,
      seed: seedFor(element, mode + "-" + index),
      preserveVertices: true
    });

    applyPathDefaults(group);
    svg.appendChild(group);
  }

  function watchToc(element) {
    if (handledTocs.has(element)) return;
    handledTocs.add(element);

    element.addEventListener("toggle", function () {
      scheduleDraw();
      window.setTimeout(scheduleDraw, 50);
    });
  }

  function draw() {
    if (observing) observer.disconnect();
    observing = false;

    ensureLayer().textContent = "";

    document.querySelectorAll(outlineTargets).forEach(function (element, index) {
      if (element.matches("details.toc")) watchToc(element);
      if (element.matches("details.toc")) {
        drawGlobalRectangle(element, index);
        return;
      }
      drawRectangle(element, index);
    });

    lineTargets.forEach(function (target) {
      document.querySelectorAll(target.selector).forEach(function (element, index) {
        drawLine(element, target.mode, index);
      });
    });

    /*
      Text annotations are handled by rough-notation-init.js. Keep this pass
      focused on structural outlines, dividers, and cards.
    */

    document.documentElement.classList.add("mtm-rough-ready");
    markReady();
    observe();
  }

  function scheduleDraw() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      draw();
    });
  }

  function isNotationNode(node) {
    if (!node) return false;
    if (node.nodeType === Node.TEXT_NODE) return true;
    return node.nodeType === 1 &&
      (
        node.classList.contains("rough-annotation") ||
        node.classList.contains("mtm-notation-target") ||
        node.classList.contains("mtm-notation-heading-text") ||
        (typeof node.closest === "function" && !!node.closest(".rough-annotation"))
      );
  }

  function onlyNotationNodes(nodes) {
    return Array.from(nodes || []).every(isNotationNode);
  }

  function isNotationMutation(mutation) {
    if (isNotationNode(mutation.target)) return true;

    if (mutation.type === "attributes" && mutation.attributeName === "class") {
      const target = mutation.target;
      return target &&
        target.nodeType === 1 &&
        (
          target.classList.contains("mtm-notation-target") ||
          target.classList.contains("mtm-notation-heading-text") ||
          target.classList.contains("mtm-notation-heading") ||
          target.classList.contains("mtm-notation-underline") ||
          target.classList.contains("mtm-notation-highlight") ||
          target.classList.contains("mtm-notation-strike") ||
          target.classList.contains("mtm-notation-ready")
        );
    }

    return mutation.type === "childList" &&
      onlyNotationNodes(mutation.addedNodes) &&
      onlyNotationNodes(mutation.removedNodes);
  }

  const observer = new MutationObserver(function (mutations) {
    if (mutations.some(function (mutation) {
      if (isNotationMutation(mutation)) return false;
      if (layer && mutation.target === layer) return false;
      return mutation.type === "childList" ||
        mutation.attributeName === "class" ||
        mutation.attributeName === "data-theme" ||
        mutation.attributeName === "open";
    })) {
      scheduleDraw();
    }
  });

  function observe() {
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-theme", "open"]
    });
    observing = true;
  }

  window.addEventListener("resize", scheduleDraw, { passive: true });
  window.addEventListener("orientationchange", scheduleDraw, { passive: true });
  window.addEventListener("load", scheduleDraw);
  document.addEventListener("mtm:rough-redraw", scheduleDraw);

  document.addEventListener("pointerover", function (event) {
    if (event.target.closest("#menu .menu-item-has-children")) scheduleDraw();
  }, { passive: true });

  document.addEventListener("focusin", function (event) {
    if (event.target.closest("#menu .menu-item-has-children")) scheduleDraw();
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(scheduleDraw);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleDraw, { once: true });
  } else {
    scheduleDraw();
  }
})();
