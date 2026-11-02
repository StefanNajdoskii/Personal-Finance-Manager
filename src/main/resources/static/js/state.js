// Shared application state. Modules read and update this object; the
// dashboard re-renders from it.

export const state = {
    user: null,
    accounts: [],
    transactions: [],
    rates: null,
    accountsError: false,
    transactionsError: false,
    filters: {
        type: "ALL",
        accountId: "ALL",
        from: "",
        to: "",
        search: "",
    },
};

export function resetState() {
    state.user = null;
    state.accounts = [];
    state.transactions = [];
    state.rates = null;
    state.accountsError = false;
    state.transactionsError = false;
    state.filters = { type: "ALL", accountId: "ALL", from: "", to: "", search: "" };
}
