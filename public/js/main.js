/* ============================================================
   NIGHTWATCH AVIATION, interactions  ·  v1
   ============================================================ */
(function () {
  "use strict";

  /* ---------- Mobile menu ---------- */
  var toggle = document.getElementById("nav-toggle");
  var menu = document.getElementById("site-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Header scrolled state ---------- */
  var header = document.getElementById("site-header");
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 12) header.classList.add("scrolled");
    else header.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- Video cards (click to play YouTube inline) ---------- */
  var cards = document.querySelectorAll(".video-card");
  cards.forEach(function (card) {
    var thumb = card.querySelector(".video-thumb");
    var id = card.getAttribute("data-yt") || "";
    var todo = card.getAttribute("data-todo") || "";
    var isReal = id && id !== "00000000000";

    if (isReal) {
      // Inject a real thumbnail so the first card looks finished
      var img = document.createElement("img");
      img.src = "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg";
      img.alt = card.querySelector("h3") ? card.querySelector("h3").textContent : "Video preview";
      img.loading = "lazy";
      thumb.insertBefore(img, thumb.firstChild);
    } else {
      // Placeholder card, styled panel, no broken image
      thumb.setAttribute("data-todo", todo);
    }

    if (thumb) {
      thumb.setAttribute("role", "button");
      thumb.setAttribute("tabindex", "0");
      thumb.setAttribute("aria-label", "Play video: " + (card.querySelector("h3") ? card.querySelector("h3").textContent : ""));

      function play() {
        if (!isReal) {
          // Graceful message for placeholder clips
          var badge = thumb.querySelector(".badge");
          if (badge) { badge.textContent = "Clip coming soon"; badge.style.color = "#fbbf24"; }
          thumb.style.transition = "opacity .15s ease";
          thumb.style.opacity = ".55";
          setTimeout(function () { thumb.style.opacity = "1"; }, 600);
          return;
        }
        // Replace thumb with a live player
        var wrap = document.createElement("div");
        wrap.className = "video-embed";
        var ifr = document.createElement("iframe");
        ifr.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1";
        ifr.title = card.querySelector("h3") ? card.querySelector("h3").textContent : "Video";
        ifr.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        ifr.allowFullscreen = true;
        wrap.appendChild(ifr);
        thumb.parentNode.replaceChild(wrap, thumb);
      }

      thumb.addEventListener("click", play);
      thumb.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(); }
      });
    }
  });

  /* ---------- Footer year ---------- */
  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
})();
