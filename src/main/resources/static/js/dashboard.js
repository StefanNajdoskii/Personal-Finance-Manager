// Dashboard: hero balance, stats, charts, accounts, transaction lists and filters.

import { api } from "./api.js";
import { state } from "./state.js";
import { t } from "./i18n.js";
import {
    accountIcon,
    categoryIcon,
    colorFor,
    formatDate,
    formatMoney,
    formatPercent,
    lastMonths,
    loadRates,
    monthKey,
    monthLabel,
    toMkd,
} from "./format.js";
import { animateNumber, emptyState, escapeHtml, icon, refreshIcons } from "./ui.js";
import { renderCharts } from "./charts.js";
import { deleteAccount, openAddAccount } from "./forms.js";

const MONTHS = 6;
const FALLBACK_RATES = { EUR: 61.5, USD: 56.5, approximate: true };

const $ = id => document.getElementById(id);
const fmtMkd = value => formatMoney(value, "MKD");

// ---------- Data loading ----------

export async function loadAll() {
    showSkeletons();

    const [accounts, transactions, rates] = await Promise.allSettled([
        api.getAccounts(),
        api.getTransactions(),
        loadRates(),
    ]);

    state.accountsError = accounts.status === "rejected";
    state.accounts = accounts.status === "fulfilled" ? accounts.value : [];
    state.transactionsError = transactions.status === "rejected";
    state.transactions = transactions.status === "fulfilled" ? transactions.value : [];
    state.rates = rates.status === "fulfilled" ? rates.value : FALLBACK_RATES;

    renderDashboard();
}

// ---------- Derived numbers ----------

function summarize() {
    const rates = state.rates || FALLBACK_RATES;
    const keys = lastMonths(MONTHS);
    const thisKey = keys[keys.length - 1];
    const lastKey = keys[keys.length - 2];
    const series = Object.fromEntries(keys.map(k => [k, { income: 0, expense: 0 }]));
    const categoryTotals = new Map();

    for (const tx of state.transactions) {
        const value = toMkd(tx.amount, tx.account?.currency, rates);
        if (value === null) continue;

        const key = monthKey(tx.date);
        if (series[key]) {
            if (tx.type === "INCOME") series[key].income += value;
            if (tx.type === "EXPENSE") series[key].expense += value;
        }

        if (key === thisKey && tx.type === "EXPENSE") {
            const name = tx.category?.trim() || t("uncategorized");
            categoryTotals.set(name, (categoryTotals.get(name) || 0) + value);
        }
    }

    return { keys, thisKey, lastKey, series, categoryTotals };
}

function percentChange(now, before) {
    if (!before) return null;
    return ((now - before) / Math.abs(before)) * 100;
}

/** Trend pill. For expenses an increase is bad, so goodWhenUp is false. */
function trendPill(pct, goodWhenUp = true) {
    if (pct === null) {
        return `<span class="trend neutral" title="${escapeHtml(t("noTrend"))}">—</span>`;
    }
    const up = pct >= 0;
    const good = goodWhenUp ? up : !up;
    const arrow = up ? "arrow-up-right" : "arrow-down-right";
    return `<span class="trend ${good ? "good" : "bad"}">${icon(arrow)}${formatPercent(pct)}</span>`;
}

