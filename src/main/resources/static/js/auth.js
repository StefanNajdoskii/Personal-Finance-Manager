// Login, registration, password reset, logout and session restore.
// The session lives in an HttpOnly cookie set by the backend; nothing is stored
// in the browser. "Remember me" is a second HttpOnly cookie, also set by the backend.

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon, refreshIcons, setFieldError, setMessage } from "./ui.js";

let callbacks = { onLogin: () => {}, onLogout: () => {} };

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;
const STRENGTH_LABELS = ["", "pwWeak", "pwFair", "pwGood", "pwStrong"];

function clearErrors(form) {
    form.querySelectorAll("input").forEach(input => setFieldError(input, ""));
}

function validateRequired(form) {
    let valid = true;
    form.querySelectorAll("input[required]").forEach(input => {
        if (!input.value.trim()) {
            setFieldError(input, t("required"));
            valid = false;
        }
    });
    return valid;
}

/**
 * Scores a password from 0 (empty) to 4 (strong). Length, mixed case,
 * and a mix of digits and symbols each add a point.
 */
export function passwordStrength(password) {
    if (!password) return 0;
    if (password.length < 8) return 1;
    let score = 1;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
}

function updatePasswordMeter() {
    const score = passwordStrength(document.getElementById("registerPassword").value);
    document.getElementById("pwMeter").dataset.level = String(score);
    document.getElementById("pwMeterLabel").textContent = score ? t(STRENGTH_LABELS[score]) : "";
}

/**
 * Shows one view of the auth card: "login", "register", "reset" or "recovery".
 * The title keeps its data-i18n key so a language switch still translates it.
 */
function showView(view) {
    const card = document.querySelector("#authScreen > .auth-card");
    const tabsView = view === "login" || view === "register";

    document.getElementById("loginForm").hidden = view !== "login";
    document.getElementById("registerForm").hidden = view !== "register";
    document.getElementById("resetForm").hidden = view !== "reset";
    document.getElementById("recoveryPanel").hidden = view !== "recovery";

    card.querySelector(".segmented").hidden = !tabsView;
    card.querySelector(":scope > .auth-subtitle").hidden = !tabsView;

    const title = document.getElementById("authTitle");
    title.hidden = view === "recovery";
    const titleKey = { login: "welcomeBack", register: "createAccountTitle", reset: "resetTitle" }[view];
    if (titleKey) {
        title.dataset.i18n = titleKey;
        title.textContent = t(titleKey);
    }

    document.getElementById("showLoginBtn").setAttribute("aria-selected", String(view === "login"));
    document.getElementById("showRegisterBtn").setAttribute("aria-selected", String(view === "register"));

    ["loginMessage", "registerMessage", "resetMessage"].forEach(id => setMessage(document.getElementById(id), ""));
}

function switchTab(tab) {
    showView(tab);
}

function wirePasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.togglePassword);
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            button.setAttribute("aria-label", t(showing ? "showPassword" : "hidePassword"));
            button.setAttribute("aria-pressed", String(!showing));
            button.innerHTML = icon(showing ? "eye" : "eye-off");
            refreshIcons();
        });
    });
}

// ---------- Recovery code ----------

/** Copies a code to the clipboard and reports the result in the given message element. */
async function copyCode(code, messageEl) {
    try {
        await navigator.clipboard.writeText(code);
        setMessage(messageEl, t("copied"), "success");
    } catch {
        setMessage(messageEl, t("copyFailed"));
    }
}

/**
 * Shows the recovery code once. Resolves when the user confirms they saved it.
 * The caller then calls showView() to return to a normal view.
 */
function showRecoveryPanel(code) {
    document.getElementById("recoveryCodeText").textContent = code;
    setMessage(document.getElementById("copyMessage"), "");
    showView("recovery");

    return new Promise(resolve => {
        const button = document.getElementById("recoveryContinueBtn");
        button.addEventListener("click", () => resolve(), { once: true });
    });
}

// ---------- Errors ----------

function loginErrorMessage(error) {
    if (error.status === 401) return t("wrongCredentials");
    if (error.status === 0) return t("serverUnreachable");
    return t("loginFailed");
}

function registerErrorMessage(error) {
    if (error.status === 409) return t("usernameTaken");
    if (error.status === 400) return t("registerInvalid");
    if (error.status === 0) return t("serverUnreachable");
    return t("saveFailed");
}

function resetErrorMessage(error) {
    if (error.status === 401) return t("resetFailed");
    if (error.status === 0) return t("serverUnreachable");
    return t("saveFailed");
}

// ---------- Handlers ----------

