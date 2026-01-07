document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".js-counted-textarea").forEach(ta => {
    ta.dispatchEvent(new Event("input"));
  });
});

document.addEventListener("scroll", () => {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  nav.classList.toggle("scrolled", window.scrollY > 6);
});

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLTextAreaElement)) return;
  if (!el.classList.contains("textarea")) return;

  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 520) + "px";
});

document.addEventListener("input", (e) => {
  const ta = e.target;
  if (!ta.classList.contains("js-counted-textarea")) return;

  const counter = ta.parentElement.querySelector(".js-char-count");
  if (!counter) return;

  const max = ta.getAttribute("maxlength") || 4000;
  counter.textContent = `${ta.value.length} / ${max} characters`;
});

function ensureToastRoot() {
  let root = document.querySelector(".toast-root");
  if (!root) {
    root = document.createElement("div");
    root.className = "toast-root";
    document.body.appendChild(root);
  }
  return root;
}

function toast({ type = "info", title = "Info", message = "", ms = 2800 } = {}) {
  const root = ensureToastRoot();

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `
    <div class="dot"></div>
    <div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="msg">${escapeHtml(message)}</div>
    </div>
  `;

  root.appendChild(el);

  window.setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "opacity .18s ease, transform .18s ease";
    window.setTimeout(() => el.remove(), 200);
  }, ms);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Navbar shadow on scroll
document.addEventListener("scroll", () => {
  const nav = document.querySelector(".nav");
  if (!nav) return;
  nav.classList.toggle("scrolled", window.scrollY > 6);
});

// Auto-grow textarea
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLTextAreaElement)) return;
  if (!el.classList.contains("textarea")) return;

  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 520) + "px";
});

// Loading state for tool forms
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;

  // Only for tool run forms
  if (!form.classList.contains("js-tool-form")) return;

  const btn = form.querySelector("button[type='submit']");
  if (!btn) return;

  btn.disabled = true;
  btn.classList.add("is-loading");

  // Swap button label if it has .btn-text
  const text = btn.querySelector(".btn-text");
  if (text) text.textContent = "Running…";

  // Save a “pending toast”
  try {
    localStorage.setItem("aipass_pending_toast", JSON.stringify({
      t: Date.now(),
      type: "info",
      title: "Working",
      message: "Running the tool and charging credits…"
    }));
  } catch {}

  // Immediate toast
  toast({ type: "info", title: "Working", message: "Running the tool and charging credits…" });
});

// After page load: show success/error toast=
document.addEventListener("DOMContentLoaded", () => {
  try {
    const raw = localStorage.getItem("aipass_pending_toast");
    if (raw) {
      const obj = JSON.parse(raw);
      localStorage.removeItem("aipass_pending_toast");
      if (obj && Date.now() - obj.t < 120000) {
      }
    }
  } catch {}

  const page = document.body;
  const result = page.getAttribute("data-has-result");
  const err = page.getAttribute("data-has-error");

  if (err === "1") {
    toast({ type: "error", title: "Something went wrong", message: "Check the message on the page." });
  } else if (result === "1") {
    toast({ type: "success", title: "Done", message: "Tool completed successfully." });
  }
});

// Copy result button
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".js-copy-result");
  if (!btn) return;

  const targetId = btn.dataset.copyTarget;
  const el = document.getElementById(targetId);
  if (!el) return;

  try {
    await navigator.clipboard.writeText(el.innerText);

    btn.textContent = "Copied!";
    btn.disabled = true;

    window.AIPassToast?.({
      type: "success",
      title: "Copied",
      message: "Result copied to clipboard.",
    });

    setTimeout(() => {
      btn.textContent = "Copy";
      btn.disabled = false;
    }, 1200);
  } catch {
    window.AIPassToast?.({
      type: "error",
      title: "Copy failed",
      message: "Could not copy to clipboard.",
    });
  }
});

window.AIPassToast = toast;
