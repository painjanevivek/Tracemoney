from fastapi import FastAPI
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

PEER_GROUPS = {
    "TSLA": ["RIVN", "LCID", "NIO", "F", "GM"],
    "AAPL": ["MSFT", "GOOG", "META", "AMZN"],
    "MSFT": ["AAPL", "GOOG", "META", "AMZN"],
    "GOOG": ["AAPL", "MSFT", "META", "AMZN"],
    "NVDA": ["AMD", "INTC", "QCOM", "AVGO"],
    "AMZN": ["AAPL", "GOOG", "META", "MSFT"],
    "META": ["GOOG", "AAPL", "SNAP", "PINS"],
    "JPM": ["BAC", "C", "WFC", "GS"],
    "WMT": ["TGT", "COST", "KR", "AMZN"],
    "XOM": ["CVX", "COP", "BP", "SHEL"],
}

# -----------------------------
# APP + CORS SETUP
# -----------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# SEC HEADERS (MANDATORY)
# -----------------------------
SEC_HEADERS = {
    "User-Agent": "TraceMoneyApp/1.0 (contact: your_email_here@example.com)"
}

# -----------------------------
# GLOBAL STORAGE FOR TICKERS
# -----------------------------
TICKER_MAP = {}     # { "AAPL": "0000320193" }
TICKER_DATA = []    # [ { "ticker": "AAPL", "name": "Apple Inc." }, ... ]


# -----------------------------
# LOAD TICKERS FROM SEC ON STARTUP
# -----------------------------
def load_ticker_map():
    global TICKER_MAP, TICKER_DATA

    print("🔄 Loading SEC tickers...")

    url = "https://www.sec.gov/files/company_tickers.json"

    try:
        response = requests.get(url, headers=SEC_HEADERS)
        print("HTTP Status:", response.status_code)

        if response.status_code != 200:
            print("❌ Failed to load SEC tickers")
            return

        data = response.json()
        print("Total entries:", len(data))

        for _, entry in data.items():
            ticker = entry["ticker"].upper()
            name = entry["title"]
            cik = str(entry["cik_str"]).zfill(10)

            TICKER_MAP[ticker] = cik
            TICKER_DATA.append({"ticker": ticker, "name": name})

        print(f"✅ Loaded {len(TICKER_DATA)} tickers")

    except Exception as e:
        print("❌ Error loading SEC tickers:", e)


# Call the loader at startup
load_ticker_map()


# -----------------------------
# HELPER FUNCTION: EXTRACT LATEST FACT VALUE
# -----------------------------
def extract_latest_value(facts, tag):
    """
    Extract latest annual value for a given US-GAAP tag.
    """
    if tag not in facts:
        return None
    
    units = list(facts[tag]["units"].values())[0]  # first currency unit (USD)
    
    # Latest reported item
    sorted_entries = sorted(units, key=lambda x: x.get("end", ""), reverse=True)

    for entry in sorted_entries:
        if "val" in entry:
            return entry["val"]

    return None


def extract_last_5_years(facts, tag):
    """
    Returns last 5 annual values for a metric (e.g., Revenues).
    Format: [ {"year": 2023, "value": xxx}, ... ]
    """
    if tag not in facts:
        return []

    units = list(facts[tag]["units"].values())[0]  # e.g., USD
    data_points = []

    for entry in units:
        if "end" in entry and "val" in entry:
            year = entry["end"][0:4]
            if entry.get("form") in ["10-K", "10-K/A"]:  # annual reports only
                data_points.append({
                    "year": int(year),
                    "value": entry["val"]
                })

    # Sort newest → oldest
    data_points = sorted(data_points, key=lambda x: x["year"], reverse=True)

    return data_points[:5]


