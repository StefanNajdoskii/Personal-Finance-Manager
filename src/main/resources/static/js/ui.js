// Shared UI helpers: escaping, icons, toasts, confirm dialog, count-up numbers,
// inline form messages.

export function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[ch]);
}

export function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Replaces <i data-lucide> placeholders with SVG icons (Lucide loaded from CDN). */
export function refreshIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
}

export function icon(name) {
    return `<i data-lucide="${name}" aria-hidden="true"></i>`;
}

export function setMessage(element, text, kind = "error") {
    element.textContent = text;
    element.classList.toggle("error", kind === "error" && Boolean(text));
    element.classList.toggle("success", kind === "success" && Boolean(text));
}

export function setFieldError(input, message) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
    const error = input.closest(".field")?.querySelector(".field-error");
    if (error) error.textContent = message || "";
}

export function toast(message, kind = "success") {
    const stack = document.getElementById("toasts");
    if (!stack) return;

    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.setAttribute("role", kind === "error" ? "alert" : "status");
    el.innerHTML = `${icon(kind === "error" ? "circle-alert" : "circle-check")}<span></span>`;
    el.querySelector("span").textContent = message;
    stack.append(el);
    refreshIcons();

    setTimeout(() => {
        el.classList.add("toast-out");
        setTimeout(() => el.remove(), 260);
    }, 3800);
}

/** Opens a native <dialog> with a confirm/cancel pair. Resolves true only for "ok". */
export function confirmAction(message) {
    const dialog = document.getElementById("confirmDialog");
    document.getElementById("confirmMessage").textContent = message;

    return new Promise(resolve => {
        const onClose = () => {
            dialog.removeEventListener("close", onClose);
            resolve(dialog.returnValue === "ok");
        };
        dialog.addEventListener("close", onClose);
        dialog.returnValue = "";
        dialog.showModal();
        dialog.querySelector('button[value="ok"]').focus();
    });
}

/** Animates a number from its previous value to `to`. Instant with reduced motion. */
export function animateNumber(element, to, format, duration = 800) {
    if (!Number.isFinite(to) || prefersReducedMotion()) {
        element.textContent = format(to);
        element.dataset.value = String(to);
        return;
    }

    const from = Number(element.dataset.value) || 0;
    element.dataset.value = String(to);
    const start = performance.now();

    const step = now => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = format(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
}

export function emptyState({ icon: iconName, title, text, action, actionLabel, error = false }) {
    return `
        <div class="empty${error ? " error" : ""}">
            <span class="empty-icon">${icon(iconName)}</span>
            <h3>${escapeHtml(title)}</h3>
            ${text ? `<p>${escapeHtml(text)}</p>` : ""}
            ${action ? `<button type="button" class="btn ${error ? "btn-ghost" : "btn-primary"}" data-action="${action}">${escapeHtml(actionLabel)}</button>` : ""}
        </div>`;
}
