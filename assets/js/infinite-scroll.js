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
  const paginationFooter = pagination && pagination.closest("footer.page-footer");
  const paginationNode = paginationFooter || pagination;
  const listParent = paginationNode && paginationNode.parentElement;

  if (!pagination || !nextURL || !paginationNode || !listParent) {
    return;
  }

  pagination.style.display = "none";

  const controls = document.createElement("div");
  controls.className = "infinite-scroll-controls";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "infinite-scroll-button";
  button.textContent = "Load more articles";

  const status = document.createElement("p");
  status.className = "infinite-scroll-status";
  status.setAttribute("aria-live", "polite");
  status.hidden = true;

  const sentinel = document.createElement("div");
  sentinel.className = "infinite-scroll-sentinel";
  sentinel.setAttribute("aria-hidden", "true");

  controls.appendChild(button);
  controls.appendChild(status);

  listParent.insertBefore(controls, paginationNode);
  listParent.insertBefore(sentinel, paginationNode);

  let loading = false;
  let finished = false;

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  async function loadMore() {
    if (loading || finished || !nextURL) return;

    loading = true;
    button.disabled = true;
    button.textContent = "Loading...";
    setStatus("");

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
        setStatus("");
        sentinel.remove();
        return;
      }

      for (const entry of entries) {
        listParent.insertBefore(entry, controls);
      }

      document.dispatchEvent(new CustomEvent("mtm:notation-redraw"));

      nextURL = getNextURL(nextDoc);

      if (!nextURL) {
        finished = true;
        button.textContent = "All articles loaded";
        button.disabled = true;
        setStatus("");
        sentinel.remove();
      } else {
        button.textContent = "Load more articles";
        button.disabled = false;
        setStatus("");
      }
    } catch (error) {
      console.error("[infinite-scroll]", error);
      button.textContent = "Try loading again";
      button.disabled = false;
      setStatus(error.message);
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
