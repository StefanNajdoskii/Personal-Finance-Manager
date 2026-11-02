// Login, registration, logout and session restore.
// The session lives in an HttpOnly cookie set by the backend; nothing is stored
// in the browser.

import { api } from "./api.js";
import { t } from "./i18n.js";
import { icon, refreshIcons, setFieldError, setMessage } from "./ui.js";

let callbacks = { onLogin: () => {}, onLogout: () => {} };

const USERNAME_PATTERN = /^[A-Za-z0-9_.-]{3,50}$/;

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

function switchTab(tab) {
    const isLogin = tab === "login";
    document.getElementById("loginForm").hidden = !isLogin;
    document.getElementById("registerForm").hidden = isLogin;
    document.getElementById("showLoginBtn").setAttribute("aria-selected", String(isLogin));
    document.getElementById("showRegisterBtn").setAttribute("aria-selected", String(!isLogin));
    setMessage(document.getElementById("loginMessage"), "");
    setMessage(document.getElementById("registerMessage"), "");
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
            document.getElementById("loginPassword").value
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

    try {
        await api.register(username, password);
    } catch (error) {
        setMessage(message, registerErrorMessage(error));
        button.disabled = false;
        return;
    }

    // Log straight in with the new account
    try {
        const user = await api.login(username, password);
        form.reset();
        callbacks.onLogin(user);
    } catch {
        // Account exists but auto-login failed: send the user to the login tab
        form.reset();
        document.getElementById("loginUsername").value = username;
        switchTab("login");
        setMessage(document.getElementById("loginMessage"), t("accountCreated"), "success");
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

export function initAuth(handlers) {
    callbacks = handlers;

    document.getElementById("showLoginBtn").addEventListener("click", () => switchTab("login"));
    document.getElementById("showRegisterBtn").addEventListener("click", () => switchTab("register"));
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
    document.getElementById("registerForm").addEventListener("submit", handleRegister);

    ["loginForm", "registerForm"].forEach(id => {
        document.getElementById(id).addEventListener("input", event => {
            setFieldError(event.target, "");
        });
    });

    wirePasswordToggles();
}
