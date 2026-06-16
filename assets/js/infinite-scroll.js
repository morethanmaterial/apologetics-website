(function () {
  "use strict";

  // Prevent browser reload/back-forward from restoring the old bottom scroll position.
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // On normal reload, start at the top instead of immediately re-triggering infinite scroll.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted || performance.getEntriesByType("navigation")[0]?.type === "reload") {
      window.scrollTo(0, 0);
    }
  });

  const enabledPaths = [
    /^\/$/,
    /^\/page\/\d+\/?$/,
    /^\/posts\/?$/,
    /^\/posts\/page\/\d+\/?$/
  ];

  if (!enabledPaths.some((re) => re.test(window.location.pathname))) {
    return;
  }

  function findPagination(doc) {
    return (
      doc.querySelector("footer.page-footer nav.pagination") ||
      doc.querySelector("nav.pagination") ||
      doc.querySelector(".pagination")
    );
  }

  function getNextURL(doc) {
    const pagination = findPagination(doc);
    if (!pagination) return null;

    // IMPORTANT: only follow the actual PaperMod next link.
    // Do not fallback to "last link", because on the final page that may be "Prev".
    const next =
      pagination.querySelector("a.next[href]") ||
      pagination.querySelector('a[rel="next"][href]');

    if (!next) return null;

    const url = new URL(next.getAttribute("href"), window.location.href);

    // Force same origin as the current browser page, useful for LAN testing.
    return window.location.origin + url.pathname + url.search + url.hash;
  }

  function getPostEntries(doc) {
    // Only real post cards. Do NOT include .first-entry, because PaperMod uses
    // .first-entry.home-info for the homepage intro block.
    return Array.from(doc.querySelectorAll("main article.post-entry"));
  }

  const pagination = findPagination(document);
  let nextURL = getNextURL(document);

  if (!pagination || !nextURL) {
    return;
  }

  pagination.style.display = "none";

  const parent = pagination.parentElement;

  const controls = document.createElement("div");
  controls.className = "infinite-scroll-controls";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "infinite-scroll-button";
  button.textContent = "Load more articles";

  const status = document.createElement("p");
  status.className = "infinite-scroll-status";
  status.setAttribute("aria-live", "polite");

  const sentinel = document.createElement("div");
  sentinel.className = "infinite-scroll-sentinel";
  sentinel.setAttribute("aria-hidden", "true");

  controls.appendChild(button);
  controls.appendChild(status);

  parent.insertBefore(controls, pagination);
  parent.insertBefore(sentinel, pagination);

  let loading = false;
  let finished = false;

  async function loadMore() {
    if (loading || finished || !nextURL) return;

    loading = true;
    button.disabled = true;
    button.textContent = "Loading...";
    status.textContent = "Loading more articles...";

    try {
      const response = await fetch(nextURL, {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Could not load " + nextURL + " HTTP " + response.status);
      }

      const html = await response.text();
      const nextDoc = new DOMParser().parseFromString(html, "text/html");

      const entries = getPostEntries(nextDoc);

      if (!entries.length) {
        finished = true;
        button.textContent = "All articles loaded";
        button.disabled = true;
        status.textContent = "All articles loaded.";
        sentinel.remove();
        return;
      }

      for (const entry of entries) {
        parent.insertBefore(entry, controls);
      }

      nextURL = getNextURL(nextDoc);

      if (!nextURL) {
        finished = true;
        button.textContent = "All articles loaded";
        button.disabled = true;
        status.textContent = "All articles loaded.";
        sentinel.remove();
      } else {
        button.textContent = "Load more articles";
        button.disabled = false;
        status.textContent = "";
      }
    } catch (error) {
      console.error("[infinite-scroll]", error);
      button.textContent = "Try loading again";
      button.disabled = false;
      status.textContent = error.message;
    } finally {
      loading = false;
    }
  }

  button.addEventListener("click", loadMore);

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      {
        rootMargin: "300px 0px"
      }
    );

    observer.observe(sentinel);
  }
})();
