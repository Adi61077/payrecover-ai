# PayRecover AI 🚀

**Razorpay AI Buildathon — Track 3: AI Revenue Recovery**

An AI-powered revenue recovery system that detects failed payments, diagnoses failure reasons, recommends recovery actions using GPT-4o-mini, validates them through deterministic safety guardrails, and executes simulated recovery actions.

> ⚠️ **Demo only** — All payments are synthetic. No real money is moved.

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### 1. Configure OpenAI API Key (optional)
```
backend/.env  →  OPENAI_API_KEY=your_key_here
```
The app works fully without a key using the built-in fallback rule engine.

### 2. Start the application

**Option A — PowerShell script (opens two terminals):**
```powershell
.\start.ps1
```

**Option B — Manual:**
```bash
# Terminal 1 — Backend
cd backend && node src/server.js

# Terminal 2 — Frontend
cd frontend && npx vite
```

### 3. Open in browser
```
http://localhost:5173
```

---

## Architecture

```
Failed Payment
    ↓
AI Analysis (OpenAI GPT-4o-mini | Fallback Rule Engine)
    ↓
Guardrail Engine (deterministic safety rules)
    ↓
Recovery Action (simulated: retry / reminder / escalate / stop)
    ↓
Outcome + Audit Log
    ↓
Updated Metrics
```

### Key Principle
**AI suggests → Guardrails decide**

The AI reasoning layer is completely separated from the deterministic business rules. The guardrail engine can override any AI recommendation.

---

## Guardrail Rules

| Rule | Action |
|------|--------|
| retry_count ≥ 2 | Block retry → escalate or stop |
| risk_level = high + retry | Override → escalate |
| amount ≥ ₹2,00,000 + retry | Override → escalate |
| previous_failures ≥ 5 | Override → stop |
| Cooldown period not met | Override → escalate |
| recovery_probability < 20% | Override → escalate |
| Payment already recovered | Block → no action |

---

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, React Router
- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **AI**: OpenAI GPT-4o-mini + deterministic fallback
- **Charts**: Recharts v3

---

## Demo Scenarios

| Payment | Scenario | Expected Flow |
|---------|----------|--------------|
| pay_001 | Temporary failure, good history | AI: retry → Guardrail: ✅ approved |
| pay_003 | 4 failures, retry_count=2 | AI: stop → Guardrail: confirmed |
| pay_004 | Repeated card decline | AI: escalate → Guardrail: confirmed |
| pay_005 | Card expired | AI: reminder → Guardrail: ✅ approved |
| pay_007 | Fraud suspected, ₹2.85L | AI: escalate → Guardrail: confirmed |
| pay_008 | Transaction limit, ₹1.5L | AI: escalate → Guardrail: override (amount) |

---

## API Endpoints

```
GET  /api/payments            — List all payments
GET  /api/payments/metrics    — Dashboard metrics
GET  /api/payments/:id        — Payment detail
POST /api/analysis/:id        — Run AI analysis + guardrail
GET  /api/analysis/:id        — Get latest analysis
POST /api/recovery/:id/execute — Execute recovery action
GET  /api/audit               — All audit logs
GET  /api/audit/:id           — Audit trail for payment
GET  /health                  — Health check
```