function sparkline(values, color) {
    if (!values.length) return "";
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const step = values.length > 1 ? 100 / (values.length - 1) : 0;
    const points = values
        .map((v, i) => `${(i * step).toFixed(2)},${(36 - ((v - min) / range) * 30 + 2).toFixed(2)}`)
        .join(" ");
    return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${points}" fill="none" style="stroke:${color}; stroke-width:2px"
            stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

// ---------- Rendering ----------

export function renderDashboard() {
    renderHero();
    renderStats();
    renderAccounts();
    renderFilterBars();
    renderLists();
    renderChartsSection();
    refreshIcons();
}

function renderHero() {
    const amount = $("heroBalance");
    const change = $("heroChange");
    const note = $("heroNote");
    const rates = state.rates || FALLBACK_RATES;

    if (state.accountsError) {
        amount.textContent = "—";
        change.innerHTML = "";
        note.textContent = t("accountsLoadError");
        return;
    }

    let total = 0;
    let excluded = 0;
    for (const account of state.accounts) {
        const value = toMkd(account.balance, account.currency, rates);
        if (value === null) excluded++;
        else total += value;
    }
    animateNumber(amount, total, fmtMkd);

    const { thisKey, lastKey, series } = summarize();
    const thisNet = series[thisKey].income - series[thisKey].expense;
    const lastNet = series[lastKey].income - series[lastKey].expense;
    change.innerHTML = `${trendPill(percentChange(thisNet, lastNet), true)}
        <span>${escapeHtml(t("vsLastMonth"))}</span>`;

    const notes = [];
    if (excluded) notes.push(t("heroNote", { count: excluded }));
    if (rates.approximate) notes.push(t("approxRates"));
    note.textContent = notes.join(" ");
}

function renderStats() {
    const { keys, thisKey, lastKey, series } = summarize();
    const incomeSeries = keys.map(k => series[k].income);
    const expenseSeries = keys.map(k => series[k].expense);
    const savingsSeries = keys.map(k => series[k].income - series[k].expense);

    const thisIncome = series[thisKey].income;
    const thisExpense = series[thisKey].expense;
    const thisSavings = thisIncome - thisExpense;
    const lastIncome = series[lastKey].income;
    const lastExpense = series[lastKey].expense;
    const lastSavings = lastIncome - lastExpense;

    const values = {
        income: { value: thisIncome, pct: percentChange(thisIncome, lastIncome), series: incomeSeries, goodWhenUp: true, color: "var(--success)" },
        expenses: { value: thisExpense, pct: percentChange(thisExpense, lastExpense), series: expenseSeries, goodWhenUp: false, color: "var(--danger)" },
        savings: { value: thisSavings, pct: percentChange(thisSavings, lastSavings), series: savingsSeries, goodWhenUp: true, color: "var(--accent-text)" },
    };

    for (const [name, stat] of Object.entries(values)) {
        const valueEl = $(`stat-${name}`);
        animateNumber(valueEl, stat.value, fmtMkd);
        $(`trend-${name}`).innerHTML = trendPill(stat.pct, stat.goodWhenUp);
        $(`spark-${name}`).innerHTML = sparkline(stat.series, stat.color);
    }
}

function accountCard(account) {
    const typeLabel = account.type ? account.type.charAt(0) + account.type.slice(1).toLowerCase() : "";
    const meta = [account.institution, typeLabel].filter(Boolean).join(" · ");
    const name = escapeHtml(account.name);

    return `
        <article class="card account-card">
            <div class="account-top">
                <span class="acc-icon">${icon(accountIcon(account.type))}</span>
                <div>
                    <h3 title="${name}">${name}</h3>
                    <p>${escapeHtml(meta) || "&nbsp;"}</p>
                </div>
                <div class="menu-wrap">
                    <button type="button" class="icon-btn" data-menu-toggle="${account.id}"
                            aria-haspopup="menu" aria-expanded="false"
                            aria-label="${escapeHtml(t("accountActions"))}: ${name}">${icon("ellipsis")}</button>
                    <div class="menu" role="menu" data-menu="${account.id}" hidden>
                        <button type="button" role="menuitem" disabled title="${escapeHtml(t("editSoon"))}">
                            ${icon("pencil")}${escapeHtml(t("edit"))}
                        </button>
                        <button type="button" role="menuitem" class="danger" data-delete-account="${account.id}">
                            ${icon("trash-2")}${escapeHtml(t("delete"))}
                        </button>
                    </div>
                </div>
            </div>
            <p class="account-balance">${escapeHtml(formatMoney(account.balance, account.currency))}</p>
            <div class="account-foot">
                <span class="badge">${escapeHtml(account.currency)}</span>
            </div>
        </article>`;
}

function renderAccounts() {
    const grid = $("accountsGrid");

    if (state.accountsError) {
        grid.innerHTML = emptyState({
            icon: "circle-alert",
            title: t("accountsLoadError"),
            action: "retry-data",
            actionLabel: t("retry"),
            error: true,
        });
        return;
    }

    const addTile = `
        <button type="button" class="add-tile" data-action="add-account">
            ${icon("plus")}<span>${escapeHtml(t("addAccount"))}</span>
        </button>`;

    if (!state.accounts.length) {
        grid.innerHTML = emptyState({
            icon: "landmark",
            title: t("noAccounts"),
            text: t("noAccountsHint"),
            action: "add-account",
            actionLabel: t("addFirstAccount"),
        });
        return;
    }

    grid.innerHTML = state.accounts.map(accountCard).join("") + addTile;
}

function renderChartsSection() {
    const { keys, thisKey, series, categoryTotals } = summarize();

    const categories = [...categoryTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, value]) => ({ name, value, color: colorFor(name) }));

    renderCharts({
        categories,
        labels: keys.map(monthLabel),
        income: keys.map(k => series[k].income),
        expenses: keys.map(k => series[k].expense),
    });
}

