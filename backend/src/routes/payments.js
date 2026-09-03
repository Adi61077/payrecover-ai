const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/payments - list all payments
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, recovery_status, risk_level } = req.query;

    let query = 'SELECT * FROM payments';
    const conditions = [];
    const params = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (recovery_status) { conditions.push('recovery_status = ?'); params.push(recovery_status); }
    if (risk_level) { conditions.push('risk_level = ?'); params.push(risk_level); }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const payments = db.prepare(query).all(...params);

    // Parse payment_history JSON for each payment
    const parsed = payments.map(p => ({
      ...p,
      payment_history: (() => {
        try { return JSON.parse(p.payment_history); } catch { return {}; }
      })()
    }));

    res.json({ success: true, data: parsed, total: parsed.length });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch payments' });
  }
});

// GET /api/payments/metrics - dashboard metrics
router.get('/metrics', (req, res) => {
  try {
    const db = getDb();

    const totalPayments = db.prepare("SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE status = 'failed' OR status = 'recovered'").get();
    const failedPayments = db.prepare("SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE status = 'failed'").get();
    const recoveredPayments = db.prepare("SELECT COUNT(*) as count, SUM(amount) as total FROM payments WHERE recovery_status = 'recovered'").get();
    const escalatedPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE recovery_status = 'escalated'").get();
    const stoppedPayments = db.prepare("SELECT COUNT(*) as count FROM payments WHERE recovery_status = 'stopped'").get();

    const totalActions = db.prepare('SELECT COUNT(*) as count FROM recovery_actions').get();
    const successfulActions = db.prepare("SELECT COUNT(*) as count FROM recovery_actions WHERE outcome = 'success'").get();
    const failedActions = db.prepare("SELECT COUNT(*) as count FROM recovery_actions WHERE outcome = 'failed'").get();

    const revenueAtRisk = failedPayments.total || 0;
    const recoveredRevenue = recoveredPayments.total || 0;
    const recoveryRate = revenueAtRisk > 0 ? ((recoveredRevenue / revenueAtRisk) * 100).toFixed(1) : 0;

    // Revenue over time for chart (last 7 days)
    const revenueByDay = db.prepare(`
      SELECT
        DATE(created_at) as date,
        SUM(CASE WHEN recovery_status = 'recovered' THEN amount ELSE 0 END) as recovered,
        SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as at_risk
      FROM payments
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all();

    // Action distribution
    const actionDistribution = db.prepare(`
      SELECT final_action as action, COUNT(*) as count
      FROM recovery_actions
      GROUP BY final_action
    `).all();

    res.json({
      success: true,
      data: {
        revenue_at_risk: revenueAtRisk,
        recovered_revenue: recoveredRevenue,
        recovery_rate: parseFloat(recoveryRate),
        total_failed_payments: failedPayments.count || 0,
        total_recovered_payments: recoveredPayments.count || 0,
        escalated_payments: escalatedPayments.count || 0,
        stopped_payments: stoppedPayments.count || 0,
        total_recovery_attempts: totalActions.count || 0,
        successful_recoveries: successfulActions.count || 0,
        failed_recoveries: failedActions.count || 0,
        revenue_by_day: revenueByDay,
        action_distribution: actionDistribution
      }
    });
  } catch (err) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

// GET /api/payments/:id - get single payment with full details
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Get latest AI analysis
    const analysis = db.prepare(
      'SELECT * FROM ai_analyses WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.params.id);

    // Get recovery actions
    const actions = db.prepare(
      'SELECT * FROM recovery_actions WHERE payment_id = ? ORDER BY executed_at DESC'
    ).all(req.params.id);

    // Get audit logs
    const auditLogs = db.prepare(
      'SELECT * FROM audit_logs WHERE payment_id = ? ORDER BY created_at ASC'
    ).all(req.params.id);

    const result = {
      ...payment,
      payment_history: (() => {
        try { return JSON.parse(payment.payment_history); } catch { return {}; }
      })(),
      ai_analysis: analysis ? {
        ...analysis,
        // these fields are stored as text in DB, no JSON parsing needed
      } : null,
      recovery_actions: actions.map(a => ({
        ...a,
        ai_recommendation: (() => {
          try { return JSON.parse(a.ai_recommendation); } catch { return null; }
        })(),
        guardrail_decision: (() => {
          try { return JSON.parse(a.guardrail_decision); } catch { return null; }
        })()
      })),
      audit_logs: auditLogs.map(log => ({
        ...log,
        metadata: (() => {
          try { return JSON.parse(log.metadata); } catch { return null; }
        })()
      }))
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching payment:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch payment' });
  }
});

module.exports = router;
