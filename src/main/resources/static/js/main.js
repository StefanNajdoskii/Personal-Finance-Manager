// Entry point: wires the modules together and switches between the logged-out
// (auth screen) and logged-in (app) states.

import { applyI18n, getLang, setLang, t } from "./i18n.js";
import { resetState, state } from "./state.js";
import { setUnauthorizedHandler } from "./api.js";
import { checkSession, initAuth, logout } from "./auth.js";
import { initForms, openAddTransaction } from "./forms.js";
import { clearFilters, initDashboard, loadAll, renderDashboard, renderLists } from "./dashboard.js";
import { icon, refreshIcons, toast } from "./ui.js";

const $ = id => document.getElementById(id);

const THEME_KEY = "fintrack-theme";
const SIDEBAR_KEY = "fintrack-sidebar";

const VIEWS = {
    dashboard: { eyebrow: "eyebrowDashboard", title: "titleDashboard" },
    transactions: { eyebrow: "eyebrowTransactions", title: "titleTransactions" },
    settings: { eyebrow: "eyebrowSettings", title: "titleSettings" },
};

// ---------- Theme ----------

function applyTheme(theme, { persist = true } = {}) {
    document.documentElement.dataset.theme = theme;
    if (persist) localStorage.setItem(THEME_KEY, theme);

    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.checked = radio.value === theme;
        radio.closest(".seg")?.classList.toggle("is-active", radio.checked);
    });

    const toggle = $("themeToggle");
    toggle.innerHTML = icon(theme === "dark" ? "sun" : "moon");
    toggle.setAttribute("aria-label", t("switchTheme"));
    refreshIcons();

    // Charts read their colours from the theme, so redraw them
    if (state.user) renderDashboard();
}

function initTheme() {
    const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    applyTheme(theme, { persist: false });

    $("themeToggle").addEventListener("click", () => {
        const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
        applyTheme(next);
    });

    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener("change", () => applyTheme(radio.value));
    });
}

// ---------- Language ----------

function refreshLanguageDependentText() {
    applyI18n();
    updateViewTitle(currentView());
    $("languageSelect").value = getLang();
    $("themeToggle").setAttribute("aria-label", t("switchTheme"));
    if (state.user) {
        $("settingsUser").textContent = t("signedInAs", { name: state.user.username });
        renderDashboard();
    }
}

function initLanguage() {
    const select = $("languageSelect");
    select.value = getLang();
    select.addEventListener("change", () => {
        setLang(select.value);
        refreshLanguageDependentText();
    });
}

// ---------- Sidebar ----------

function setSidebarCollapsed(collapsed) {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
    const toggle = $("sidebarToggle");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.innerHTML = icon(collapsed ? "panel-left-open" : "panel-left-close");
    refreshIcons();
}

function initSidebar() {
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
    $("sidebarToggle").addEventListener("click", () => {
        setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
    });
}

// ---------- Navigation (hash-based views) ----------

function currentView() {
    const name = location.hash.replace("#", "");
    return VIEWS[name] ? name : "dashboard";
}

function updateViewTitle(name) {
    $("viewEyebrow").textContent = t(VIEWS[name].eyebrow);
    $("viewTitle").textContent = t(VIEWS[name].title);
    document.title = `FinTrack · ${t(VIEWS[name].title)}`;
}

function showView(name) {
    document.querySelectorAll(".view").forEach(view => {
        view.hidden = view.dataset.view !== name;
    });

    document.querySelectorAll("[data-nav]").forEach(link => {
        if (link.dataset.nav === name) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    });

    updateViewTitle(name);
}

function initNavigation() {
    window.addEventListener("hashchange", () => showView(currentView()));
}

// ---------- Global search (filters transactions) ----------

function initSearch() {
    $("globalSearch").addEventListener("input", event => {
        state.filters.search = event.target.value;
        if (event.target.value && currentView() !== "transactions") {
            location.hash = "#transactions";
        }
        renderLists();
    });
}

// ---------- Buttons with data-action ----------

function initActions() {
    document.addEventListener("click", event => {
        const trigger = event.target.closest("[data-action]");
        if (!trigger) return;

        switch (trigger.dataset.action) {
            case "add-transaction":
                openAddTransaction();
                break;
            case "retry-data":
                loadAll();
                break;
            case "clear-filters":
                clearFilters();
                break;
            case "view-transactions":
                location.hash = "#transactions";
                break;
            default:
                break;
        }
    });
}

// ---------- Logged-in / logged-out ----------

function startApp(user) {
    state.user = user;
    $("currentUsername").textContent = user.username;
    $("avatar").textContent = user.username.charAt(0).toUpperCase();
    $("settingsUser").textContent = t("signedInAs", { name: user.username });

    document.body.classList.remove("logged-out");
    document.body.classList.add("logged-in");

    showView(currentView());
    loadAll();
}

function stopApp() {
    resetState();

    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    $("globalSearch").value = "";
    $("currentUsername").textContent = t("personalAccount");
    $("avatar").textContent = "S";

    document.body.classList.remove("logged-in");
    document.body.classList.add("logged-out");
}

function initLogout() {
    const handler = () => logout();
    $("logoutBtn").addEventListener("click", handler);
    $("settingsLogoutBtn").addEventListener("click", handler);
}

// ---------- Boot ----------

async function init() {
    applyI18n();
    refreshIcons();

    initTheme();
    initLanguage();
    initSidebar();
    initNavigation();
    initSearch();
    initActions();
    initLogout();
    initForms();
    initDashboard();

    setUnauthorizedHandler(() => {
        if (document.body.classList.contains("logged-in")) {
            stopApp();
            toast(t("sessionExpired"), "error");
        }
    });

    initAuth({
        onLogin: user => startApp(user),
        onLogout: () => stopApp(),
    });

    // Keep the user signed in across refreshes if the session cookie is still valid
    const user = await checkSession();
    if (user) startApp(user);
    else stopApp();

    refreshIcons();
}

init();