// ---------- Filters ----------

export function clearFilters() {
    state.filters = { type: "ALL", accountId: "ALL", from: "", to: "", search: "" };
    $("globalSearch").value = "";
    renderFilterBars();
    renderLists();
}

function filterBarHtml() {
    const f = state.filters;
    const typeButton = (value, label) => `
        <button type="button" class="seg-btn" aria-pressed="${f.type === value}"
                data-filter-type="${value}">${escapeHtml(label)}</button>`;

    const accountOptions = state.accounts.map(a => `
        <option value="${a.id}" ${String(a.id) === f.accountId ? "selected" : ""}>
            ${escapeHtml(a.name)} (${escapeHtml(a.currency)})
        </option>`).join("");

    return `
        <div class="filter-bar">
            <div class="seg-group" role="group" aria-label="${escapeHtml(t("type"))}">
                ${typeButton("ALL", t("filterAll"))}
                ${typeButton("INCOME", t("filterIncome"))}
                ${typeButton("EXPENSE", t("filterExpense"))}
            </div>
            <label>
                <span class="sr-only">${escapeHtml(t("account"))}</span>
                <select data-filter="accountId" aria-label="${escapeHtml(t("account"))}">
                    <option value="ALL">${escapeHtml(t("filterAccountAll"))}</option>
                    ${accountOptions}
                </select>
            </label>
            <label>
                <span>${escapeHtml(t("from"))}</span>
                <input type="date" data-filter="from" value="${escapeHtml(f.from)}">
            </label>
            <label>
                <span>${escapeHtml(t("to"))}</span>
                <input type="date" data-filter="to" value="${escapeHtml(f.to)}">
            </label>
            <button type="button" class="btn btn-ghost btn-sm" data-action="clear-filters">${escapeHtml(t("clearFilters"))}</button>
        </div>`;
}

function renderFilterBars() {
    const html = filterBarHtml();
    $("dashFilters").innerHTML = html;
    $("txFilters").innerHTML = html;
}

function filteredTransactions() {
    const f = state.filters;
    const search = f.search.trim().toLowerCase();

    return state.transactions
        .filter(tx => f.type === "ALL" || tx.type === f.type)
        .filter(tx => f.accountId === "ALL" || String(tx.account?.id) === f.accountId)
        .filter(tx => !f.from || tx.date >= f.from)
        .filter(tx => !f.to || tx.date <= f.to)
        .filter(tx => !search || `${tx.title} ${tx.category ?? ""} ${tx.account?.name ?? ""}`
            .toLowerCase().includes(search))
        .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")) || Number(b.id) - Number(a.id));
}

// ---------- Transaction lists ----------

function txRow(tx) {
    const isIncome = tx.type === "INCOME";
    const cls = isIncome ? "income" : "expense";
    const category = tx.category?.trim() || t("uncategorized");
    const accountName = tx.account?.name || "—";
    const color = colorFor(category);

    return `
        <li class="tx-row tx-grid">
            <div class="tx-main">
                <span class="tx-icon" style="--c:${color}">${icon(categoryIcon(tx.category, tx.type))}</span>
                <div>
                    <strong>${escapeHtml(tx.title)}</strong>
                    <span>${escapeHtml(category)}</span>
                </div>
            </div>
            <span class="tx-cell tx-cat">${escapeHtml(category)}</span>
            <span class="tx-cell tx-date">${escapeHtml(formatDate(tx.date))}</span>
            <span class="tx-cell tx-type"><span class="pill pill-${cls}">${escapeHtml(isIncome ? t("filterIncome") : t("filterExpense"))}</span></span>
            <span class="tx-cell tx-acc">${escapeHtml(accountName)}</span>
            <span class="tx-amount ${cls}">${isIncome ? "+" : "−"}${escapeHtml(formatMoney(Math.abs(tx.amount), tx.account?.currency))}</span>
            <span class="tx-meta">${escapeHtml(category)} · ${escapeHtml(accountName)} · ${escapeHtml(formatDate(tx.date))}</span>
        </li>`;
}

