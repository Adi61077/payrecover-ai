const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/audit - get all audit logs (optionally filtered by payment_id)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { payment_id, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT al.*, p.customer_name, p.amount, p.currency
      FROM audit_logs al
      LEFT JOIN payments p ON al.payment_id = p.id
    `;
    const params = [];

    if (payment_id) {
      query += ' WHERE al.payment_id = ?';
      params.push(payment_id);
    }

    query += ' ORDER BY al.created_at DESC';
    query += ` LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const logs = db.prepare(query).all(...params);

    const totalQuery = payment_id
      ? 'SELECT COUNT(*) as count FROM audit_logs WHERE payment_id = ?'
      : 'SELECT COUNT(*) as count FROM audit_logs';
    const total = db.prepare(totalQuery).get(...(payment_id ? [payment_id] : []));

    const parsed = logs.map(log => ({
      ...log,
      metadata: (() => {
        try { return JSON.parse(log.metadata); } catch { return null; }
      })()
    }));

    res.json({ success: true, data: parsed, total: total.count });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// GET /api/audit/:paymentId - get audit trail for a specific payment
router.get('/:paymentId', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT * FROM audit_logs WHERE payment_id = ? ORDER BY created_at ASC'
    ).all(req.params.paymentId);

    const parsed = logs.map(log => ({
      ...log,
      metadata: (() => {
        try { return JSON.parse(log.metadata); } catch { return null; }
      })()
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
