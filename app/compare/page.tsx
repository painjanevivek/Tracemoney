"use client";

import { useState } from "react";
import CleanSankey from "../Sankey";  // adjust path if needed

export default function ComparePage() {
  const [ticker1, setTicker1] = useState("TSLA");
  const [ticker2, setTicker2] = useState("AAPL");

  const [data1, setData1] = useState(null);
  const [data2, setData2] = useState(null);

  const fetch1 = () => {
    fetch(`http://127.0.0.1:8000/financials/${ticker1}`)
      .then(res => res.json())
      .then(setData1);
  };

  const fetch2 = () => {
    fetch(`http://127.0.0.1:8000/financials/${ticker2}`)
      .then(res => res.json())
      .then(setData2);
  };

  return (
    <div style={{ padding: "40px", color: "#fff", fontFamily: "sans-serif" }}>
      
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h1>Compare Companies</h1>

        <a 
          href="/"
          style={{
            padding: "10px 20px",
            background: "#444",
            color: "white",
            borderRadius: "6px",
            textDecoration: "none"
          }}
        >
          ← Back
        </a>
      </div>
      

      {/* Inputs */}
      <div style={{
        display: "flex",
        gap: "30px",
        marginBottom: "30px"
      }}>
        
        <div>
          <h3>Company 1</h3>
          <input
            value={ticker1}
            onChange={(e) => setTicker1(e.target.value.toUpperCase())}
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "180px",
              borderRadius: "8px",
              border: "1px solid #333"
            }}
          />
          <button 
            onClick={fetch1}
            style={{
              marginLeft: "10px",
              padding: "10px 20px",
              background: "#2563eb",
              color: "#fff",
              borderRadius: "6px"
            }}
          >
            Load
          </button>
        </div>

        <div>
          <h3>Company 2</h3>
          <input
            value={ticker2}
            onChange={(e) => setTicker2(e.target.value.toUpperCase())}
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "180px",
              borderRadius: "8px",
              border: "1px solid #333"
            }}
          />
          <button 
            onClick={fetch2}
            style={{
              marginLeft: "10px",
              padding: "10px 20px",
              background: "#2563eb",
              color: "#fff",
              borderRadius: "6px"
            }}
          >
            Load
          </button>
        </div>

      </div>


      {/* Comparison Grids */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "40px"
      }}>
        
        <div>
          {data1 && (
            <>
              <h2>{data1.ticker}</h2>
              <p>Health Score: {data1.health_score}</p>
              <CleanSankey financials={data1} />
            </>
          )}
        </div>

        <div>
          {data2 && (
            <>
              <h2>{data2.ticker}</h2>
              <p>Health Score: {data2.health_score}</p>
              <CleanSankey financials={data2} />
            </>
          )}
        </div>

      </div>

    </div>
  );
}
