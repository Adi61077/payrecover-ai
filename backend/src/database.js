const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'payrecover.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      failure_reason TEXT NOT NULL,
      failure_code TEXT NOT NULL,
      previous_failures INTEGER DEFAULT 0,
      retry_count INTEGER DEFAULT 0,
      payment_history TEXT NOT NULL,
      risk_level TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'failed',
      recovery_status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recovery_actions (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      ai_recommendation TEXT,
      guardrail_decision TEXT,
      guardrail_override INTEGER DEFAULT 0,
      final_action TEXT NOT NULL,
      outcome TEXT DEFAULT 'pending',
      executed_at TEXT NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );

    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      diagnosis TEXT NOT NULL,
      recovery_probability INTEGER NOT NULL,
      recommended_action TEXT NOT NULL,
      reasoning TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      model_used TEXT DEFAULT 'gpt-4o-mini',
      is_fallback INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (payment_id) REFERENCES payments(id)
    );
  `);

  return database;
}

function seedDemoData() {
  const database = getDb();

  const existingCount = database.prepare('SELECT COUNT(*) as count FROM payments').get();
  if (existingCount.count > 0) {
    console.log('Demo data already seeded, skipping.');
    return;
  }

  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const demoPayments = [
    // Scenario A: Temporary failure + good history → retry → success
    {
      id: 'pay_001',
      customer_name: 'Priya Sharma',
      customer_email: 'priya.sharma@techcorp.in',
      amount: 45000,
      currency: 'INR',
      failure_reason: 'Insufficient funds - temporary',
      failure_code: 'INSUFFICIENT_FUNDS_TEMP',
      previous_failures: 1,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 24,
        successful_payments: 23,
        total_amount_paid: 540000,
        average_payment: 22500,
        last_successful: daysAgo(5),
        customer_since: daysAgo(730),
        payment_score: 96
      }),
      risk_level: 'low',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(1),
      updated_at: daysAgo(1)
    },
    // Scenario A2: Another low-risk retry candidate
    {
      id: 'pay_002',
      customer_name: 'Rahul Mehta',
      customer_email: 'rahul.mehta@startup.io',
      amount: 12500,
      currency: 'INR',
      failure_reason: 'Bank server timeout',
      failure_code: 'BANK_TIMEOUT',
      previous_failures: 0,
      retry_count: 1,
      payment_history: JSON.stringify({
        total_payments: 18,
        successful_payments: 18,
        total_amount_paid: 225000,
        average_payment: 12500,
        last_successful: daysAgo(2),
        customer_since: daysAgo(540),
        payment_score: 100
      }),
      risk_level: 'low',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(0.5),
      updated_at: daysAgo(0.5)
    },
    // Scenario B: Repeated failures → guardrail blocks retry → escalate/stop
    {
      id: 'pay_003',
      customer_name: 'Anjali Patel',
      customer_email: 'anjali.patel@ecommerce.com',
      amount: 8750,
      currency: 'INR',
      failure_reason: 'Insufficient funds - repeated',
      failure_code: 'INSUFFICIENT_FUNDS',
      previous_failures: 4,
      retry_count: 2,
      payment_history: JSON.stringify({
        total_payments: 12,
        successful_payments: 8,
        total_amount_paid: 84000,
        average_payment: 10500,
        last_successful: daysAgo(45),
        customer_since: daysAgo(365),
        payment_score: 62
      }),
      risk_level: 'high',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(2),
      updated_at: daysAgo(2)
    },
    // Scenario B2: Reached retry limit
    {
      id: 'pay_004',
      customer_name: 'Vikram Singh',
      customer_email: 'vikram.singh@retail.co',
      amount: 22000,
      currency: 'INR',
      failure_reason: 'Card declined repeatedly',
      failure_code: 'CARD_DECLINED',
      previous_failures: 3,
      retry_count: 2,
      payment_history: JSON.stringify({
        total_payments: 7,
        successful_payments: 4,
        total_amount_paid: 66000,
        average_payment: 16500,
        last_successful: daysAgo(60),
        customer_since: daysAgo(200),
        payment_score: 55
      }),
      risk_level: 'high',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(1.5),
      updated_at: daysAgo(1.5)
    },
    // Scenario C: Payment method issue → reminder
    {
      id: 'pay_005',
      customer_name: 'Sneha Krishnan',
      customer_email: 'sneha.k@design.studio',
      amount: 5999,
      currency: 'INR',
      failure_reason: 'Card expired',
      failure_code: 'CARD_EXPIRED',
      previous_failures: 0,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 30,
        successful_payments: 30,
        total_amount_paid: 179970,
        average_payment: 5999,
        last_successful: daysAgo(35),
        customer_since: daysAgo(900),
        payment_score: 98
      }),
      risk_level: 'low',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(0.2),
      updated_at: daysAgo(0.2)
    },
    // Scenario C2: UPI/payment method problem
    {
      id: 'pay_006',
      customer_name: 'Arjun Nair',
      customer_email: 'arjun.nair@consulting.in',
      amount: 18500,
      currency: 'INR',
      failure_reason: 'UPI PIN incorrect',
      failure_code: 'UPI_PIN_INCORRECT',
      previous_failures: 1,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 15,
        successful_payments: 14,
        total_amount_paid: 260000,
        average_payment: 18571,
        last_successful: daysAgo(10),
        customer_since: daysAgo(480),
        payment_score: 88
      }),
      risk_level: 'medium',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(0.3),
      updated_at: daysAgo(0.3)
    },
    // Scenario D: High-value risky payment → human escalation
    {
      id: 'pay_007',
      customer_name: 'Deepika Reddy',
      customer_email: 'deepika.reddy@enterprise.com',
      amount: 285000,
      currency: 'INR',
      failure_reason: 'Fraud suspected by bank',
      failure_code: 'FRAUD_SUSPECTED',
      previous_failures: 2,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 5,
        successful_payments: 3,
        total_amount_paid: 420000,
        average_payment: 140000,
        last_successful: daysAgo(90),
        customer_since: daysAgo(120),
        payment_score: 45
      }),
      risk_level: 'high',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(0.1),
      updated_at: daysAgo(0.1)
    },
    // Scenario D2: Large B2B payment escalation
    {
      id: 'pay_008',
      customer_name: 'Karthik Iyer',
      customer_email: 'karthik@b2b-solutions.com',
      amount: 150000,
      currency: 'INR',
      failure_reason: 'Transaction limit exceeded',
      failure_code: 'TRANSACTION_LIMIT',
      previous_failures: 0,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 8,
        successful_payments: 8,
        total_amount_paid: 920000,
        average_payment: 115000,
        last_successful: daysAgo(15),
        customer_since: daysAgo(300),
        payment_score: 91
      }),
      risk_level: 'medium',
      status: 'failed',
      recovery_status: 'pending',
      created_at: daysAgo(0.4),
      updated_at: daysAgo(0.4)
    },
    // Already recovered payment (for metrics)
    {
      id: 'pay_009',
      customer_name: 'Meera Joshi',
      customer_email: 'meera.joshi@fashion.co',
      amount: 3200,
      currency: 'INR',
      failure_reason: 'Network timeout',
      failure_code: 'NETWORK_TIMEOUT',
      previous_failures: 0,
      retry_count: 1,
      payment_history: JSON.stringify({
        total_payments: 42,
        successful_payments: 42,
        total_amount_paid: 134400,
        average_payment: 3200,
        last_successful: daysAgo(7),
        customer_since: daysAgo(1095),
        payment_score: 99
      }),
      risk_level: 'low',
      status: 'recovered',
      recovery_status: 'recovered',
      created_at: daysAgo(3),
      updated_at: daysAgo(2.8)
    },
    // Stopped recovery
    {
      id: 'pay_010',
      customer_name: 'Suresh Babu',
      customer_email: 'suresh.babu@old-customer.com',
      amount: 15000,
      currency: 'INR',
      failure_reason: 'Account closed',
      failure_code: 'ACCOUNT_CLOSED',
      previous_failures: 5,
      retry_count: 2,
      payment_history: JSON.stringify({
        total_payments: 6,
        successful_payments: 4,
        total_amount_paid: 60000,
        average_payment: 15000,
        last_successful: daysAgo(180),
        customer_since: daysAgo(400),
        payment_score: 30
      }),
      risk_level: 'high',
      status: 'failed',
      recovery_status: 'stopped',
      created_at: daysAgo(5),
      updated_at: daysAgo(4)
    },
    // Escalated to human
    {
      id: 'pay_011',
      customer_name: 'Nandini Kapoor',
      customer_email: 'nandini.kapoor@premium.in',
      amount: 75000,
      currency: 'INR',
      failure_reason: 'Suspected fraudulent activity',
      failure_code: 'FRAUD_FLAG',
      previous_failures: 1,
      retry_count: 0,
      payment_history: JSON.stringify({
        total_payments: 3,
        successful_payments: 2,
        total_amount_paid: 150000,
        average_payment: 75000,
        last_successful: daysAgo(45),
        customer_since: daysAgo(60),
        payment_score: 40
      }),
      risk_level: 'high',
      status: 'failed',
      recovery_status: 'escalated',
      created_at: daysAgo(4),
      updated_at: daysAgo(3.5)
    },
    // Another recovered payment
    {
      id: 'pay_012',
      customer_name: 'Rohit Gupta',
      customer_email: 'rohit.gupta@saas.io',
      amount: 9999,
      currency: 'INR',
      failure_reason: 'Temporary bank downtime',
      failure_code: 'BANK_DOWNTIME',
      previous_failures: 0,
      retry_count: 1,
      payment_history: JSON.stringify({
        total_payments: 36,
        successful_payments: 36,
        total_amount_paid: 359964,
        average_payment: 9999,
        last_successful: daysAgo(30),
        customer_since: daysAgo(1080),
        payment_score: 100
      }),
      risk_level: 'low',
      status: 'recovered',
      recovery_status: 'recovered',
      created_at: daysAgo(6),
      updated_at: daysAgo(5.5)
    }
  ];

  const insertPayment = database.prepare(`
    INSERT INTO payments (id, customer_name, customer_email, amount, currency, failure_reason, failure_code,
      previous_failures, retry_count, payment_history, risk_level, status, recovery_status, created_at, updated_at)
    VALUES (@id, @customer_name, @customer_email, @amount, @currency, @failure_reason, @failure_code,
      @previous_failures, @retry_count, @payment_history, @risk_level, @status, @recovery_status, @created_at, @updated_at)
  `);

  const insertMany = database.transaction((payments) => {
    for (const p of payments) insertPayment.run(p);
  });

  insertMany(demoPayments);

  // Seed audit logs for already-resolved payments
  const insertAudit = database.prepare(`
    INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
    VALUES (@id, @payment_id, @event_type, @event_description, @metadata, @created_at)
  `);

  const auditLogs = [
    // pay_009 recovered flow
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'payment_failed', event_description: 'Payment failed due to network timeout', metadata: JSON.stringify({ failure_code: 'NETWORK_TIMEOUT', amount: 3200 }), created_at: daysAgo(3) },
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'ai_analysis_started', event_description: 'AI analysis initiated for failed payment', metadata: null, created_at: daysAgo(2.99) },
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'ai_diagnosis_complete', event_description: 'AI diagnosis: Network timeout - temporary issue', metadata: JSON.stringify({ recovery_probability: 92, recommended_action: 'retry', risk_level: 'low' }), created_at: daysAgo(2.98) },
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'guardrail_check', event_description: 'Guardrail validation passed. Retry approved.', metadata: JSON.stringify({ guardrail_override: false }), created_at: daysAgo(2.98) },
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'action_executed', event_description: 'Retry payment executed (simulated)', metadata: JSON.stringify({ action: 'retry' }), created_at: daysAgo(2.9) },
    { id: uuidv4(), payment_id: 'pay_009', event_type: 'payment_recovered', event_description: 'Payment successfully recovered. ₹3,200 recovered.', metadata: JSON.stringify({ amount_recovered: 3200 }), created_at: daysAgo(2.8) },

    // pay_010 stopped flow
    { id: uuidv4(), payment_id: 'pay_010', event_type: 'payment_failed', event_description: 'Payment failed due to account closure', metadata: JSON.stringify({ failure_code: 'ACCOUNT_CLOSED', amount: 15000 }), created_at: daysAgo(5) },
    { id: uuidv4(), payment_id: 'pay_010', event_type: 'ai_analysis_started', event_description: 'AI analysis initiated for failed payment', metadata: null, created_at: daysAgo(4.99) },
    { id: uuidv4(), payment_id: 'pay_010', event_type: 'ai_diagnosis_complete', event_description: 'AI diagnosis: Account closed - unrecoverable', metadata: JSON.stringify({ recovery_probability: 5, recommended_action: 'stop', risk_level: 'high' }), created_at: daysAgo(4.98) },
    { id: uuidv4(), payment_id: 'pay_010', event_type: 'guardrail_check', event_description: 'Guardrail: Max retries reached. Recovery stopped automatically.', metadata: JSON.stringify({ guardrail_override: false, rule: 'max_retries_exceeded' }), created_at: daysAgo(4.98) },
    { id: uuidv4(), payment_id: 'pay_010', event_type: 'recovery_stopped', event_description: 'Recovery stopped. Payment marked unrecoverable.', metadata: null, created_at: daysAgo(4) },

    // pay_011 escalated flow
    { id: uuidv4(), payment_id: 'pay_011', event_type: 'payment_failed', event_description: 'Payment failed - fraud flag raised by bank', metadata: JSON.stringify({ failure_code: 'FRAUD_FLAG', amount: 75000 }), created_at: daysAgo(4) },
    { id: uuidv4(), payment_id: 'pay_011', event_type: 'ai_analysis_started', event_description: 'AI analysis initiated for failed payment', metadata: null, created_at: daysAgo(3.99) },
    { id: uuidv4(), payment_id: 'pay_011', event_type: 'ai_diagnosis_complete', event_description: 'AI diagnosis: Fraud flag - high risk, requires human review', metadata: JSON.stringify({ recovery_probability: 35, recommended_action: 'escalate', risk_level: 'high' }), created_at: daysAgo(3.98) },
    { id: uuidv4(), payment_id: 'pay_011', event_type: 'guardrail_check', event_description: 'Guardrail: High-risk fraud case escalated to human agent', metadata: JSON.stringify({ guardrail_override: true, rule: 'high_risk_escalation' }), created_at: daysAgo(3.97) },
    { id: uuidv4(), payment_id: 'pay_011', event_type: 'escalated_to_human', event_description: 'Case escalated to human recovery agent for manual review', metadata: null, created_at: daysAgo(3.5) },

    // pay_012 recovered flow
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'payment_failed', event_description: 'Payment failed due to bank maintenance downtime', metadata: JSON.stringify({ failure_code: 'BANK_DOWNTIME', amount: 9999 }), created_at: daysAgo(6) },
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'ai_analysis_started', event_description: 'AI analysis initiated for failed payment', metadata: null, created_at: daysAgo(5.99) },
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'ai_diagnosis_complete', event_description: 'AI diagnosis: Bank downtime - temporary, high chance of recovery', metadata: JSON.stringify({ recovery_probability: 95, recommended_action: 'retry', risk_level: 'low' }), created_at: daysAgo(5.98) },
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'guardrail_check', event_description: 'Guardrail validation passed. Retry approved.', metadata: JSON.stringify({ guardrail_override: false }), created_at: daysAgo(5.97) },
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'action_executed', event_description: 'Retry payment executed (simulated)', metadata: JSON.stringify({ action: 'retry' }), created_at: daysAgo(5.8) },
    { id: uuidv4(), payment_id: 'pay_012', event_type: 'payment_recovered', event_description: 'Payment successfully recovered. ₹9,999 recovered.', metadata: JSON.stringify({ amount_recovered: 9999 }), created_at: daysAgo(5.5) }
  ];

  const insertAuditMany = database.transaction((logs) => {
    for (const log of logs) insertAudit.run(log);
  });

  insertAuditMany(auditLogs);

  console.log('Demo data seeded successfully.');
}

module.exports = { getDb, initDb, seedDemoData };