# -----------------------------
# HEALTH SCORE CALCULATION
# -----------------------------
def compute_health_score(revenue, net_income, operating_cf, investing_cf, financing_cf):
    score = 0
    details = {}

    # 1. Profitability
    if revenue and net_income:
        margin = net_income / revenue
        details["profit_margin"] = margin
        if margin > 0.20:
            score += 25
        elif margin > 0.10:
            score += 20
        elif margin > 0.05:
            score += 15
        elif margin > 0:
            score += 10
        else:
            score += 2

    # 2. Cash Conversion
    if operating_cf and net_income:
        conversion = operating_cf / net_income if net_income != 0 else 0
        details["cash_conversion"] = conversion
        if conversion > 1.3:
            score += 25
        elif conversion > 1.0:
            score += 20
        elif conversion > 0.8:
            score += 15
        else:
            score += 5

    # 3. Investment Behavior
    details["capex"] = investing_cf
    if investing_cf < 0:  # CapEx heavy
        score += 10
    else:
        score += 5

    # 4. Financing Behavior
    details["financing"] = financing_cf
    if financing_cf < 0:  # Paying debt or buying back stock
        score += 15
    else:
        score += 5

    # Normalize score to 0–100
    final_score = min(100, score)

    return final_score, details


# -----------------------------
# API: RETURN ALL TICKERS (FOR AUTOCOMPLETE)
# -----------------------------
@app.get("/tickers")
def get_tickers():
    return TICKER_DATA


# -----------------------------
# API: RETURN FINANCIALS FOR SPECIFIC TICKER
# -----------------------------
@app.get("/financials/{ticker}")
def get_financials(ticker: str):
    ticker = ticker.upper()

    # Validate ticker
    if ticker not in TICKER_MAP:
        return {"error": "Ticker not found in SEC database"}

    cik = TICKER_MAP[ticker]

    # Fetch US-GAAP financial facts for the company
    facts_url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    data = requests.get(facts_url, headers=SEC_HEADERS).json()

    facts = data["facts"]["us-gaap"]

    # Extract important values
    revenue = extract_latest_value(facts, "Revenues")
    net_income = extract_latest_value(facts, "NetIncomeLoss")
    operating_cf = extract_latest_value(facts, "NetCashProvidedByUsedInOperatingActivities")
    investing_cf = extract_latest_value(facts, "NetCashProvidedByUsedInInvestingActivities")
    financing_cf = extract_latest_value(facts, "NetCashProvidedByUsedInFinancingActivities")

    # Extract historical financials
    rev_hist = extract_last_5_years(facts, "Revenues")
    ni_hist = extract_last_5_years(facts, "NetIncomeLoss")
    ocf_hist = extract_last_5_years(facts, "NetCashProvidedByUsedInOperatingActivities")

    # Compute free cash flow for each year
    fcf_hist = []
    icf_hist = extract_last_5_years(facts, "NetCashProvidedByUsedInInvestingActivities")
    for i in range(len(ocf_hist)):
        ocf_val = ocf_hist[i]["value"]
        # approximate capex from investing CF for that year (not perfect)
        if i < len(icf_hist):
            icf_val = icf_hist[i]["value"]
        else:
            icf_val = 0

        fcf_hist.append({
            "year": ocf_hist[i]["year"],
            "value": ocf_val - abs(icf_val)
        })

    health_score, indicators = compute_health_score(
        revenue, net_income, operating_cf, investing_cf, financing_cf
    )

    return {
        "ticker": ticker,
        "revenue": revenue,
        "net_income": net_income,
        "operating_cash_flow": operating_cf,
        "investing_cash_flow": investing_cf,
        "financing_cash_flow": financing_cf,
        "net_cash_flow": (operating_cf or 0) + (investing_cf or 0) + (financing_cf or 0),
        "health_score": health_score,
        "indicators": indicators,
        "trends": {
            "revenue": rev_hist,
            "net_income": ni_hist,
            "operating_cash_flow": ocf_hist,
            "free_cash_flow": fcf_hist
        }
    }


# -----------------------------
# AI INSIGHTS ENDPOINT (FEATURE 5A)
# -----------------------------
class FinancialInput(BaseModel):
    revenue: float
    net_income: float
    operating_cash_flow: float
    investing_cash_flow: float
    financing_cash_flow: float
    health_score: int
    indicators: dict

