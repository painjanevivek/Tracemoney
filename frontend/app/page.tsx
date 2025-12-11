"use client";
import { useEffect, useState, useMemo } from "react";
import SankeyDiagram from "./Sankey";

export default function Home() {
  const [ticker, setTicker] = useState("TSLA");
  const [input, setInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [allTickers, setAllTickers] = useState<
    Array<{ ticker: string; name: string }>
  >([]);
  const [suggestions, setSuggestions] = useState<
    Array<{ ticker: string; name: string }>
  >([]);
  const [insights, setInsights] = useState("");
  const [peers, setPeers] = useState<string[]>([]);
  const [trend, setTrend] = useState("");

  // 🔵 Fetch AI insights
  const fetchInsights = async (json: any) => {
    const res = await fetch("http://127.0.0.1:8000/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    const out = await res.json();
    setInsights(out.insights);
  };

  // 🔵 Load a company's financials
  const fetchData = (tkr: string) => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/financials/${tkr}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        fetchInsights(json);   // ADD THIS LINE
        fetch("http://127.0.0.1:8000/trend_insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json)
        })
          .then(res => res.json())
          .then(out => setTrend(out.trend_analysis));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  // 🔵 Load ticker list + default TSLA
  useEffect(() => {
    fetch("http://127.0.0.1:8000/tickers")
      .then((res) => res.json())
      .then(setAllTickers);

    fetchData(ticker); // load default
  }, []);

  // 🔵 Fetch peers when ticker changes
  useEffect(() => {
    if (ticker) {
      fetch(`http://127.0.0.1:8000/peers/${ticker}`)
        .then(res => res.json())
        .then(json => setPeers(json.peers || []));
    }
  }, [ticker]);

  // 🔵 Handle Search
  const handleSearch = (e: any) => {
    e.preventDefault();
    if (!input) return;
    const newTicker = input.toUpperCase();
    setTicker(newTicker);
    fetchData(newTicker);
  };

  // 🔵 Build Sankey structure for 1 company
  const sankeyData = useMemo(() => {
    if (!data) return null;

    const revenue = data.revenue || 0;
    const net_income = data.net_income || 0;
    const operating_cash_flow = data.operating_cash_flow || 0;
    const investing_cash_flow = data.investing_cash_flow || 0;

    // *Placeholder derived values (upgrade later)*
    const gross_profit = revenue * 0.25;
    const cogs = revenue - gross_profit;
    const operating_income = net_income * 1.25;
    const operating_expenses = gross_profit - operating_income;
    const taxes = operating_income - net_income;
    const capex = Math.abs(investing_cash_flow);
    const free_cash_flow = operating_cash_flow - capex;

    return {
      labels: [
        "Revenue", "COGS", "Gross Profit",
        "Operating Expenses", "Operating Income",
        "Taxes", "Net Income",
        "Operating Cash Flow", "CapEx", "Free Cash Flow"
      ],
      links: [
        { source: 0, target: 1, value: cogs },
        { source: 0, target: 2, value: gross_profit },
        { source: 2, target: 3, value: operating_expenses },
        { source: 2, target: 4, value: operating_income },
        { source: 4, target: 5, value: taxes },
        { source: 4, target: 6, value: net_income },
        { source: 6, target: 7, value: operating_cash_flow },
        { source: 7, target: 8, value: capex },
        { source: 7, target: 9, value: free_cash_flow },
      ]
    };
  }, [data]);

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", color: "#fff" }}>

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ fontSize: "32px", color: "white" }}>
          TraceMoney — Company Financial Explorer
        </h1>

        <a
          href="/compare"
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "white",
            borderRadius: "6px",
            textDecoration: "none",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Compare
        </a>
      </div>

      {/* SEARCH BAR */}
      <div style={{ position: "relative", width: "300px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search company… (AAPL, MSFT, NVDA)"
          value={input}
          onChange={(e) => {
            const val = e.target.value.toUpperCase();
            setInput(val);

            if (val.length > 0) {
              const filtered = allTickers
                .filter(
                  (item) =>
                    item.ticker.startsWith(val) ||
                    item.name.toUpperCase().includes(val)
                )
                .slice(0, 10);
              setSuggestions(filtered);
            } else {
              setSuggestions([]);
            }
          }}
          style={{
            padding: "10px",
            width: "100%",
            fontSize: "16px",
            borderRadius: "6px",
            border: "1px solid #555",
          }}
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "45px",
              width: "100%",
              backgroundColor: "#222",
              border: "1px solid #444",
              borderRadius: "6px",
              maxHeight: "200px",
              overflowY: "auto",
              zIndex: 10,
            }}
          >
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setTicker(item.ticker);
                  fetchData(item.ticker);
                  setInput("");
                  setSuggestions([]);
                }}
                style={{
                  padding: "10px",
                  cursor: "pointer",
                  borderBottom: "1px solid #333",
                  color: "#fff",
                }}
              >
                <strong>{item.ticker}</strong> — {item.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <h2>{ticker} Financials:</h2>

      {loading && <p>Loading...</p>}

      {/* SHOW RESULT */}
      {data && (
        <>
          {/* JSON BLOCK */}
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: "20px",
              borderRadius: "8px",
              marginTop: "20px",
              fontSize: "14px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>

          {/* SANKEY DIAGRAM */}
          <div style={{ marginTop: "40px" }}>
            <SankeyDiagram financials={data} />
          </div>

          {/* AI INSIGHTS */}
          {insights && (
            <div
              style={{
                marginTop: "40px",
                padding: "20px",
                background: "#111",
                borderRadius: "10px",
                border: "1px solid #333",
                whiteSpace: "pre-line",
                fontSize: "15px",
                lineHeight: "1.5"
              }}
            >
              <h3>AI Financial Insights</h3>
              <p>{insights}</p>
            </div>
          )}

          {/* 5-YEAR TREND ANALYSIS */}
          {trend && (
            <div
              style={{
                marginTop: "40px",
                padding: "20px",
                background: "#111",
                borderRadius: "10px",
                border: "1px solid #333",
                whiteSpace: "pre-line"
              }}
            >
              <h3>5-Year Trend Analysis</h3>
              <p>{trend}</p>
            </div>
          )}

          {/* HEALTH SCORE */}
          {data.health_score !== undefined && (
            <div
              style={{
                marginTop: "40px",
                padding: "20px",
                background: "#111",
                borderRadius: "10px",
                border: "1px solid #333",
              }}
            >
              <h3>Financial Health Score</h3>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "28px",
                  fontWeight: "bold",
                  color:
                    data.health_score > 75
                      ? "#22c55e"
                      : data.health_score > 50
                      ? "#eab308"
                      : "#ef4444",
                }}
              >
                {data.health_score}/100
              </div>

              <div style={{ marginTop: "15px", opacity: 0.8 }}>
                {data.indicators?.profit_margin !== undefined && (
                  <p>
                    Profit Margin:{" "}
                    {(data.indicators.profit_margin * 100).toFixed(2)}%
                  </p>
                )}
                {data.indicators?.cash_conversion !== undefined && (
                  <p>
                    Cash Conversion:{" "}
                    {data.indicators.cash_conversion.toFixed(2)}x
                  </p>
                )}
                {data.indicators?.capex !== undefined && (
                  <p>CapEx: {data.indicators.capex}</p>
                )}
                {data.indicators?.financing !== undefined && (
                  <p>Financing Activity: {data.indicators.financing}</p>
                )}
              </div>
            </div>
          )}

          {/* --------- Peer Suggestions ---------- */}
          {peers.length > 0 && (
            <div
              style={{
                marginTop: "40px",
                padding: "20px",
                background: "#111",
                borderRadius: "10px",
                border: "1px solid #333"
              }}
            >
              <h3>Similar Companies</h3>

              <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", marginTop: "10px" }}>
                {peers.map((peer, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTicker(peer);
                      fetchData(peer);
                    }}
                    style={{
                      padding: "8px 15px",
                      background: "#2563eb",
                      color: "white",
                      borderRadius: "6px",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    {peer}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
