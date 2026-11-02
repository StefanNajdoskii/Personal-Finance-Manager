// Chart.js charts (loaded from a CDN). Colours come from the theme tokens,
// so charts restyle when the theme changes.

import { getLang, t } from "./i18n.js";
import { formatMoney } from "./format.js";
import { prefersReducedMotion } from "./ui.js";

let donut = null;
let bar = null;

function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setPanel(canvas, emptyEl, showChart, message) {
    canvas.hidden = !showChart;
    emptyEl.hidden = showChart;
    emptyEl.textContent = message;
}

function compact(value) {
    return new Intl.NumberFormat(getLang() === "mk" ? "mk-MK" : "en-US", { notation: "compact" }).format(value);
}

/**
 * @param {{ categories: {name: string, value: number, color: string}[],
 *           labels: string[], income: number[], expenses: number[] }} data
 *        Values are already converted to MKD.
 */
export function renderCharts({ categories, labels, income, expenses }) {
    const donutCanvas = document.getElementById("donutChart");
    const barCanvas = document.getElementById("barChart");
    const donutEmpty = document.getElementById("donutEmpty");
    const barEmpty = document.getElementById("barEmpty");

    donut?.destroy();
    bar?.destroy();
    donut = null;
    bar = null;

    if (!window.Chart) {
        setPanel(donutCanvas, donutEmpty, false, t("chartsOffline"));
        setPanel(barCanvas, barEmpty, false, t("chartsOffline"));
        return;
    }

    const text = token("--text-muted");
    const grid = token("--chart-grid");
    const surface = token("--surface-solid");
    const animation = prefersReducedMotion() ? false : { duration: 600 };

    Chart.defaults.font.family = token("--font-sans");
    Chart.defaults.color = text;

    // Spending by category (donut)
    if (categories.length) {
        setPanel(donutCanvas, donutEmpty, true, "");
        donut = new Chart(donutCanvas, {
            type: "doughnut",
            data: {
                labels: categories.map(c => c.name),
                datasets: [{
                    data: categories.map(c => c.value),
                    backgroundColor: categories.map(c => c.color),
                    borderColor: surface,
                    borderWidth: 3,
                    hoverOffset: 6,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "68%",
                animation,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.label}: ${formatMoney(ctx.parsed, "MKD")}`,
                        },
                    },
                },
            },
        });
    } else {
        setPanel(donutCanvas, donutEmpty, false, t("noChartData"));
    }

    // Income vs expenses over time (bars)
    const hasData = income.some(v => v > 0) || expenses.some(v => v > 0);
    if (hasData) {
        setPanel(barCanvas, barEmpty, true, "");
        bar = new Chart(barCanvas, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: t("income"),
                        data: income,
                        backgroundColor: token("--success"),
                        borderRadius: 8,
                        maxBarThickness: 24,
                    },
                    {
                        label: t("expenses"),
                        data: expenses,
                        backgroundColor: token("--danger"),
                        borderRadius: 8,
                        maxBarThickness: 24,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation,
                interaction: { mode: "index", intersect: false },
                scales: {
                    x: { grid: { display: false }, ticks: { color: text } },
                    y: {
                        grid: { color: grid },
                        ticks: { color: text, callback: v => compact(v) },
                        border: { display: false },
                    },
                },
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, padding: 14 },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y, "MKD")}`,
                        },
                    },
                },
            },
        });
    } else {
        setPanel(barCanvas, barEmpty, false, t("noChartData"));
    }
}
