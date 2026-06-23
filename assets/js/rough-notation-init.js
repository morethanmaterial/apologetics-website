(function () {
  "use strict";

  const roughNotation = window.RoughNotation;

  function markReady() {
    if (typeof window.mtmMarkEffectReady === "function") {
      window.mtmMarkEffectReady("notation");
    }
  }

  if (!roughNotation || typeof roughNotation.annotate !== "function") {
    markReady();
    return;
  }

  const headingSelector = [
    ".post-content h2",
    ".post-content h3",
    ".mtm-recent-articles-heading h2",
    ".mtm-home-panel > h2",
    ".mtm-home-cell > h2"
  ].join(",");

  const heroEmphasisSelector = ".mtm-hero-emphasis";

  const underlineSelector = [
    ".md-content a:not(.anchor)",
    ".md-content u",
    ".md-content ins",
    ".post-meta a",
    ".footer a",
    ".entry-cover a",
    ".menu .active"
  ].join(",");

  const highlightSelector = ".post-content mark";
  const strikeSelector = ".post-content del, .post-content s";
  const skipSelector = [
    "pre",
    "code",
    "kbd",
    "samp",
    ".highlight",
    ".chroma",
    ".lntable",
    ".mtm-channel-buttons",
    ".mtm-social-row",
    ".mtm-home-actions",
    ".mtm-community-actions",
    ".mtm-video-button",
    ".mtm-rough-button"
  ].join(",");

  let scheduled = false;
  let annotations = [];
  let lastViewportWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const seeds = new WeakMap();
  const loadAnimated = new WeakSet();
  let pageFullyLoaded = document.readyState === "complete";
  let heroLoadAnimationActive = false;
  let pendingDrawAfterHeroLoad = false;
  let pendingRefreshAfterHeroLoad = false;
  let heroLoadAnimationEndTimer = 0;

  function beginRefresh() {
    document.documentElement.classList.add("mtm-notation-refreshing");
  }

  function endRefresh() {
    window.requestAnimationFrame(function () {
      document.documentElement.classList.remove("mtm-notation-refreshing");
    });
  }

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
        element.textContent.trim().slice(0, 160),
        Array.prototype.indexOf.call(document.querySelectorAll(element.tagName), element)
      ].join("|");

      seeds.set(element, hash(label) || 1);
    }

    return (hash(seeds.get(element) + "|" + salt) % 2147483646) + 1;
  }

  function notationAnimationElement(element) {
    return element.closest(".mtm-notation-animate, [data-mtm-notation-animate]");
  }

  function notationLoadAnimationElement(element) {
    return element.closest("[data-mtm-notation-load-animate]");
  }

  function effectsReadyForLoadAnimation() {
    return document.documentElement.classList.contains("mtm-effects-ready") &&
      !document.documentElement.classList.contains("mtm-effects-booting");
  }

  function loadAnimationsReady() {
    return pageFullyLoaded && effectsReadyForLoadAnimation();
  }

  function notationShouldAnimate(element) {
    if (notationAnimationElement(element)) return true;

    const loadSource = notationLoadAnimationElement(element);
    return !!(loadSource && loadAnimationsReady() && !loadAnimated.has(element));
  }

  function notationAnimationDuration(element) {
    const source = notationAnimationElement(element) || notationLoadAnimationElement(element);
    const value = source && source.getAttribute("data-mtm-notation-duration");
    const duration = value ? parseInt(value, 10) : 650;
    return Number.isFinite(duration) && duration > 0 ? duration : 650;
  }

  function groupedAnimationDuration(records) {
    return records.reduce(function (total, record) {
      return total + (record.animate ? (record.config.animationDuration || 800) : 0);
    }, 0);
  }

  function finishHeroLoadAnimation(records) {
    records.forEach(function (record) {
      if (record.loadAnimate) {
        loadAnimated.add(record.element);
      }
    });

    heroLoadAnimationActive = false;
    heroLoadAnimationEndTimer = 0;

    if (pendingDrawAfterHeroLoad) {
      const refresh = pendingRefreshAfterHeroLoad;
      pendingDrawAfterHeroLoad = false;
      pendingRefreshAfterHeroLoad = false;
      scheduleDraw(refresh ? 0 : 20);
    }
  }

  function cssVar(name, element) {
    return getComputedStyle(element || document.documentElement).getPropertyValue(name).trim();
  }

  function transparent(color) {
    return !color || color === "transparent" || /rgba?\([^)]*,\s*0(?:\.0+)?\)/.test(color);
  }

  function backgroundColorFor(element) {
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const background = getComputedStyle(node).backgroundColor;
      if (!transparent(background)) return background;
    }

    const bodyBackground = document.body ? getComputedStyle(document.body).backgroundColor : "";
    if (!transparent(bodyBackground)) return bodyBackground;

    return cssVar("--mtm-paper", element) || "#fff";
  }

  function parseCssLength(value, relativeTo) {
    if (!value || value === "auto" || value === "from-font") return null;

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    if (value.endsWith("rem")) return parsed * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
    if (value.endsWith("em")) return parsed * relativeTo;
    return parsed;
  }

  function fontSizeFor(element) {
    return parseFloat(getComputedStyle(element).fontSize) || 16;
  }

  function annotationColor(element, type) {
    if (type === "heading" || type === "inserted") {
      return cssVar("--mtm-yellow", element) || "#ffcc4d";
    }

    if (type === "link") {
      return cssVar("--mtm-blue", element) || "#55acee";
    }

    if (type === "highlight") {
      return "rgba(255, 204, 77, 0.68)";
    }

    const color = getComputedStyle(element).color;
    return transparent(color) ? (cssVar("--mtm-ink", element) || "#292f33") : color;
  }

  function underlineStrokeWidth(element, fallback) {
    const styles = getComputedStyle(element);
    const fontSize = fontSizeFor(element);
    const thickness = parseCssLength(styles.textDecorationThickness, fontSize);
    return Math.max(1.8, thickness || fallback);
  }

  function headingStrokeWidth(element) {
    if (element.matches(".mtm-home-cell > h2, .mtm-home-panel > h2, .mtm-recent-articles-heading h2")) {
      return 4;
    }

    return element.matches("h3") ? 4 : 5;
  }

  function bodyUnderlinePadding(element) {
    const fontSize = fontSizeFor(element);
    return [0, 1, Math.max(2, fontSize * 0.1), 1];
  }

  function headingUnderlinePadding(element) {
    const fontSize = fontSizeFor(element);
    return [0, 1, -Math.max(1, Math.min(4, fontSize * 0.045)), 1];
  }

  function visible(element) {
    return Array.from(element.getClientRects()).some(function (rect) {
      return rect.width > 2 && rect.height > 2;
    });
  }

  function shouldSkip(element) {
    return !element ||
      !element.isConnected ||
      element.closest(skipSelector) ||
      !visible(element);
  }

  function textRectsFor(element) {
    const range = document.createRange();
    const textRects = [];

    if (document.createTreeWalker && window.NodeFilter) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (!parent || parent.closest(skipSelector)) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      });

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        range.selectNodeContents(node);
        Array.prototype.push.apply(textRects, Array.from(range.getClientRects()));
      }
    }

    if (!textRects.length) {
      range.selectNodeContents(element);
      Array.prototype.push.apply(textRects, Array.from(range.getClientRects()));
    }

    range.detach();

    return mergeTextRects(textRects, element);
  }

  function mergeTextRects(rects, element) {
    const fontSize = fontSizeFor(element);
    const maxGap = Math.max(2, fontSize * 0.7);
    const lines = [];

    rects
      .filter(function (rect) {
        return rect.width > 1 && rect.height > 1;
      })
      .sort(function (a, b) {
        return Math.abs(a.top - b.top) > 2 ? a.top - b.top : a.left - b.left;
      })
      .forEach(function (rect) {
        const center = rect.top + rect.height / 2;
        const line = lines.find(function (candidate) {
          const candidateCenter = candidate.top + candidate.height / 2;
          return Math.abs(candidateCenter - center) <= Math.max(2, Math.min(candidate.height, rect.height) * 0.35) &&
            rect.left <= candidate.right + maxGap;
        });

        if (!line) {
          lines.push({
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
          return;
        }

        const left = Math.min(line.left, rect.left);
        const top = Math.min(line.top, rect.top);
        const right = Math.max(line.right, rect.right);
        const bottom = Math.max(line.bottom, rect.bottom);

        line.left = left;
        line.top = top;
        line.right = right;
        line.bottom = bottom;
        line.width = right - left;
        line.height = bottom - top;
      });

    return lines;
  }

  function installTextRectProvider(element) {
    if (element._mtmNotationTextRectsInstalled) return;

    const originalGetClientRects = element.getClientRects.bind(element);
    element.getClientRects = function () {
      const rects = textRectsFor(element);
      return rects.length ? rects : originalGetClientRects();
    };

    element._mtmNotationTextRectsInstalled = true;
  }

  function fitAnnotationSvg(annotation) {
    const svg = annotation && annotation._svg;
    if (!svg || typeof svg.getBBox !== "function") return;

    try {
      const box = svg.getBBox();
      const pad = Math.max(8, Math.ceil((annotation.strokeWidth || 4) * 3));
      const x = Math.floor(box.x - pad);
      const y = Math.floor(box.y - pad);
      const width = Math.max(1, Math.ceil(box.width + pad * 2));
      const height = Math.max(1, Math.ceil(box.height + pad * 2));

      svg.setAttribute("viewBox", [x, y, width, height].join(" "));
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.style.left = x + "px";
      svg.style.top = y + "px";
      svg.style.width = width + "px";
      svg.style.height = height + "px";
      svg.style.overflow = "hidden";
      svg.style.contain = "layout paint";
    } catch (error) {}
  }

  function normalizedPadding(value) {
    if (typeof value === "number") return [value, value, value, value];
    if (!Array.isArray(value) || !value.length) return [5, 5, 5, 5];

    switch (value.length) {
      case 1:
        return [value[0], value[0], value[0], value[0]];
      case 2:
        return [value[0], value[1], value[0], value[1]];
      case 3:
        return [value[0], value[1], value[2], value[1]];
      default:
        return [value[0], value[1], value[2], value[3]];
    }
  }

  function svgRectFor(annotation, rect) {
    const svg = annotation && annotation._svg;
    if (!svg) return null;

    if (typeof annotation.svgRect === "function") {
      return annotation.svgRect(svg, rect);
    }

    const svgBox = svg.getBoundingClientRect();
    return {
      x: (rect.x || rect.left) - (svgBox.x || svgBox.left),
      y: (rect.y || rect.top) - (svgBox.y || svgBox.top),
      w: rect.width,
      h: rect.height
    };
  }

  const descenderProfiles = {
    g: { center: 0.5, left: 0.04, right: 0.88, width: 0.68, stroke: 3, font: 0.18, max: 0.94 },
    j: { center: 0.48, left: 0.04, right: 0.82, width: 0.7, stroke: 3.2, font: 0.19, max: 0.98 },
    p: { center: 0.3, width: 0.34, stroke: 2.35, font: 0.12, max: 0.58 },
    q: { center: 0.68, width: 0.38, stroke: 2.55, font: 0.13, max: 0.66 },
    y: { center: 0.52, left: 0.14, right: 0.86, width: 0.64, stroke: 3, font: 0.17, max: 0.9 },
    Q: { center: 0.76, width: 0.38, stroke: 2.45, font: 0.13, max: 0.62 }
  };

  function closestAnnotationLine(annotation, charRect) {
    const lines = annotation && annotation._lastSizes;
    if (!lines || !lines.length || !charRect) return null;

    const charCenterY = charRect.y + charRect.h / 2;
    const charCenterX = charRect.x + charRect.w / 2;
    let best = null;
    let bestDistance = Infinity;

    lines.forEach(function (line) {
      const lineCenterY = line.y + line.h / 2;
      const outsideX = charCenterX < line.x ? line.x - charCenterX : Math.max(0, charCenterX - (line.x + line.w));
      const distance = Math.abs(lineCenterY - charCenterY) + outsideX * 0.5;

      if (distance < bestDistance) {
        bestDistance = distance;
        best = line;
      }
    });

    return best;
  }

  function appendHeadingDescenderSkips(annotation, element) {
    const svg = annotation && annotation._svg;
    if (!svg || !annotation._lastSizes || !annotation._lastSizes.length) return;

    const text = element.textContent || "";
    if (!/[gjpqyQ]/.test(text)) return;

    const fontSize = fontSizeFor(element);
    const stroke = annotation.strokeWidth || 4;
    const skipStroke = Math.max(stroke + 4, stroke * 2.15);
    const padding = normalizedPadding(annotation.padding);
    const background = backgroundColorFor(element);
    const range = document.createRange();
    const skips = [];

    function collectSkip(char, rect) {
      const profile = descenderProfiles[char];
      const charRect = svgRectFor(annotation, rect);
      const line = closestAnnotationLine(annotation, charRect);
      if (!profile || !charRect || !line) return;

      const underlineY = line.y + line.h + padding[2];
      const centerX = charRect.x + charRect.w * profile.center;
      const width = Math.min(
        Math.max(stroke * profile.stroke, fontSize * profile.font, charRect.w * profile.width),
        Math.max(stroke * 2.3, charRect.w * profile.max)
      );
      let x1 = profile.left === undefined ? centerX - width / 2 : charRect.x + charRect.w * profile.left;
      let x2 = profile.right === undefined ? centerX + width / 2 : charRect.x + charRect.w * profile.right;

      if (x2 - x1 < width) {
        x1 = centerX - width / 2;
        x2 = centerX + width / 2;
      }

      skips.push({
        x1,
        x2,
        y: underlineY,
        lineStart: line.x,
        lineEnd: line.x + line.w
      });
    }

    function appendSkip(skip) {
      const mask = document.createElementNS("http://www.w3.org/2000/svg", "line");

      mask.setAttribute("class", "mtm-notation-descender-skip");
      mask.setAttribute("x1", String(skip.x1));
      mask.setAttribute("x2", String(skip.x2));
      mask.setAttribute("y1", String(skip.y));
      mask.setAttribute("y2", String(skip.y));
      mask.setAttribute("stroke", background);
      mask.setAttribute("stroke-width", String(skipStroke));
      mask.setAttribute("stroke-linecap", "round");
      mask.setAttribute("fill", "none");
      svg.appendChild(mask);
    }

    function normalizeSkips() {
      const edgeScrap = Math.max(stroke * 5, fontSize * 0.24);
      const mergeGap = Math.max(stroke * 2, fontSize * 0.055);

      skips.forEach(function (skip) {
        if (skip.x1 - skip.lineStart < edgeScrap) skip.x1 = skip.lineStart - stroke * 2;
        if (skip.lineEnd - skip.x2 < edgeScrap) skip.x2 = skip.lineEnd + stroke * 2;
      });

      skips.sort(function (a, b) {
        return Math.abs(a.y - b.y) > 1 ? a.y - b.y : a.x1 - b.x1;
      });

      return skips.reduce(function (merged, skip) {
        const previous = merged[merged.length - 1];

        if (previous &&
          Math.abs(previous.y - skip.y) <= 1 &&
          skip.x1 <= previous.x2 + mergeGap) {
          previous.x2 = Math.max(previous.x2, skip.x2);
          previous.lineStart = Math.min(previous.lineStart, skip.lineStart);
          previous.lineEnd = Math.max(previous.lineEnd, skip.lineEnd);
          return merged;
        }

        merged.push(Object.assign({}, skip));
        return merged;
      }, []);
    }

    if (document.createTreeWalker && window.NodeFilter) {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          return node.nodeValue && /[gjpqyQ]/.test(node.nodeValue) ?
            NodeFilter.FILTER_ACCEPT :
            NodeFilter.FILTER_REJECT;
        }
      });

      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let index = 0; index < node.nodeValue.length; index += 1) {
          const char = node.nodeValue.charAt(index);
          if (!descenderProfiles[char]) continue;

          range.setStart(node, index);
          range.setEnd(node, index + 1);

          Array.from(range.getClientRects()).forEach(function (rect) {
            if (rect.width > 1 && rect.height > 1) collectSkip(char, rect);
          });
        }
      }
    }

    range.detach();

    normalizeSkips().forEach(appendSkip);
  }

  function clearAnnotations() {
    annotations.forEach(function (annotation) {
      annotation.remove();
    });
    annotations = [];

    document.querySelectorAll(".mtm-notation-target").forEach(function (element) {
      element.classList.remove(
        "mtm-notation-target",
        "mtm-notation-heading",
        "mtm-notation-hero-emphasis",
        "mtm-notation-underline",
        "mtm-notation-highlight",
        "mtm-notation-strike"
      );
    });
  }

  function annotate(element, className, options) {
    if (shouldSkip(element)) return;

    installTextRectProvider(element);

    const animate = notationShouldAnimate(element);
    const loadAnimate = animate && notationLoadAnimationElement(element) && !notationAnimationElement(element);
    const config = Object.assign({
      animate,
      animationDuration: animate ? notationAnimationDuration(element) : 0,
      iterations: 1,
      multiline: true
    }, options);

    if (!animate) {
      config.animate = false;
      config.animationDuration = 0;
    }

    const annotation = roughNotation.annotate(element, config);
    annotation._seed = seedFor(element, className + "|" + config.type);

    element.classList.add("mtm-notation-target", className);
    annotations.push(annotation);

    if (!animate && typeof annotation.detachListeners === "function") {
      annotation.detachListeners();
    }

    annotation.show();
    if (annotation._svg && config.type) {
      annotation._svg.classList.add("mtm-notation-type-" + config.type);
    }
    if (className === "mtm-notation-heading") {
      appendHeadingDescenderSkips(annotation, element);
    }
    roundAnnotationStrokes(annotation);
    if (!animate) {
      fitAnnotationSvg(annotation);
    }

    if (annotation._svg) {
      annotation._svg.classList.toggle("mtm-notation-animated", animate);
      annotation._svg.classList.toggle("mtm-notation-static", !animate);
    }

    if (loadAnimate) {
      loadAnimated.add(element);
    }

    if (!animate && typeof annotation.detachListeners === "function") {
      annotation.detachListeners();
    }
  }

  function roundAnnotationStrokes(annotation) {
    const svg = annotation && annotation._svg;
    if (!svg) return;
    if (annotation._config && annotation._config.type === "highlight") return;

    svg.querySelectorAll("path, line, polyline").forEach(function (stroke) {
      stroke.setAttribute("stroke-linecap", "round");
      stroke.setAttribute("stroke-linejoin", "round");
    });
  }

  function headingTextTarget(element) {
    const existing = element.querySelector(":scope > .mtm-notation-heading-text, :scope > .mtm-heading-underline");
    if (existing) {
      existing.classList.add("mtm-notation-heading-text");
      return existing;
    }

    const nodes = Array.from(element.childNodes).filter(function (node) {
      return !(node.nodeType === 1 && node.classList.contains("anchor"));
    });

    if (!nodes.length) return null;

    const wrapper = document.createElement("span");
    wrapper.className = "mtm-notation-heading-text";

    nodes.forEach(function (node) {
      wrapper.appendChild(node);
    });

    const anchor = Array.from(element.children).find(function (child) {
      return child.classList.contains("anchor");
    });

    if (anchor) {
      element.insertBefore(wrapper, anchor);
    } else {
      element.appendChild(wrapper);
    }

    return wrapper;
  }

  function annotateHeading(element, index) {
    const target = headingTextTarget(element);
    if (!target) return;

    annotate(target, "mtm-notation-heading", {
      type: "underline",
      color: annotationColor(target, "heading"),
      strokeWidth: headingStrokeWidth(element),
      padding: headingUnderlinePadding(element)
    });
  }

  function annotateUnderline(element) {
    if (element.closest(headingSelector)) return;

    const kind = element.matches("u, ins") ? "inserted" : "link";

    annotate(element, "mtm-notation-underline", {
      type: "underline",
      color: annotationColor(element, kind),
      strokeWidth: underlineStrokeWidth(element, 3),
      padding: bodyUnderlinePadding(element)
    });
  }

  function createHeroEmphasisRecord(element) {
    if (shouldSkip(element)) return null;

    const loadSource = notationLoadAnimationElement(element);
    const explicitAnimate = notationAnimationElement(element);
    if (loadSource && !explicitAnimate && !loadAnimationsReady() && !loadAnimated.has(element)) {
      return null;
    }

    installTextRectProvider(element);

    const animate = notationShouldAnimate(element);
    const loadAnimate = animate && loadSource && !explicitAnimate;
    const config = {
      animate,
      animationDuration: animate ? notationAnimationDuration(element) : 0,
      iterations: 1,
      multiline: true,
      type: "underline",
      color: annotationColor(element, "heading"),
      roughness: 0.9,
      strokeWidth: 5,
      padding: headingUnderlinePadding(element)
    };

    if (!animate) {
      config.animate = false;
      config.animationDuration = 0;
    }

    const annotation = roughNotation.annotate(element, config);
    annotation._seed = seedFor(element, "mtm-notation-hero-emphasis|" + config.type);

    element.classList.add("mtm-notation-target", "mtm-notation-hero-emphasis");
    annotations.push(annotation);

    if (!animate && typeof annotation.detachListeners === "function") {
      annotation.detachListeners();
    }

    return {
      annotation,
      animate,
      config,
      element,
      loadAnimate
    };
  }

  function finishHeroEmphasisAnnotation(record) {
    const annotation = record.annotation;
    const config = record.config;

    if (annotation._svg && config.type) {
      annotation._svg.classList.add("mtm-notation-type-" + config.type);
    }

    roundAnnotationStrokes(annotation);
    if (!record.animate) {
      fitAnnotationSvg(annotation);
    }

    if (annotation._svg) {
      annotation._svg.classList.toggle("mtm-notation-animated", record.animate);
      annotation._svg.classList.toggle("mtm-notation-static", !record.animate);
    }

    if (!record.animate && typeof annotation.detachListeners === "function") {
      annotation.detachListeners();
    }
  }

  function annotateHeroEmphasisGroup() {
    const records = Array.from(document.querySelectorAll(heroEmphasisSelector))
      .map(createHeroEmphasisRecord)
      .filter(Boolean);

    if (!records.length) return;

    const shouldAnimate = records.some(function (record) { return record.animate; });
    const loadRecords = records.filter(function (record) { return record.loadAnimate; });

    if (loadRecords.length) {
      heroLoadAnimationActive = true;
      pendingDrawAfterHeroLoad = false;
      pendingRefreshAfterHeroLoad = false;
      if (heroLoadAnimationEndTimer) window.clearTimeout(heroLoadAnimationEndTimer);
    }

    if (shouldAnimate && typeof roughNotation.annotationGroup === "function") {
      roughNotation.annotationGroup(records.map(function (record) { return record.annotation; })).show();
    } else {
      records.forEach(function (record) {
        record.annotation.show();
      });
    }

    records.forEach(finishHeroEmphasisAnnotation);

    if (loadRecords.length) {
      heroLoadAnimationEndTimer = window.setTimeout(function () {
        finishHeroLoadAnimation(loadRecords);
      }, groupedAnimationDuration(records) + 120);
    }
  }

  function annotateHighlight(element) {
    annotate(element, "mtm-notation-highlight", {
      type: "highlight",
      color: annotationColor(element, "highlight"),
      padding: [1, 2, 1, 2]
    });
  }

  function annotateStrike(element) {
    const fontSize = fontSizeFor(element);

    annotate(element, "mtm-notation-strike", {
      type: "strike-through",
      color: annotationColor(element, "strike"),
      strokeWidth: Math.max(2, Math.min(4, fontSize * 0.12)),
      padding: [0, 1, 0, 1]
    });
  }

  function draw(refreshing) {
    if (heroLoadAnimationActive) {
      pendingDrawAfterHeroLoad = true;
      pendingRefreshAfterHeroLoad = pendingRefreshAfterHeroLoad || !!refreshing;
      return;
    }

    if (refreshing) beginRefresh();

    clearAnnotations();

    document.querySelectorAll(headingSelector).forEach(annotateHeading);
    annotateHeroEmphasisGroup();
    document.querySelectorAll(underlineSelector).forEach(annotateUnderline);
    document.querySelectorAll(highlightSelector).forEach(annotateHighlight);
    document.querySelectorAll(strikeSelector).forEach(annotateStrike);

    document.documentElement.classList.add("mtm-notation-ready");
    markReady();

    if (refreshing) endRefresh();
  }

  function drawNow(refreshing) {
    scheduled = false;
    draw(!!refreshing);
  }

  function scheduleDraw(delay) {
    if (scheduled) return;
    scheduled = true;

    window.setTimeout(function () {
      requestAnimationFrame(function () {
        scheduled = false;
        draw(false);
      });
    }, delay || 0);
  }

  function scheduleLoadAnimationWhenReady(attempt) {
    if (!pageFullyLoaded) return;

    if (effectsReadyForLoadAnimation() || (attempt || 0) > 40) {
      window.setTimeout(function () {
        requestAnimationFrame(function () {
          drawNow(false);
        });
      }, 50);
      return;
    }

    window.setTimeout(function () {
      scheduleLoadAnimationWhenReady((attempt || 0) + 1);
    }, 50);
  }

  scheduleDraw();
  if (pageFullyLoaded) {
    scheduleLoadAnimationWhenReady(0);
  }

  window.addEventListener("load", function () {
    pageFullyLoaded = true;
    scheduleLoadAnimationWhenReady(0);
  });
  window.addEventListener("resize", function () {
    const width = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
    if (Math.abs(width - lastViewportWidth) < 2) return;

    lastViewportWidth = width;
    scheduleDraw(120);
  }, { passive: true });
  window.addEventListener("orientationchange", function () { scheduleDraw(240); }, { passive: true });

  document.addEventListener("toggle", function () { scheduleDraw(40); }, true);
  document.addEventListener("click", function (event) {
    if (event.target.closest("details.toc summary, #menu .menu-trigger")) {
      scheduleDraw(80);
    }
  }, true);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { scheduleDraw(10); });
  }

  if (window.matchMedia) {
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onColorSchemeChange = function () {
      drawNow(true);
    };

    if (typeof colorSchemeQuery.addEventListener === "function") {
      colorSchemeQuery.addEventListener("change", onColorSchemeChange);
    } else if (typeof colorSchemeQuery.addListener === "function") {
      colorSchemeQuery.addListener(onColorSchemeChange);
    }
  }

  document.addEventListener("mtm:notation-redraw", function () {
    scheduleDraw(0);
  });

  document.addEventListener("mtm:theme-changed", function () {
    drawNow(true);
  });
})();