function listHeader() {
    return `
        <li class="tx-head tx-grid" aria-hidden="true">
            <span>${escapeHtml(t("colTransaction"))}</span>
            <span>${escapeHtml(t("colCategory"))}</span>
            <span>${escapeHtml(t("colDate"))}</span>
            <span>${escapeHtml(t("colType"))}</span>
            <span>${escapeHtml(t("colAccount"))}</span>
            <span class="tx-amount">${escapeHtml(t("colAmount"))}</span>
        </li>`;
}

function renderTxList(container, limit, scroll) {
    if (state.transactionsError) {
        container.innerHTML = emptyState({
            icon: "circle-alert",
            title: t("txLoadError"),
            action: "retry-data",
            actionLabel: t("retry"),
            error: true,
        });
        return;
    }

    if (!state.transactions.length) {
        container.innerHTML = emptyState({
            icon: "receipt",
            title: t("noTransactions"),
            text: t("noTransactionsHint"),
            action: "add-transaction",
            actionLabel: t("addTransaction"),
        });
        return;
    }

    const items = filteredTransactions();
    if (!items.length) {
        container.innerHTML = emptyState({
            icon: "search-x",
            title: t("noMatches"),
            action: "clear-filters",
            actionLabel: t("clearFilters"),
        });
        return;
    }

    const visible = limit ? items.slice(0, limit) : items;
    const list = `<ul class="tx-list" role="list">${listHeader()}${visible.map(txRow).join("")}</ul>`;
    container.innerHTML = scroll ? `<div class="tx-scroll">${list}</div>` : list;
}

export function renderLists() {
    renderTxList($("recentList"), 6, false);
    renderTxList($("allTxList"), 0, true);
    refreshIcons();
}

function showSkeletons() {
    $("heroBalance").innerHTML = `<span class="skeleton skel-big" aria-hidden="true"></span>`;
    $("heroChange").innerHTML = `<span class="skeleton skel-line" aria-hidden="true"></span>`;
    for (const name of ["income", "expenses", "savings"]) {
        $(`stat-${name}`).innerHTML = `<span class="skeleton skel-line" aria-hidden="true"></span>`;
    }
    $("accountsGrid").innerHTML = [1, 2, 3].map(() => `<div class="skeleton skel-card" aria-hidden="true"></div>`).join("");
    const rows = `<div class="skeleton skel-row" aria-hidden="true"></div>`.repeat(4);
    $("recentList").innerHTML = `<div class="tx-scroll" aria-hidden="true">${rows}</div>`;
    $("allTxList").innerHTML = `<div class="tx-scroll" aria-hidden="true">${rows}</div>`;
}

// ---------- Events ----------

function closeMenus(except = null) {
    document.querySelectorAll("[data-menu]").forEach(menu => {
        if (menu === except) return;
        menu.hidden = true;
        menu.previousElementSibling?.setAttribute("aria-expanded", "false");
    });
}

export function initDashboard() {
    $("accountsGrid").addEventListener("click", event => {
        const toggle = event.target.closest("[data-menu-toggle]");
        if (toggle) {
            const menu = document.querySelector(`[data-menu="${toggle.dataset.menuToggle}"]`);
            const willOpen = menu.hidden;
            closeMenus();
            menu.hidden = !willOpen;
            toggle.setAttribute("aria-expanded", String(willOpen));
            return;
        }

        const remove = event.target.closest("[data-delete-account]");
        if (remove) {
            closeMenus();
            const account = state.accounts.find(a => String(a.id) === remove.dataset.deleteAccount);
            if (account) deleteAccount(account);
        }
    });

    // Close the action menu on outside click or Escape
    document.addEventListener("click", event => {
        if (!event.target.closest(".menu-wrap")) closeMenus();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeMenus();
    });

    // Filter bars (both views share the same state)
    const onFilterChange = event => {
        const control = event.target.closest("[data-filter]");
        if (!control) return;
        state.filters[control.dataset.filter] = control.value;
        renderLists();
    };
    document.addEventListener("change", onFilterChange);
    document.addEventListener("input", event => {
        if (event.target.matches("input[type='date'][data-filter]")) onFilterChange(event);
    });

    document.addEventListener("click", event => {
        const typeButton = event.target.closest("[data-filter-type]");
        if (!typeButton) return;
        state.filters.type = typeButton.dataset.filterType;
        renderFilterBars();
        renderLists();
    });

    // Used by the "Add account" tile and empty states
    document.addEventListener("click", event => {
        if (event.target.closest("[data-action='add-account']")) openAddAccount();
    });

    // Reload everything after a save or delete
    window.addEventListener("data:changed", () => loadAll());
}
