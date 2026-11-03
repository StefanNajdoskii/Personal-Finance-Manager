// Floating AI assistant: sends a question to POST /api/ask and shows the answer.
// Only visible while logged in (CSS). Messages are written as text, never as HTML.

import { api } from "./api.js";
import { t } from "./i18n.js";

let busy = false;

const $ = id => document.getElementById(id);

function scrollToBottom() {
    const list = $("assistantMessages");
    list.scrollTop = list.scrollHeight;
}

function setOpen(open) {
    $("assistantPanel").hidden = !open;
    $("assistantToggle").setAttribute("aria-expanded", String(open));
    if (open) {
        $("assistantInput").focus();
        scrollToBottom();
    }
}

function setBusy(isBusy) {
    busy = isBusy;
    $("assistantInput").disabled = isBusy;
    $("assistantSend").disabled = isBusy;
    document.querySelectorAll(".assistant-chip").forEach(chip => {
        chip.disabled = isBusy;
    });
}

function addMessage(kind, text) {
    const el = document.createElement("div");
    el.className = `msg msg-${kind}`;
    el.textContent = text;
    $("assistantMessages").appendChild(el);
    scrollToBottom();
    return el;
}

/** The "Thinking..." bubble. Its text and dots are created here, so no user input is involved. */
function addThinking() {
    const el = addMessage("bot", t("assistantThinking"));
    el.classList.add("msg-thinking");
    el.setAttribute("role", "status");

    const dots = document.createElement("span");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    el.appendChild(dots);
    return el;
}

/** Replaces a bubble's content and style in place. */
function updateMessage(el, kind, text) {
    el.className = `msg msg-${kind}`;
    el.removeAttribute("role");
    el.textContent = text;
    scrollToBottom();
}

function errorText(error) {
    if (error.status === 401) return t("assistantSessionExpired");
    if (error.status === 0) return t("assistantUnreachable");
    return t("assistantError");
}

/**
 * Sends one question and shows the answer. Used by both the typed form and the
 * suggestion chips, so a chip behaves exactly like typed text.
 */
async function sendQuestion(question) {
    if (!question || busy) return;

    setBusy(true);
    addMessage("user", question);
    const thinking = addThinking();

    try {
        const { answer } = await api.ask(question);
        updateMessage(thinking, "bot", (answer || "").trim() || t("assistantEmpty"));
    } catch (error) {
        updateMessage(thinking, "error", errorText(error));
    } finally {
        setBusy(false);
    }
}

async function handleSubmit(event) {
    event.preventDefault();
    const input = $("assistantInput");
    const question = input.value.trim();
    if (!question || busy) return;

    input.value = "";
    await sendQuestion(question);
    input.focus();
}

/** Clears the conversation. Called on logout so one user's answers are not left on screen. */
export function resetAssistant() {
    const list = $("assistantMessages");
    // Keep the welcome message (first child); it is translated through data-i18n
    while (list.children.length > 1) list.lastElementChild.remove();
    setOpen(false);
}

export function initAssistant() {
    $("assistantToggle").addEventListener("click", () => setOpen($("assistantPanel").hidden));
    $("assistantClose").addEventListener("click", () => {
        setOpen(false);
        $("assistantToggle").focus();
    });
    $("assistantForm").addEventListener("submit", handleSubmit);

    // The chip's text is its question, already translated by applyI18n
    document.querySelectorAll(".assistant-chip").forEach(chip => {
        chip.addEventListener("click", () => sendQuestion(chip.textContent.trim()));
    });

    $("assistantPanel").addEventListener("keydown", event => {
        if (event.key === "Escape") {
            setOpen(false);
            $("assistantToggle").focus();
        }
    });
}
