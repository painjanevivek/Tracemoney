"use client";

import Plot from "react-plotly.js";

export default function SankeyDiagram({ financials }: any) {
  if (!financials) return null;

  const {
    revenue,
    net_income,
    operating_cash_flow,
    investing_cash_flow,
    financing_cash_flow,
  } = financials;

  // ---- Derive Additional Breakdown ----
  // At this level we simulate deeper finance branching

  const gross_profit = revenue * 0.25; // placeholder, can be replaced with real SEC tag
  const cogs = revenue - gross_profit;

  const operating_income = net_income * 1.25; // placeholder relationship
  const operating_expenses = gross_profit - operating_income;

  const taxes = operating_income - net_income;

  const capex = Math.abs(investing_cash_flow); // CapEx is negative in CF statement
  const free_cash_flow = operating_cash_flow - capex;

  // ---- Node Labels ----
  const labels = [
    "Revenue",
    "COGS",
    "Gross Profit",
    "Operating Expenses",
    "Operating Income",
    "Taxes",
    "Net Income",
    "Operating Cash Flow",
    "CapEx",
    "Free Cash Flow",
    "Financing Cash Flow",
    "Net Cash Flow"
  ];

  // ---- Node Colors ----
  const colors = [
    "#4ade80", "#22c55e", "#16a34a", "#15803d", "#0f766e", 
    "#e11d48", "#2563eb", "#06b6d4", "#dc2626", 
    "#9333ea", "#3b82f6", "#c084fc"
  ];

  // ---- Links (multiple branches) ----
  const sources = [
    0, // Revenue → COGS
    0, // Revenue → Gross Profit
    2, // Gross Profit → Operating Expenses
    2, // Gross Profit → Operating Income
    4, // Operating Income → Taxes
    4, // Operating Income → Net Income
    6, // Net Income → Operating Cash Flow
    7, // Operating CF → CapEx
    7, // Operating CF → Free Cash Flow
    10, // Financing CF → Net Cash Flow
    9  // Free Cash Flow → Net Cash Flow
  ];

  const targets = [
    1, // COGS
    2, // Gross Profit
    3, // Operating Expenses
    4, // Operating Income
    5, // Taxes
    6, // Net Income
    7, // Operating Cash Flow
    8, // CapEx
    9, // Free Cash Flow
    11, // Net Cash Flow
    11  // Net Cash Flow
  ];

  const values = [
    cogs,
    gross_profit,
    operating_expenses,
    operating_income,
    taxes,
    net_income,
    operating_cash_flow,
    capex,
    free_cash_flow,
    Math.abs(financing_cash_flow),
    Math.abs(free_cash_flow)
  ];

  return (
    <Plot
      data={[
        {
          type: "sankey",
          node: {
            pad: 25,
            thickness: 25,
            label: labels,
            color: colors,
            line: { color: "black", width: 1 }
          },
          link: {
            source: sources,
            target: targets,
            value: values,
            color: values.map(v =>
              v < 0 ? "rgba(255,0,0,0.4)" : "rgba(0,255,135,0.4)"
            ),
            hovertemplate:
              "<b>%{source.label} → %{target.label}</b><br>" +
              "Amount: %{value:$,.0f}<extra></extra>"
          }
        }
      ]}
      layout={{
        title: {
          text: "Multi-Branch Advanced Money Flow (TraceMoney)",
          font: { size: 24, color: "white" }
        },
        paper_bgcolor: "black",
        plot_bgcolor: "black",
        font: { color: "white" },

        // ⭐ FIX 4 — ADD BREATHING ROOM
        margin: {
          l: 100,   // more space on left
          r: 100,   // more space on right
          t: 100,   // more space on top
          b: 60     // more space at bottom
        },

        height: 650
      }}
      config={{ responsive: true }}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
