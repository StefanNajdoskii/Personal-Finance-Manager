// Add-account and add-transaction dialogs, and account deletion.

import { api, ApiError } from "./api.js";
import { state } from "./state.js";
import { todayIso } from "./format.js";
import { t } from "./i18n.js";
import { confirmAction, escapeHtml, setFieldError, setMessage, toast } from "./ui.js";

const accountDialog = () => document.getElementById("accountDialog");
const transactionDialog = () => document.getElementById("transactionDialog");

function clearErrors(form) {
    form.querySelectorAll("input, select").forEach(input => setFieldError(input, ""));
}

function requireFilled(form) {
    let valid = true;
    form.querySelectorAll("[required]").forEach(input => {
        if (!String(input.value).trim()) {
            setFieldError(input, t("required"));
            valid = false;
        }
    });
    return valid;
}

function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    if (busy) {
        button.dataset.label = button.textContent;
        button.textContent = t("saving");
    } else if (button.dataset.label) {
        button.textContent = button.dataset.label;
    }
}

function transactionErrorMessage(error) {
    if (error instanceof ApiError && error.status === 400) return t("saveRejected");
    if (error instanceof ApiError && error.status === 404) return t("accountMissing");
    return t("saveFailed");
}

// ---------- Account dialog ----------

export function openAddAccount() {
    const dialog = accountDialog();
    dialog.querySelector("form").reset();
    clearErrors(dialog.querySelector("form"));
    setMessage(document.getElementById("accountFormMessage"), "");
    dialog.showModal();
    dialog.querySelector("input")?.focus();
}

async function submitAccount(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("accountFormMessage");
    clearErrors(form);
    setMessage(message, "");

    if (!requireFilled(form)) return;

    const balanceInput = document.getElementById("accountBalance");
    const balance = Number(balanceInput.value);
    if (!Number.isFinite(balance) || balance < 0) {
        setFieldError(balanceInput, balance < 0 ? t("negativeBalance") : t("invalidAmount"));
        return;
    }

    const account = {
        name: document.getElementById("accountName").value.trim(),
        type: document.getElementById("accountType").value,
        currency: document.getElementById("accountCurrency").value,
        balance,
        institution: document.getElementById("accountInstitution").value.trim(),
    };

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);

    try {
        await api.createAccount(account);
        accountDialog().close();
        toast(t("accountSaved"));
        window.dispatchEvent(new CustomEvent("data:changed"));
    } catch {
        setMessage(message, t("saveFailed"));
    } finally {
        setBusy(button, false);
    }
}

// ---------- Transaction dialog ----------

export function openAddTransaction() {
    const dialog = transactionDialog();
    const form = dialog.querySelector("form");
    form.reset();
    clearErrors(form);
    setMessage(document.getElementById("formMessage"), "");

    const select = document.getElementById("txAccount");
    const notice = document.getElementById("txNoAccounts");
    const submit = form.querySelector('button[type="submit"]');

    select.innerHTML = `<option value="">${escapeHtml(t("chooseAccount"))}</option>`
        + state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.currency)})</option>`).join("");

    const hasAccounts = state.accounts.length > 0;
    notice.hidden = hasAccounts;
    submit.disabled = !hasAccounts;

    // Suggest categories already used
    const categories = [...new Set(state.transactions.map(tx => tx.category).filter(Boolean))];
    document.getElementById("categoryOptions").innerHTML =
        categories.map(c => `<option value="${escapeHtml(c)}"></option>`).join("");

    document.getElementById("txDate").value = todayIso();
    dialog.showModal();
    document.getElementById("txTitle").focus();
}

async function submitTransaction(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("formMessage");
    clearErrors(form);
    setMessage(message, "");

    if (!requireFilled(form)) return;

    const amountInput = document.getElementById("txAmount");
    const amount = Number(amountInput.value);
    if (!Number.isFinite(amount) || amount <= 0) {
        setFieldError(amountInput, t("invalidAmount"));
        return;
    }

    const transaction = {
        title: document.getElementById("txTitle").value.trim(),
        amount,
        type: form.elements.type.value,
        category: document.getElementById("txCategory").value.trim(),
        date: document.getElementById("txDate").value,
        account: { id: Number(document.getElementById("txAccount").value) },
    };

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true);

    try {
        await api.createTransaction(transaction);
        transactionDialog().close();
        toast(t("transactionSaved"));
        window.dispatchEvent(new CustomEvent("data:changed"));
    } catch (error) {
        setMessage(message, transactionErrorMessage(error));
    } finally {
        setBusy(button, false);
    }
}

// ---------- Delete account ----------

export async function deleteAccount(account) {
    const confirmed = await confirmAction(t("confirmDeleteAccount", { name: account.name }));
    if (!confirmed) return;

    try {
        await api.deleteAccount(account.id);
        toast(t("accountDeleted"));
        window.dispatchEvent(new CustomEvent("data:changed"));
    } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
            toast(t("accountHasTransactions"), "error");
        } else {
            toast(t("deleteFailed"), "error");
        }
    }
}

// ---------- Wiring ----------

export function initForms() {
    document.getElementById("accountForm").addEventListener("submit", submitAccount);
    document.getElementById("transactionForm").addEventListener("submit", submitTransaction);

    // Close buttons inside dialogs
    document.querySelectorAll("dialog [data-close-dialog]").forEach(button => {
        button.addEventListener("click", () => button.closest("dialog").close());
    });

    // Clear validation state when the dialog closes
    [accountDialog(), transactionDialog()].forEach(dialog => {
        dialog.addEventListener("close", () => clearErrors(dialog.querySelector("form")));
    });
}
