// Money, date, currency conversion and category/account icon helpers.

import { getLang } from "./i18n.js";

const LOCALES = { en: "en-US", mk: "mk-MK" };
const CRYPTO = new Set(["BTC", "ETH", "USDT", "USDC"]);

function locale() {
    return LOCALES[getLang()] || "en-US";
}

/** Formats an amount in its currency, e.g. "MKD 1,234.00" or "0.00012 BTC". */
export function formatMoney(amount, currency) {
    const value = Number(amount) || 0;
    const code = (currency || "").toUpperCase();
    const isCrypto = CRYPTO.has(code);
    const sign = value < 0 ? "−" : "";
    const abs = Math.abs(value);

    if (!code) {
        return sign + abs.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    if (/^[A-Z]{3}$/.test(code) && !isCrypto) {
        try {
            return sign + new Intl.NumberFormat(locale(), {
                style: "currency",
                currency: code,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(abs);
        } catch {
            // Fall through to the plain format below
        }
    }

    const digits = isCrypto ? 8 : 2;
    const number = abs.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: digits });
    return `${sign}${number} ${code}`;
}

export function formatDate(iso) {
    if (!iso) return "—";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale(), {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export function formatPercent(value) {
    const sign = value > 0 ? "+" : value < 0 ? "−" : "";
    return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/** Today as YYYY-MM-DD in the user's local time zone. */
export function todayIso() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function monthKey(iso) {
    return iso ? iso.slice(0, 7) : "";
}

/** Returns the last `count` month keys (YYYY-MM), oldest first, ending with this month. */
export function lastMonths(count) {
    const keys = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
}

export function monthLabel(key) {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(locale(), { month: "short" });
}

// ---------- Currency conversion ----------

const FALLBACK_RATES = { EUR: 61.5, USD: 56.5, approximate: true };

/**
 * Exchange rates to MKD. EUR uses a fixed rate (the ECB feed used by the API
 * does not carry MKD); USD is derived from the EUR/USD rate.
 */
export async function loadRates() {
    try {
        const response = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD");
        if (!response.ok) throw new Error("rates unavailable");
        const data = await response.json();
        const eur = 61.5;
        return { EUR: eur, USD: eur / data.rates.USD, approximate: false };
    } catch {
        return { ...FALLBACK_RATES };
    }
}

/** Converts to MKD, or returns null if the currency is not supported. */
export function toMkd(amount, currency, rates) {
    const code = (currency || "").toUpperCase();
    const value = Number(amount) || 0;
    if (code === "MKD") return value;
    if (code === "EUR") return value * rates.EUR;
    if (code === "USD" || code === "USDT") return value * rates.USD;
    return null;
}

// ---------- Icons and colours ----------

const CATEGORY_ICONS = [
    [/food|grocer|restaurant|lunch|dinner|coffee|cafe|eat|храна|ресторан/i, "utensils"],
    [/transport|car|fuel|gas|taxi|bus|train|uber|превоз|гориво/i, "car"],
    [/rent|home|house|utilit|electric|water|internet|стан|комунал/i, "house"],
    [/salary|work|job|income|freelance|bonus|плата|работа/i, "briefcase"],
    [/health|pharm|doctor|medic|gym|здравје|аптека/i, "heart-pulse"],
    [/shop|cloth|store|amazon|купување|облека/i, "shopping-bag"],
    [/fun|movie|game|entertain|music|stream|забава/i, "gamepad-2"],
    [/travel|flight|hotel|trip|патување/i, "plane"],
    [/gift|подарок/i, "gift"],
];

export function categoryIcon(category, type) {
    const text = category || "";
    for (const [pattern, icon] of CATEGORY_ICONS) {
        if (pattern.test(text)) return icon;
    }
    return type === "INCOME" ? "arrow-down-left" : "receipt";
}

const PALETTE = ["#7c5cff", "#3b82f6", "#22c55e", "#f59e0b", "#f43f5e", "#06b6d4", "#ec4899", "#84cc16"];

/** Stable colour for a key (category name), so the same category always looks the same. */
export function colorFor(key) {
    let hash = 0;
    for (const ch of String(key)) {
        hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return PALETTE[hash % PALETTE.length];
}

export function accountIcon(type) {
    const value = (type || "").toUpperCase();
    if (value.includes("BANK")) return "landmark";
    if (value.includes("CASH")) return "banknote";
    if (value.includes("CRYPTO")) return "bitcoin";
    if (value.includes("INVEST")) return "trending-up";
    return "wallet";
}
