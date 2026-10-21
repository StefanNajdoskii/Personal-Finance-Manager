
const API_URL = "/api/transactions";
const ACCOUNTS_URL = "/api/accounts";
const accountSelect = document.getElementById("accountId");
const accountFormPanel = document.getElementById("accountFormPanel");
const accountForm = document.getElementById("accountForm");
const accountFormMessage = document.getElementById("accountFormMessage");

const balanceElement = document.getElementById("balance");
const incomeElement = document.getElementById("totalIncome");
const expensesElement = document.getElementById("totalExpenses");
const transactionsBody = document.getElementById("transactionsBody");
const statusMessage = document.getElementById("statusMessage");

const formPanel = document.getElementById("transactionFormPanel");
const transactionForm = document.getElementById("transactionForm");
const formMessage = document.getElementById("formMessage");

function formatMoney(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(amount) || 0);
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}


async function loadAccounts() {
    const accountsGrid = document.getElementById("accountsGrid");

    try {
        const response = await fetch(ACCOUNTS_URL);

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        const accounts = await response.json();
console.table(accounts.map(account => ({
    name: account.name,
    balance: account.balance,
    currency: account.currency
})));
console.log("Accounts for Main Account:", accounts);
console.log(
    "Main Account element:",
    document.getElementById("mainAccountBalance")
);
        // Calculate the total balance in MKD
        const mainAccountBalance =
            document.getElementById("mainAccountBalance");

        try {
            const rateResponse = await fetch(
                "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=MKD,USD"
            );

            if (!rateResponse.ok) {
                throw new Error("Could not load exchange rates");
            }

            const rateData = await rateResponse.json();
            console.log("Exchange rates:", rateData);
            const eurToMkd = 61.5;
            const usdToMkd = eurToMkd / rateData.rates.USD;

            const totalInMkd = accounts.reduce((total, account) => {
                const balance = Number(account.balance) || 0;
                const currency = account.currency.toUpperCase();

                if (currency === "MKD") {
                    return total + balance;
                }

                if (currency === "USD" || currency === "USDT") {
                    return total + balance * usdToMkd;
                }

                if (currency === "EUR") {
                    return total + balance * eurToMkd;
                }

                console.warn(
                    `Currency not included in Main Account: ${currency}`
                );

                return total;
            }, 0);

            if (mainAccountBalance) {
                mainAccountBalance.textContent =
                    `${totalInMkd.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })} MKD`;
            }
        } catch (error) {
            console.error("Could not calculate Main Account:", error);

            if (mainAccountBalance) {
                mainAccountBalance.textContent =
                    "Exchange rates unavailable";
            }
        }

        if (accountSelect) {
            accountSelect.innerHTML =
                '<option value="">Select an account</option>';

            accounts.forEach(account => {
                const option = document.createElement("option");
                option.value = account.id;
                option.textContent = `${account.name} (${account.currency})`;
                accountSelect.appendChild(option);
            });
        }

        if (accountsGrid) {
            accountsGrid.innerHTML = "";

            accounts.forEach(account => {
                const card = document.createElement("article");
                card.className = "summary-card account-card";

                const heading = document.createElement("div");
                heading.className = "card-heading";

                const name = document.createElement("span");
                name.textContent = account.name;

                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-account-btn";
                deleteButton.textContent = "−";
                deleteButton.title = "Delete account";
                deleteButton.setAttribute(
                    "aria-label",
                    `Delete ${account.name}`
                );

                deleteButton.addEventListener("click", async (event) => {
                    event.stopPropagation();

                    if (!confirm(
                        `Are you sure you want to delete "${account.name}"?`
                    )) {
                        return;
                    }

                    try {
                        const deleteResponse = await fetch(
                            `${ACCOUNTS_URL}/${account.id}`,
                            { method: "DELETE" }
                        );

                        if (deleteResponse.status === 409) {
                            alert(
                                "This account has transactions and cannot be deleted."
                            );
                            return;
                        }

                        if (!deleteResponse.ok) {
                            throw new Error(
                                `Delete failed: ${deleteResponse.status}`
                            );
                        }

                        await loadAccounts();
                    } catch (error) {
                        console.error("Delete account error:", error);
                        alert("Could not delete the account. Please try again.");
                    }
                });

                heading.append(name, deleteButton);

                const balance = document.createElement("h2");
                balance.textContent =
                    `${Number(account.balance).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })} ${account.currency}`;

                const details = document.createElement("p");
                details.className = "card-note";
                details.textContent =
                    [account.institution, account.type]
                        .filter(Boolean)
                        .join(" · ") || "Account";


                card.append(heading, balance, details);
                accountsGrid.appendChild(card);
            });

            // Add Account card
            const addCard = document.createElement("button");
            addCard.type = "button";
            addCard.className = "summary-card add-account-card";
            addCard.innerHTML = `
                <span class="card-icon">+</span>
                <h3>Add Account</h3>
                <p>Add a bank or wallet</p>
            `;

            addCard.addEventListener("click", () => {
                const accountFormPanel =
                    document.getElementById("accountFormPanel");

                if (accountFormPanel) {
                    accountFormPanel.classList.remove("hidden");
                    accountFormPanel.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            });

            accountsGrid.appendChild(addCard);
        }

        console.log("Accounts loaded:", accounts.length);
    } catch (error) {
        console.error("Could not load accounts:", error);

        if (accountSelect) {
            accountSelect.innerHTML =
                '<option value="">Could not load accounts</option>';
        }

        if (accountsGrid) {
            accountsGrid.innerHTML =
                "<p>Could not load accounts. Please refresh the page.</p>";
        }
    }
}


async function loadSummary() {
    try {
        const response = await fetch(`${API_URL}/summary`);

        if (!response.ok) {
            throw new Error("Could not load financial summary.");
        }

        await response.json();

        console.log("Financial summary loaded.");

    } catch (error) {
        console.error("Summary loading error:", error);
    }
}


async function loadTransactions() {
    transactionsBody.innerHTML = `
        <tr>
            <td colspan="5" class="empty-state">Loading transactions...</td>
        </tr>
    `;

    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not load transactions.");
        }

        const transactions = await response.json();

        if (transactions.length === 0) {
            transactionsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        No transactions yet. Add your first transaction!
                    </td>
                </tr>
            `;
            return;
        }

        transactions.sort((a, b) => {
            const dateComparison = String(b.date ?? "")
                .localeCompare(String(a.date ?? ""));

            return dateComparison || Number(b.id) - Number(a.id);
        });

        transactionsBody.innerHTML = transactions.map(transaction => {
            const isIncome = transaction.type === "INCOME";
            const typeClass = isIncome ? "income" : "expense";
            const sign = isIncome ? "+" : "-";

            return `
                <tr>
                    <td><strong>${escapeHtml(transaction.title)}</strong></td>
                    <td>${escapeHtml(transaction.category || "Uncategorized")}</td>
                    <td>${escapeHtml(transaction.date || "—")}</td>
                    <td>
                        <span class="type-badge ${typeClass}">
                            ${isIncome ? "Income" : "Expense"}
                        </span>
                    </td>
                    <td class="amount-cell ${typeClass}-amount">
                        ${sign}${formatMoney(transaction.amount)}
                    </td>
                </tr>
            `;
        }).join("");
    } catch (error) {
        transactionsBody.innerHTML = `
            <tr>
                <td colspan="5" class="empty-state">
                    Could not load transactions.
                </td>
            </tr>
        `;
        console.error(error);
    }
}


async function refreshDashboard() {
    await Promise.all([
        loadSummary(),
        loadTransactions()
    ]);
}

document.getElementById("refreshBtn").addEventListener("click", refreshDashboard);

document.getElementById("addTransactionBtn").addEventListener("click", () => {
    formPanel.classList.remove("hidden");
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});


document.getElementById("closeAccountFormBtn").addEventListener("click", () => {
    accountFormPanel.classList.add("hidden");
    accountFormMessage.textContent = "";
});

document.getElementById("closeFormBtn").addEventListener("click", () => {
    formPanel.classList.add("hidden");
    formMessage.textContent = "";
});

transactionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(transactionForm);

const transaction = {
    title: formData.get("title").trim(),
    amount: Number(formData.get("amount")),
    type: formData.get("type"),
    category: formData.get("category").trim(),
    date: formData.get("date"),
    account: {
        id: Number(formData.get("accountId"))
    }
};

    if (!transaction.title || !Number.isFinite(transaction.amount)
        || transaction.amount <= 0 || !transaction.date) {
        formMessage.textContent = "Please enter a valid title, amount, and date.";
        return;
    }

    const submitButton = transactionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(transaction)
        });

        if (!response.ok) {
            throw new Error("The transaction could not be saved.");
        }

        formMessage.textContent = "Transaction saved successfully!";
        transactionForm.reset();
        document.getElementById("date").value =
            new Date().toLocaleDateString("en-CA");

        await refreshDashboard();
    } catch (error) {
        formMessage.textContent =
            "Could not save the transaction. Check that the application is running.";
        console.error(error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save transaction";
    }
});

document.getElementById("date").value =
    new Date().toLocaleDateString("en-CA");

refreshDashboard();
loadAccounts();


accountForm.addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData(accountForm);

    const account = {
        name: formData.get("name").trim(),
        type: formData.get("type").trim(),
        currency: formData.get("currency").trim().toUpperCase(),
        balance: Number(formData.get("balance")),
        institution: formData.get("institution").trim()
    };

    if (
        !account.name ||
        !account.type ||
        !account.currency ||
        !Number.isFinite(account.balance) ||
        account.balance < 0
    ) {
        accountFormMessage.textContent = "Please enter valid account details.";
        return;
    }

    const submitButton = accountForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "Saving...";

    try {
        const response = await fetch(ACCOUNTS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(account)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Could not save account.");
        }

        accountFormMessage.textContent = "Account saved successfully!";
        accountForm.reset();
        document.getElementById("accountBalance").value = "0";

        await loadAccounts();

        accountFormPanel.classList.add("hidden");
        accountFormMessage.textContent = "";

    } catch (error) {
        accountFormMessage.textContent = "Could not save account. Please check the application.";
        console.error("Account save error:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Save account";
    }
});
