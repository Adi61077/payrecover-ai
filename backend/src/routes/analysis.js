const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { analyzePayment } = require('../services/aiService');
const { evaluateRecommendation } = require('../services/guardrailService');
const { v4: uuidv4 } = require('uuid');

// POST /api/analysis/:paymentId - run AI analysis + guardrail check
router.post('/:paymentId', async (req, res) => {
  try {
    const db = getDb();
    const { paymentId } = req.params;

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Log: AI analysis started
    db.prepare(`
      INSERT INTO audit_logs (id, payment_id, event_type, event_description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), paymentId, 'ai_analysis_started', 'AI analysis initiated for failed payment', null, new Date().toISOString());

    // Run AI analysis
    const parsedPayment = {
      ...payment,
      payment_history: (() => {
        try { return JSON.parse(payment.payment_history); } catch { return {}; }
      })()
    };

    const aiAnalysis = await analyzePayment(parsedPayment);

    // Run guardrail check
    const guardrailDecision = evaluateRecommendation(payment, aiAnalysis);

    // Save AI analysis to DB
    const analysisId = uuidv4();
    db.prepare(`
      INSERT INTO ai_analyses (id, payment_id, diagnosis, recovery_probability, recommended_action, reasoning, risk_level, model_used, is_fallback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysisId,
      paymentId,
      aiAnalysis.diagnosis,
      aiAnalysis.recovery_probability,
      aiAnalysis.recommended_action,
      aiAnalysis.reasoning,
      aiAnalysis.risk_level,
      aiAnalysis.model_used,
      aiAnalysis.is_fallback ? 1 : 0,
      new Date().toISOString()
    );

    res.json({
      success: true,
      data: {
        analysis: {
          id: analysisId,
          ...aiAnalysis
        },
        guardrail: guardrailDecision
      }
    });
  } catch (err) {
    console.error('Error running analysis:', err);
    res.status(500).json({ success: false, error: 'Failed to run AI analysis' });
  }
});

// GET /api/analysis/:paymentId - get latest analysis for a payment
router.get('/:paymentId', (req, res) => {
  try {
    const db = getDb();
    const analysis = db.prepare(
      'SELECT * FROM ai_analyses WHERE payment_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(req.params.paymentId);

    if (!analysis) {
      return res.status(404).json({ success: false, error: 'No analysis found for this payment' });
    }

    // Re-run guardrail check with stored analysis
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.paymentId);
    const guardrailDecision = payment ? evaluateRecommendation(payment, analysis) : null;

    res.json({
      success: true,
      data: {
        analysis,
        guardrail: guardrailDecision
      }
    });
  } catch (err) {
    console.error('Error fetching analysis:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch analysis' });
  }
});

module.exports = router;