async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("loginMessage");
    clearErrors(form);
    setMessage(message, "");

    if (!validateRequired(form)) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        const user = await api.login(
            document.getElementById("loginUsername").value.trim(),
            document.getElementById("loginPassword").value,
            document.getElementById("rememberMe").checked
        );
        form.reset();
        callbacks.onLogin(user);
    } catch (error) {
        setMessage(message, loginErrorMessage(error));
    } finally {
        button.disabled = false;
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("registerMessage");
    clearErrors(form);
    setMessage(message, "");

    if (!validateRequired(form)) return;

    const usernameInput = document.getElementById("registerUsername");
    const passwordInput = document.getElementById("registerPassword");
    const confirmInput = document.getElementById("registerConfirmPassword");
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!USERNAME_PATTERN.test(username)) {
        setFieldError(usernameInput, t("usernameFormat"));
        valid = false;
    }
    if (password.length < 8) {
        setFieldError(passwordInput, t("minPassword"));
        valid = false;
    }
    if (confirmInput.value !== password) {
        setFieldError(confirmInput, t("passwordsMismatch"));
        valid = false;
    }
    if (!valid) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    let recoveryCode;
    try {
        ({ recoveryCode } = await api.register(username, password));
    } catch (error) {
        setMessage(message, registerErrorMessage(error));
        button.disabled = false;
        return;
    }

    // Log straight in with the new account
    let user = null;
    try {
        user = await api.login(username, password);
    } catch {
        // Login failed: the user can log in on the login tab
    }

    form.reset();
    updatePasswordMeter();

    // Show the recovery code before entering the app. It is never shown again.
    if (recoveryCode) {
        await showRecoveryPanel(recoveryCode);
    }

    if (user) {
        callbacks.onLogin(user);
    } else {
        document.getElementById("loginUsername").value = username;
        switchTab("login");
        setMessage(document.getElementById("loginMessage"), t("accountCreated"), "success");
    }
    button.disabled = false;
}

async function handleReset(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("resetMessage");
    clearErrors(form);
    setMessage(message, "");

    if (!validateRequired(form)) return;

    const usernameInput = document.getElementById("resetUsername");
    const passwordInput = document.getElementById("resetPassword");
    const username = usernameInput.value.trim();

    let valid = true;
    if (!USERNAME_PATTERN.test(username)) {
        setFieldError(usernameInput, t("usernameFormat"));
        valid = false;
    }
    if (passwordInput.value.length < 8) {
        setFieldError(passwordInput, t("minPassword"));
        valid = false;
    }
    if (!valid) return;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;

    try {
        const { recoveryCode } = await api.resetPassword(
            username,
            document.getElementById("resetCode").value,
            passwordInput.value
        );
        form.reset();
        await showRecoveryPanel(recoveryCode);
        // The reset does not log in; send the user to the login tab
        document.getElementById("loginUsername").value = username;
        switchTab("login");
        setMessage(document.getElementById("loginMessage"), t("passwordReset"), "success");
    } catch (error) {
        setMessage(message, resetErrorMessage(error));
    } finally {
        button.disabled = false;
    }
}

/** Returns the signed-in user, or null if there is no valid session. */
export async function checkSession() {
    try {
        return await api.me();
    } catch {
        return null;
    }
}

export async function logout() {
    try {
        await api.logout();
    } catch {
        // Even if the request fails, clear the UI so the user is not stuck
    }
    callbacks.onLogout();
}

/** Settings page: creates a new recovery code for the logged-in user. */
export function initSettingsRecovery() {
    const message = document.getElementById("settingsRecoveryMessage");
    const box = document.getElementById("settingsRecoveryBox");
    const codeEl = document.getElementById("settingsRecoveryCode");

    document.getElementById("regenerateRecoveryBtn").addEventListener("click", async () => {
        setMessage(message, "");
        try {
            const { recoveryCode } = await api.regenerateRecoveryCode();
            codeEl.textContent = recoveryCode;
            box.hidden = false;
            setMessage(message, t("recoveryNew"), "success");
        } catch {
            setMessage(message, t("saveFailed"));
        }
    });

    document.getElementById("copySettingsRecoveryBtn").addEventListener("click", () =>
        copyCode(codeEl.textContent, message));
}

export function initAuth(handlers) {
    callbacks = handlers;

    document.getElementById("showLoginBtn").addEventListener("click", () => switchTab("login"));
    document.getElementById("showRegisterBtn").addEventListener("click", () => switchTab("register"));
    document.getElementById("showForgotBtn").addEventListener("click", () => switchTab("reset"));
    document.getElementById("backToLoginBtn").addEventListener("click", () => switchTab("login"));
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("registerForm").addEventListener("submit", handleRegister);
    document.getElementById("resetForm").addEventListener("submit", handleReset);
    document.getElementById("registerPassword").addEventListener("input", updatePasswordMeter);
    document.getElementById("copyRecoveryBtn").addEventListener("click", () =>
        copyCode(document.getElementById("recoveryCodeText").textContent,
            document.getElementById("copyMessage")));

    ["loginForm", "registerForm", "resetForm"].forEach(id => {
        document.getElementById(id).addEventListener("input", event => {
            setFieldError(event.target, "");
        });
    });

    wirePasswordToggles();
}
