const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { analyzePayment } = require('../services/aiService');
const { evaluateRecommendation } = require('../services/guardrailService');
const { executeRecoveryAction } = require('../services/recoveryService');
const { sendReminderEmail } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

// POST /api/recovery/:paymentId/execute
// Full end-to-end: AI analysis → guardrail check → execute action
router.post('/:paymentId/execute', async (req, res) => {
  try {
    const db = getDb();
    const { paymentId } = req.params;
    const { override_action } = req.body; // optional manual override from UI

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Check for already resolved payment
    if (payment.recovery_status === 'recovered') {
      return res.status(400).json({ success: false, error: 'Payment already recovered' });
    }

    // Get latest AI analysis or run new one
    let analysis = db.prepare(
      'SELECT * FROM ai_analyses WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(paymentId);

    if (!analysis) {
      const parsedPayment = {
        ...payment,
        payment_history: (() => {
          try { return JSON.parse(payment.payment_history); } catch { return {}; }
        })()
      };

      // Log analysis started
      db.prepare(`
        INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), paymentId, 'ai_analysis_started', 'AI analysis initiated', null, new Date().toISOString());

      const aiResult = await analyzePayment(parsedPayment);

      const analysisId = uuidv4();
      db.prepare(`
        INSERT INTO ai_analyses (id, payment_id, diagnosis, recovery_probability, recommended_action, reasoning, risk_level, model_used, is_fallback, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        analysisId, paymentId,
        aiResult.diagnosis, aiResult.recovery_probability,
        aiResult.recommended_action, aiResult.reasoning,
        aiResult.risk_level, aiResult.model_used,
        aiResult.is_fallback ? 1 : 0,
        new Date().toISOString()
      );
      analysis = { id: analysisId, ...aiResult };
    }

    // Run guardrail check
    const guardrailDecision = evaluateRecommendation(payment, analysis);

    // Use override if provided (UI action button clicked by user), but still run through guardrails
    let finalAction = guardrailDecision.final_action;
    if (override_action && ['retry', 'reminder', 'escalate', 'stop'].includes(override_action)) {
      // Re-evaluate guardrails with the override action
      const overrideAnalysis = { ...analysis, recommended_action: override_action };
      const overrideGuardrail = evaluateRecommendation(payment, overrideAnalysis);
      finalAction = overrideGuardrail.final_action;
    }

    // Execute the recovery action
    const result = await executeRecoveryAction(paymentId, finalAction, analysis, guardrailDecision);

    res.json({
      success: true,
      data: {
        ...result,
        analysis,
        guardrail: guardrailDecision
      }
    });
  } catch (err) {
    console.error('Error executing recovery:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to execute recovery action' });
  }
});

// GET /api/recovery/:paymentId/actions - get all recovery actions for a payment
router.get('/:paymentId/actions', (req, res) => {
  try {
    const db = getDb();
    const actions = db.prepare(
      'SELECT * FROM recovery_actions WHERE payment_id = ? ORDER BY executed_at DESC'
    ).all(req.params.paymentId);

    const parsed = actions.map(a => ({
      ...a,
      ai_recommendation: (() => {
        try { return JSON.parse(a.ai_recommendation); } catch { return null; }
      })(),
      guardrail_decision: (() => {
        try { return JSON.parse(a.guardrail_decision); } catch { return null; }
      })()
    }));

    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('Error fetching recovery actions:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch recovery actions' });
  }
});

// POST /api/recovery/:paymentId/send-reminder
// Sends a recovery reminder email. Only allowed when guardrail final action is REMINDER.
router.post('/:paymentId/send-reminder', async (req, res) => {
  try {
    const db = getDb();
    const { paymentId } = req.params;

    // Load payment
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Load latest AI analysis
    const analysis = db.prepare(
      'SELECT * FROM ai_analyses WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(paymentId);

    if (!analysis) {
      return res.status(400).json({
        success: false,
        error: 'No AI analysis found. Run analysis first before sending a reminder.'
      });
    }

    // Guardrail check — email is only allowed when final action is REMINDER
    const guardrailDecision = evaluateRecommendation(payment, analysis);
    if (guardrailDecision.final_action !== 'reminder') {
      return res.status(403).json({
        success: false,
        error: `Email not allowed. Guardrail final action is "${guardrailDecision.final_action}", not "reminder".`,
        guardrail: guardrailDecision
      });
    }

    // Send the email
    const toEmail = payment.customer_email;
    const emailResult = await sendReminderEmail(payment, toEmail);

    const now = new Date().toISOString();

    if (emailResult.success) {
      // Audit log — success
      db.prepare(`
        INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), paymentId,
        'email_reminder_sent',
        `Recovery reminder email sent to ${toEmail} (simulated — no real payment action)`,
        JSON.stringify({ to: toEmail, message_id: emailResult.messageId }),
        now
      );

      return res.json({
        success: true,
        data: {
          message: `Reminder email sent to ${toEmail}`,
          messageId: emailResult.messageId,
          to: toEmail
        }
      });
    } else {
      // Audit log — failure
      db.prepare(`
        INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(), paymentId,
        'email_reminder_failed',
        `Recovery reminder email failed: ${emailResult.error}`,
        JSON.stringify({ to: toEmail, error: emailResult.error, not_configured: emailResult.not_configured || false }),
        now
      );

      // 503 if not configured, 502 if send failed
      const status = emailResult.not_configured ? 503 : 502;
      return res.status(status).json({
        success: false,
        error: emailResult.error,
        not_configured: emailResult.not_configured || false
      });
    }
  } catch (err) {
    console.error('Error sending reminder email:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to send reminder email' });
  }
});

module.exports = router;
