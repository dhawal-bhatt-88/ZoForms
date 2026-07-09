/* Frame embed — inline & popup form embedding.
 *
 *   <script src="https://your-frame/embed.js"></script>
 *   <div data-frame-form="my-form-slug"></div>              // inline (auto-resizes)
 *   <button data-frame-popup="my-form-slug">Open</button>   // popup
 */
(function () {
  var base = (function () {
    var s =
      document.currentScript ||
      (function () {
        var all = document.getElementsByTagName("script");
        return all[all.length - 1];
      })();
    try {
      return new URL(s.src).origin;
    } catch (e) {
      return "";
    }
  })();

  function iframe(slug, height) {
    var f = document.createElement("iframe");
    f.src = base + "/r/" + encodeURIComponent(slug) + "?embed=1";
    f.title = "Frame form";
    f.loading = "lazy";
    f.setAttribute("data-frame-slug", slug);
    f.style.cssText =
      "width:100%;border:0;background:transparent;height:" + (height || "600px");
    return f;
  }

  function mountInline() {
    var nodes = document.querySelectorAll(
      "[data-frame-form]:not([data-frame-ready])"
    );
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute("data-frame-ready", "1");
      nodes[i].appendChild(iframe(nodes[i].getAttribute("data-frame-form")));
    }
  }

  function openPopup(slug) {
    var overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(20,22,28,.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px";
    var box = document.createElement("div");
    box.style.cssText =
      "position:relative;width:100%;max-width:640px;height:min(80vh,720px);background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35)";
    var close = document.createElement("button");
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Close");
    close.style.cssText =
      "position:absolute;top:10px;right:12px;z-index:2;width:32px;height:32px;border:0;border-radius:8px;background:rgba(0,0,0,.06);cursor:pointer;font-size:22px;line-height:1;color:#333";
    var f = iframe(slug, "100%");
    box.appendChild(close);
    box.appendChild(f);
    overlay.appendChild(box);
    function dismiss() {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") dismiss();
    }
    close.addEventListener("click", dismiss);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) dismiss();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
  }

  function mountPopups() {
    var btns = document.querySelectorAll(
      "[data-frame-popup]:not([data-frame-ready])"
    );
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.setAttribute("data-frame-ready", "1");
        b.addEventListener("click", function () {
          openPopup(b.getAttribute("data-frame-popup"));
        });
      })(btns[i]);
    }
  }

  // auto-resize inline iframes when the form reports its height
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object" || !d.frameHeight || !d.frameSlug) return;
    var f = document.querySelector(
      'iframe[data-frame-slug="' + d.frameSlug + '"]'
    );
    if (f) f.style.height = d.frameHeight + 8 + "px";
  });

  function init() {
    mountInline();
    mountPopups();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
