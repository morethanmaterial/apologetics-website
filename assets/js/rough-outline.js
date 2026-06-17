(function () {
  "use strict";

  if (!window.rough || typeof window.rough.svg !== "function") {
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
    ".infinite-scroll-button"
  ].join(",");

  const lineTargets = [
    { selector: ".header", mode: "bottom" },
    { selector: ".md-content hr", mode: "middle" },
    { selector: ".md-content blockquote", mode: "left" }
  ];

  const headingSelector = ".post-content h2, .post-content h3, .mtm-recent-articles-heading h2";
  const textUnderlineTargets = [
    ".md-content a:not(.anchor)",
    ".md-content u",
    ".md-content ins",
    ".post-meta a",
    ".footer a",
    ".entry-cover a",
    ".menu .active"
  ].join(",");

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

  function seedFor(element, salt) {
    if (!seeds.has(element)) {
      const label = [
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

    if (mode === "left" && element.matches(".md-content blockquote")) {
      return cssVar("--mtm-yellow", element);
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

  function strokeWidthFor(element, mode) {
    const styles = getComputedStyle(element);

    if (mode === "bottom") return Math.max(3, parseFloat(styles.borderBottomWidth) || 3);
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

  function prepareHeading(element) {
    if (element.querySelector(".mtm-heading-underline")) return;

    const wrapper = document.createElement("span");
    const nodes = Array.from(element.childNodes).filter(function (node) {
      return !(node.nodeType === 1 && node.classList.contains("anchor"));
    });

    if (!nodes.length) return;

    wrapper.className = "mtm-heading-underline";

    for (const node of nodes) {
      wrapper.appendChild(node);
    }

    const anchor = Array.from(element.children).find(function (child) {
      return child.classList.contains("anchor");
    });

    if (anchor) {
      element.insertBefore(wrapper, anchor);
    } else {
      element.appendChild(wrapper);
    }
  }

  function parseCssLength(value, relativeTo) {
    if (!value || value === "auto" || value === "from-font") return null;

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    if (value.endsWith("rem")) return parsed * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    if (value.endsWith("em")) return parsed * relativeTo;
    return parsed;
  }

  function underlineOffsetFor(element, fontSize) {
    const offset = parseCssLength(getComputedStyle(element).textUnderlineOffset, fontSize);
    return offset === null ? fontSize * 0.08 : offset;
  }

  function decorationColorFor(element, fallback) {
    const styles = getComputedStyle(element);
    const color = styles.textDecorationColor;
    if (styles.textDecorationLine !== "none" && !transparent(color)) return color;
    return fallback;
  }

  function underlineStrokeWidthFor(element, fallback) {
    const styles = getComputedStyle(element);
    const fontSize = parseFloat(styles.fontSize) || 16;
    const thickness = parseCssLength(styles.textDecorationThickness, fontSize);
    return Math.max(1.5, thickness || fallback);
  }

  function underlineYFor(line, containerRect, element, strokeWidth, height) {
    const styles = getComputedStyle(element);
    const fontSize = parseFloat(styles.fontSize) || 16;
    const descent = fontSize * 0.13;
    const gap = Math.max(1, Math.min(2.25, strokeWidth * 0.35));
    const y = line.bottom - containerRect.top - descent + underlineOffsetFor(element, fontSize) + strokeWidth * 0.5 + gap;

    return Math.min(
      Math.max(strokeWidth / 2, y),
      Math.max(strokeWidth / 2, height + gap)
    );
  }

  function textUnderlineYFor(line, containerRect, strokeWidth, height) {
    const clearance = Math.max(2, strokeWidth * 0.75);
    const y = line.bottom - containerRect.top + clearance;

    return Math.min(
      Math.max(strokeWidth / 2, y),
      Math.max(strokeWidth / 2, height + clearance + strokeWidth)
    );
  }

  function headingColorFor(element, wrapper) {
    const fallback = cssVar("--mtm-yellow", element);
    return decorationColorFor(wrapper || element, fallback);
  }

  function headingStrokeWidthFor(element, wrapper) {
    return underlineStrokeWidthFor(wrapper || element, element.matches("h3") ? 4 : 5);
  }

  function textUnderlineColorFor(element) {
    const fallback = element.matches("a") ? cssVar("--mtm-blue", element) : cssVar("--mtm-yellow", element);
    return decorationColorFor(element, fallback);
  }

  function textUnderlineStrokeWidthFor(element) {
    return underlineStrokeWidthFor(element, 3);
  }

  function headingLineRects(wrapper) {
    const range = document.createRange();
    range.selectNodeContents(wrapper);

    const rects = Array.from(range.getClientRects()).filter(function (rect) {
      return rect.width > 2 && rect.height > 2;
    });

    range.detach();

    const lines = [];
    rects.sort(function (a, b) {
      return a.top === b.top ? a.left - b.left : a.top - b.top;
    }).forEach(function (rect) {
      const center = rect.top + rect.height / 2;
      const existing = lines.find(function (line) {
        return Math.abs(line.center - center) <= Math.max(4, Math.min(line.height, rect.height) * 0.45);
      });

      if (existing) {
        existing.left = Math.min(existing.left, rect.left);
        existing.right = Math.max(existing.right, rect.right);
        existing.top = Math.min(existing.top, rect.top);
        existing.bottom = Math.max(existing.bottom, rect.bottom);
        existing.height = Math.max(existing.height, rect.height);
        existing.center = existing.top + (existing.bottom - existing.top) / 2;
      } else {
        lines.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          center
        });
      }
    });

    return lines;
  }

  function textNodesIn(element) {
    const nodes = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();

    while (node) {
      if (node.nodeValue && node.nodeValue.trim()) {
        nodes.push(node);
      }
      node = walker.nextNode();
    }

    return nodes;
  }

  function descenderProfile(character, mode) {
    const headingProfiles = {
      g: { left: 0, right: 1, padLeft: 0.04, padRight: 0.07 },
      j: { left: 0, right: 1, padLeft: 0.04, padRight: 0.07 },
      p: { left: 0, right: 0.62, padLeft: 0.04, padRight: 0.05 },
      q: { left: 0.36, right: 1, padLeft: 0.05, padRight: 0.05 },
      y: { left: 0.28, right: 1, padLeft: 0.04, padRight: 0.05 },
      Q: { left: 0.38, right: 1, padLeft: 0.05, padRight: 0.06 }
    };
    const textProfiles = {
      g: { left: 0.06, right: 0.7, padLeft: 0.03, padRight: 0.05 },
      j: { left: 0.16, right: 0.84, padLeft: 0.04, padRight: 0.04 },
      p: { left: 0.04, right: 0.4, padLeft: 0.04, padRight: 0.04 },
      q: { left: 0.56, right: 0.96, padLeft: 0.04, padRight: 0.04 },
      y: { left: 0.38, right: 0.9, padLeft: 0.04, padRight: 0.04 },
      Q: { left: 0.56, right: 1, padLeft: 0.04, padRight: 0.05 }
    };

    return (mode === "heading" ? headingProfiles : textProfiles)[character] || textProfiles.g;
  }

  function descenderGapsFor(element, mode) {
    const gaps = [];
    const range = document.createRange();
    const descenders = /[gjpqyQ]/;

    textNodesIn(element).forEach(function (node) {
      const text = node.nodeValue || "";

      for (let index = 0; index < text.length; index += 1) {
        const character = text.charAt(index);
        if (!descenders.test(character)) continue;

        range.setStart(node, index);
        range.setEnd(node, index + 1);

        Array.from(range.getClientRects()).forEach(function (rect) {
          if (rect.width <= 1 || rect.height <= 1) return;

          const profile = descenderProfile(character, mode);
          gaps.push({
            left: rect.left + rect.width * profile.left,
            right: rect.left + rect.width * profile.right,
            center: rect.top + rect.height / 2,
            height: rect.height,
            padLeft: rect.width * profile.padLeft,
            padRight: rect.width * profile.padRight
          });
        });
      }
    });

    range.detach();
    return gaps;
  }

  function descenderGapPaddingFor(gap, strokeWidth, mode) {
    const capClearance = mode === "heading" ? strokeWidth * 0.72 : strokeWidth * 0.48;
    const scaledBreathingRoom = mode === "heading"
      ? Math.min(5, gap.height * 0.025)
      : Math.min(1.1, Math.max(0.2, gap.height * 0.008));

    return {
      left: capClearance + scaledBreathingRoom + gap.padLeft,
      right: capClearance + scaledBreathingRoom + gap.padRight
    };
  }

  function gapsForLine(gaps, line, containerRect, strokeWidth, mode) {
    return gaps.filter(function (gap) {
      return Math.abs(gap.center - line.center) <= Math.max(5, Math.min(gap.height, line.height) * 0.45);
    }).map(function (gap) {
      const padding = descenderGapPaddingFor(gap, strokeWidth, mode);
      return {
        left: gap.left - containerRect.left - padding.left,
        right: gap.right - containerRect.left + padding.right
      };
    }).sort(function (a, b) {
      return a.left - b.left;
    });
  }

  function lineSegmentsAroundGaps(x1, x2, gaps, minimumWidth) {
    const segments = [];
    let start = x1;

    gaps.forEach(function (gap) {
      const gapLeft = Math.max(x1, gap.left);
      const gapRight = Math.min(x2, gap.right);

      if (gapRight <= start || gapLeft >= x2) return;

      if (gapLeft - start >= minimumWidth) {
        segments.push([start, gapLeft]);
      }

      start = Math.max(start, gapRight);
    });

    if (x2 - start >= minimumWidth) {
      segments.push([start, x2]);
    }

    return segments;
  }

  function clearHeadingUnderline(element) {
    element.querySelectorAll(":scope > .mtm-heading-underline-svg").forEach(function (svg) {
      svg.remove();
    });
  }

  function clearHeaderLine(element) {
    element.querySelectorAll(":scope > .mtm-rough-header-line-svg").forEach(function (svg) {
      svg.remove();
    });
  }

  function clearRectangle(element) {
    element.querySelectorAll(":scope > .mtm-rough-outline-svg").forEach(function (svg) {
      svg.remove();
    });
  }

  function prepareTextUnderline(element) {
    if (element.querySelector(":scope > .mtm-text-underline-content")) return;

    const wrapper = document.createElement("span");
    const nodes = Array.from(element.childNodes).filter(function (node) {
      return !(node.nodeType === 1 && node.classList.contains("mtm-text-underline-svg"));
    });

    if (!nodes.length) return;

    element.classList.add("mtm-text-underline");
    wrapper.className = "mtm-text-underline-content";

    for (const node of nodes) {
      wrapper.appendChild(node);
    }

    element.appendChild(wrapper);
  }

  function clearTextUnderline(element) {
    element.querySelectorAll(":scope > .mtm-text-underline-svg").forEach(function (svg) {
      svg.remove();
    });
  }

  function drawHeadingUnderline(element, index) {
    prepareHeading(element);
    clearHeadingUnderline(element);

    const wrapper = element.querySelector(".mtm-heading-underline");
    if (!wrapper) return;

    const elementRect = element.getBoundingClientRect();
    if (elementRect.width < 8 || elementRect.height < 8) return;

    const lines = headingLineRects(wrapper);
    if (!lines.length) return;

    const strokeWidth = headingStrokeWidthFor(element, wrapper);
    const width = Math.ceil(elementRect.width);
    const height = Math.ceil(elementRect.height);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mtm-heading-underline-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    element.insertBefore(svg, element.firstChild);

    const rc = rough.svg(svg);
    const descenderGaps = descenderGapsFor(wrapper, "heading");

    lines.forEach(function (line, lineIndex) {
      const x1 = Math.max(strokeWidth / 2, line.left - elementRect.left);
      const x2 = Math.min(width - strokeWidth / 2, line.right - elementRect.left);
      if (x2 - x1 < strokeWidth * 2) return;

      const y = underlineYFor(line, elementRect, wrapper, strokeWidth, height);
      const gaps = gapsForLine(descenderGaps, line, elementRect, strokeWidth, "heading");
      const segments = lineSegmentsAroundGaps(x1, x2, gaps, strokeWidth * 1.6);

      segments.forEach(function (segment, segmentIndex) {
        const group = rc.line(segment[0], y, segment[1], y, {
          stroke: headingColorFor(element, wrapper),
          strokeWidth,
          roughness: 0.72,
          bowing: 0.16,
          maxRandomnessOffset: 0.62,
          disableMultiStroke: true,
          seed: seedFor(element, "heading-underline-" + index + "-" + lineIndex + "-" + segmentIndex),
          preserveVertices: true
        });

        applyPathDefaults(group);
        svg.appendChild(group);
      });
    });
  }

  function drawTextUnderline(element, index) {
    if (element.closest(headingSelector)) return;
    if (element.classList.contains("mtm-social-button") || element.closest(".mtm-channel-buttons")) return;

    prepareTextUnderline(element);
    clearTextUnderline(element);

    const wrapper = element.querySelector(":scope > .mtm-text-underline-content");
    if (!wrapper || !textNodesIn(wrapper).length) return;

    const elementRect = element.getBoundingClientRect();
    if (elementRect.width < 4 || elementRect.height < 4) return;

    const lines = headingLineRects(wrapper);
    if (!lines.length) return;

    const strokeWidth = textUnderlineStrokeWidthFor(element);
    const width = Math.ceil(elementRect.width);
    const height = Math.ceil(elementRect.height);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mtm-text-underline-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    element.insertBefore(svg, element.firstChild);

    const rc = rough.svg(svg);

    lines.forEach(function (line, lineIndex) {
      const x1 = Math.max(strokeWidth / 2, line.left - elementRect.left);
      const x2 = Math.min(width - strokeWidth / 2, line.right - elementRect.left);
      if (x2 - x1 < strokeWidth * 2) return;

      const y = textUnderlineYFor(line, elementRect, strokeWidth, height);
      const group = rc.line(x1, y, x2, y, {
        stroke: textUnderlineColorFor(element),
        strokeWidth,
        roughness: 0.68,
        bowing: 0.14,
        maxRandomnessOffset: 0.54,
        disableMultiStroke: true,
        seed: seedFor(element, "text-underline-" + index + "-" + lineIndex),
        preserveVertices: true
      });

      applyPathDefaults(group);
      svg.appendChild(group);
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

  function drawInsetFill(svg, path) {
    const fill = document.createElementNS(svgNS, "path");
    fill.setAttribute("class", "mtm-rough-fill-path");
    fill.setAttribute("d", path);
    fill.setAttribute("stroke", "none");
    svg.appendChild(fill);
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
    const isSubmenu = element.matches("#menu .submenu");
    const fillPad = isSubmenu
      ? pad + Math.max(0.45, strokeWidth * 0.18)
      : pad + Math.max(1.25, strokeWidth * 0.45);
    const radius = Math.max(
      6,
      parseFloat(styles.borderTopLeftRadius) || 0,
      parseFloat(styles.borderTopRightRadius) || 0,
      parseFloat(styles.borderBottomRightRadius) || 0,
      parseFloat(styles.borderBottomLeftRadius) || 0
    );
    const path = roundedRectanglePath(
      pad,
      pad,
      Math.max(1, width - pad * 2),
      Math.max(1, height - pad * 2),
      Math.min(radius, 22)
    );
    const fillPath = roundedRectanglePath(
      fillPad,
      fillPad,
      Math.max(1, width - fillPad * 2),
      Math.max(1, height - fillPad * 2),
      Math.max(0, Math.min(radius - (fillPad - pad), 20))
    );
    const rc = rough.svg(svg);
    drawInsetFill(svg, fillPath);

    const group = rc.path(path, {
      stroke: colorFor(element, "outline"),
      strokeWidth,
      roughness: 1.18,
      bowing: 1.15,
      maxRandomnessOffset: 3.2,
      disableMultiStroke: true,
      seed: seedFor(element, "rounded-rectangle-" + index),
      fill: "none",
      preserveVertices: true
    });

    applyPathDefaults(group);
    svg.appendChild(group);
  }

  function drawHeaderLine(element, index) {
    clearHeaderLine(element);
    prepare(element);

    const rect = element.getBoundingClientRect();
    const viewportWidth = Math.ceil(
      (window.visualViewport && window.visualViewport.width) ||
      window.innerWidth ||
      document.documentElement.clientWidth ||
      rect.width
    );
    const strokeWidth = strokeWidthFor(element, "bottom");
    const overscan = Math.max(8, Math.ceil(strokeWidth * 4));
    const width = Math.round(Math.max(rect.width, viewportWidth) + overscan * 2);
    if (width < 8 || rect.height < 1) return;

    const height = Math.max(16, Math.ceil(strokeWidth + 14));
    const y = Math.round(height / 2);
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "mtm-rough-header-line-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    svg.style.left = Math.round(-rect.left - overscan) + "px";
    svg.style.bottom = (-Math.round(height / 2)) + "px";
    svg.style.width = width + "px";
    svg.style.height = height + "px";
    element.appendChild(svg);

    const rand = randomFromSeed(seedFor(element, "header-bottom-path-" + index));
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
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      const controlX = Math.round(((previous[0] + current[0]) / 2 + (rand() - 0.5) * 5) * 10) / 10;
      const controlY = Math.round(((previous[1] + current[1]) / 2 + (rand() - 0.5) * amplitude * 0.55) * 10) / 10;
      pathData += " Q " + controlX + " " + controlY + " " + current[0] + " " + current[1];
    }

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", colorFor(element, "bottom"));
    path.setAttribute("stroke-width", String(strokeWidth));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(path);
  }

  function drawLine(element, mode, index) {
    if (mode === "bottom" && element.matches(".header")) {
      drawHeaderLine(element, index);
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

    if (mode === "left") {
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

    if (mode === "bottom") {
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
      drawRectangle(element, index);
    });

    lineTargets.forEach(function (target) {
      document.querySelectorAll(target.selector).forEach(function (element, index) {
        drawLine(element, target.mode, index);
      });
    });

    document.querySelectorAll(headingSelector).forEach(drawHeadingUnderline);
    document.querySelectorAll(textUnderlineTargets).forEach(drawTextUnderline);

    document.documentElement.classList.add("mtm-rough-ready");
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

  const observer = new MutationObserver(function (mutations) {
    if (mutations.some(function (mutation) {
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