@app.post("/insights")
def generate_insights(fin: FinancialInput):
    rev = fin.revenue
    ni = fin.net_income
    ocf = fin.operating_cash_flow
    icf = fin.investing_cash_flow
    fcf = ocf - abs(icf)
    health = fin.health_score

    margin = (ni / rev) if rev else 0

    # Human tone insight
    insight = f"""
Here's a quick, human-friendly breakdown of how the company is doing financially:

**Revenue & Profitability**
The company generated about ${rev:,} in revenue. Net income comes in at ${ni:,}, which gives a net margin of roughly {(margin * 100):.2f}%. 
This margin is {'strong and healthy' if margin > 0.15 else 'okay but leaves room for improvement' if margin > 0.05 else 'quite low and worth monitoring'}.

**Cash Flow Quality**
Operating cash flow sits at ${ocf:,}. 
A good sign is that the company's cash flow from operations is {'higher than' if ocf > ni else 'lower than'} net income, which usually means earnings are supported by real cash rather than accounting adjustments.

Free cash flow (after subtracting capital spending) works out to about ${fcf:,}. This suggests that capital investment levels are {'reasonable and sustainable' if fcf > 0 else 'heavy—likely due to expansion or reinvestment needs'}.

**Investment Behavior**
Investing cash flow is ${icf:,}. 
This typically means the company is {'putting money into growth, assets, or acquisitions' if icf < 0 else 'not investing heavily at the moment'}.

**Financing Activity**
Financing cash flow of ${fin.financing_cash_flow:,} tells us the company is 
{'paying off debt or buying back shares' if fin.financing_cash_flow < 0 else 'raising debt or issuing shares to support operations or expansion'}.

**Overall Financial Health**
The company's overall health score is **{health}/100**, which suggests the business is 
{'in a strong and stable position' if health > 70 else 'doing fairly well but faces a few pressure points' if health > 40 else 'dealing with some financial stress right now'}.

Let me know if you'd like a comparison with another company, a deeper dive into profitability, or a breakdown of trends over time.
"""

    return {"insights": insight}


# -----------------------------
# API: RETURN PEER COMPANIES FOR A TICKER
# -----------------------------
@app.get("/peers/{ticker}")
def get_peers(ticker: str):
    ticker = ticker.upper()

    if ticker in PEER_GROUPS:
        return {"ticker": ticker, "peers": PEER_GROUPS[ticker]}
    
    # Fallback: return top 5 companies from autocomplete list
    fallback = [item["ticker"] for item in TICKER_DATA[:5]]

    return {"ticker": ticker, "peers": fallback}


# -----------------------------
# AI TREND ANALYSIS ENDPOINT
# -----------------------------
@app.post("/trend_insights")
def trend_insights(data: dict):
    rev = data["trends"]["revenue"]
    ni = data["trends"]["net_income"]
    ocf = data["trends"]["operating_cash_flow"]
    fcf = data["trends"]["free_cash_flow"]

    def summarize_trend(arr):
        if len(arr) < 2:
            return "Not enough data."

        start = arr[-1]["value"]
        end = arr[0]["value"]

        if end > start:
            return "has grown steadily"
        elif end < start:
            return "has declined over time"
        else:
            return "remained relatively flat"

    rev_summary = summarize_trend(rev)
    ni_summary = summarize_trend(ni)
    ocf_summary = summarize_trend(ocf)
    fcf_summary = summarize_trend(fcf)

    text = f"""
Here is a quick 5-year trend overview for this company:

**Revenue:** Over the last five years, revenue {rev_summary}.  
**Net Income:** Profitability {ni_summary}.  
**Operating Cash Flow:** Operating cash flow {ocf_summary}.  
**Free Cash Flow:** Free cash flow {fcf_summary}.

Overall, this gives a good sense of how the company is evolving financially over time. Let me know if you'd like a chart, ratio analysis, or comparison with another company's trends.
"""

    return {"trend_analysis": text}


# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.get("/")
def home():
    return {"message": "TraceMoney Backend Running"}
