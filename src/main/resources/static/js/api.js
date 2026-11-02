// Thin wrapper around fetch for the existing REST API. URLs and payloads are
// unchanged from the backend contract.

export class ApiError extends Error {
    constructor(status, message = "") {
        super(message || `HTTP ${status}`);
        this.name = "ApiError";
        this.status = status;
    }
}

let onUnauthorized = () => {};

/** Called when a non-auth request comes back 401 (session expired or missing). */
export function setUnauthorizedHandler(handler) {
    onUnauthorized = handler;
}

async function request(url, { method = "GET", body } = {}) {
    const init = { method, credentials: "same-origin" };

    if (body !== undefined) {
        init.headers = { "Content-Type": "application/json" };
        init.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(url, init);
    } catch {
        throw new ApiError(0, "Network error");
    }

    if (response.status === 401 && !url.startsWith("/api/auth/")) {
        onUnauthorized();
    }

    if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new ApiError(response.status, text);
    }

    // Some endpoints (DELETE, logout) return an empty body
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export const api = {
    me: () => request("/api/auth/me"),
    login: (username, password) => request("/api/auth/login", { method: "POST", body: { username, password } }),
    register: (username, password) => request("/api/auth/register", { method: "POST", body: { username, password } }),
    logout: () => request("/api/auth/logout", { method: "POST" }),

    getAccounts: () => request("/api/accounts"),
    createAccount: account => request("/api/accounts", { method: "POST", body: account }),
    deleteAccount: id => request(`/api/accounts/${id}`, { method: "DELETE" }),

    getTransactions: () => request("/api/transactions"),
    createTransaction: transaction => request("/api/transactions", { method: "POST", body: transaction }),
};
