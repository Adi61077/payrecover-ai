const OpenAI = require('openai');

let openaiClient = null;
let openaiChecked = false;

function getOpenAIClient() {
  if (!openaiChecked) {
    openaiChecked = true;
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      openaiClient = new OpenAI({ apiKey });
      console.log('✅ OpenAI client initialised (model: gpt-4o-mini)');
    } else {
      console.log('ℹ️  OPENAI_API_KEY not set — using fallback rule engine');
    }
  }
  return openaiClient;
}

// Deterministic fallback when AI is unavailable
function fallbackAnalysis(payment) {
  const {
    amount,
    failure_code,
    previous_failures,
    retry_count,
    payment_history
  } = payment;

  let history = {};
  try {
    history = typeof payment_history === 'string' ? JSON.parse(payment_history) : payment_history;
  } catch (e) {
    history = {};
  }

  const paymentScore = history.payment_score || 50;
  const totalPayments = history.total_payments || 1;
  const successfulPayments = history.successful_payments || 0;
  const successRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

  // Temporary / retriable failure codes
  const retriableCodes = ['INSUFFICIENT_FUNDS_TEMP', 'BANK_TIMEOUT', 'NETWORK_TIMEOUT', 'BANK_DOWNTIME'];
  const paymentMethodCodes = ['CARD_EXPIRED', 'UPI_PIN_INCORRECT', 'INVALID_CVV', 'CARD_DETAILS_WRONG'];
  const highRiskCodes = ['FRAUD_SUSPECTED', 'FRAUD_FLAG', 'CARD_STOLEN', 'ACCOUNT_FRAUD'];
  const terminalCodes = ['ACCOUNT_CLOSED', 'CARD_PERMANENTLY_BLOCKED', 'DO_NOT_HONOR'];

  let recommended_action = 'retry';
  let diagnosis = '';
  let reasoning = '';
  let recovery_probability = 50;
  let risk_level = 'medium';

  // Determine risk level
  if (amount >= 100000 || highRiskCodes.includes(failure_code) || previous_failures >= 4) {
    risk_level = 'high';
  } else if (amount <= 10000 && paymentScore >= 80 && previous_failures <= 1) {
    risk_level = 'low';
  } else {
    risk_level = 'medium';
  }

  if (terminalCodes.includes(failure_code) || (previous_failures >= 4 && retry_count >= 2)) {
    recommended_action = 'stop';
    diagnosis = 'Terminal failure detected. Payment cannot be recovered through automated means.';
    reasoning = `Failure code ${failure_code} indicates a terminal condition. With ${previous_failures} previous failures and ${retry_count} retries, further attempts are unlikely to succeed.`;
    recovery_probability = Math.max(5, 20 - (previous_failures * 3));
    risk_level = 'high';
  } else if (highRiskCodes.includes(failure_code) || (risk_level === 'high' && amount >= 50000)) {
    recommended_action = 'escalate';
    diagnosis = 'High-risk payment requires human review before any recovery action.';
    reasoning = `Fraud flag or high-value transaction detected. Risk level is high with ${previous_failures} previous failures. Manual review recommended to prevent potential losses.`;
    recovery_probability = Math.max(20, 40 - (previous_failures * 5));
    risk_level = 'high';
  } else if (paymentMethodCodes.includes(failure_code)) {
    recommended_action = 'reminder';
    diagnosis = 'Payment method issue detected. Customer needs to update payment details.';
    reasoning = `Failure code ${failure_code} indicates the customer's payment method needs attention. Sending a reminder to update their payment details is the most effective action.`;
    recovery_probability = paymentScore >= 80 ? 75 : 55;
    risk_level = paymentScore >= 80 ? 'low' : 'medium';
  } else if (retriableCodes.includes(failure_code) && retry_count < 2 && previous_failures <= 2) {
    recommended_action = 'retry';
    diagnosis = 'Temporary failure detected. High probability of success on retry.';
    reasoning = `Failure code ${failure_code} is typically temporary. Customer has a ${successRate.toFixed(0)}% payment success rate with a score of ${paymentScore}. Retry recommended.`;
    recovery_probability = Math.min(95, 60 + (paymentScore * 0.3) + (successRate * 0.1));
    risk_level = paymentScore >= 80 ? 'low' : 'medium';
  } else if (previous_failures >= 2 && retry_count >= 2) {
    recommended_action = 'escalate';
    diagnosis = 'Multiple failures detected. Automated recovery exhausted.';
    reasoning = `With ${previous_failures} previous failures and ${retry_count} retries already attempted, automated recovery has been exhausted. Human intervention required.`;
    recovery_probability = Math.max(15, 35 - (previous_failures * 4));
    risk_level = 'high';
  } else {
    // Generic retry with moderate probability
    recommended_action = 'retry';
    diagnosis = `Payment failed due to ${failure_code.replace(/_/g, ' ').toLowerCase()}. Retry may resolve the issue.`;
    reasoning = `Customer payment score is ${paymentScore} with a ${successRate.toFixed(0)}% historical success rate. A retry attempt is recommended.`;
    recovery_probability = Math.min(80, 40 + (paymentScore * 0.3));
  }

  return {
    diagnosis,
    recovery_probability: Math.round(recovery_probability),
    recommended_action,
    reasoning,
    risk_level,
    is_fallback: true,
    model_used: 'fallback-rule-engine'
  };
}

async function analyzePayment(payment) {
  const client = getOpenAIClient();

  if (!client) {
    console.log('OpenAI client not available, using fallback analysis');
    return fallbackAnalysis(payment);
  }

  let paymentHistory = {};
  try {
    paymentHistory = typeof payment.payment_history === 'string'
      ? JSON.parse(payment.payment_history)
      : payment.payment_history;
  } catch (e) {
    paymentHistory = {};
  }

  const prompt = `You are an AI payment recovery specialist. Analyze this failed payment and return a JSON response.

PAYMENT DATA:
- Payment ID: ${payment.id}
- Customer: ${payment.customer_name}
- Amount: ₹${payment.amount.toLocaleString('en-IN')} INR
- Failure Reason: ${payment.failure_reason}
- Failure Code: ${payment.failure_code}
- Previous Failures: ${payment.previous_failures}
- Current Retry Count: ${payment.retry_count}

CUSTOMER PAYMENT HISTORY:
- Total Payments Made: ${paymentHistory.total_payments || 'N/A'}
- Successful Payments: ${paymentHistory.successful_payments || 'N/A'}
- Total Amount Paid: ₹${(paymentHistory.total_amount_paid || 0).toLocaleString('en-IN')}
- Customer Since: ${paymentHistory.customer_since ? new Date(paymentHistory.customer_since).toLocaleDateString() : 'N/A'}
- Payment Score: ${paymentHistory.payment_score || 'N/A'}/100
- Last Successful Payment: ${paymentHistory.last_successful ? new Date(paymentHistory.last_successful).toLocaleDateString() : 'N/A'}

AVAILABLE ACTIONS:
- retry: Automatically retry the payment after a cooldown period
- reminder: Send a payment reminder/update request to the customer
- escalate: Escalate to a human recovery agent
- stop: Stop recovery attempts for this payment

Analyze this payment failure and determine the best recovery strategy.

IMPORTANT: Respond ONLY with valid JSON in exactly this format:
{
  "diagnosis": "Clear explanation of why the payment failed and what it means",
  "recovery_probability": <number 0-100>,
  "recommended_action": "retry|reminder|escalate|stop",
  "reasoning": "Detailed explanation of why this action is recommended based on the data",
  "risk_level": "low|medium|high"
}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a payment recovery AI specialist. Always respond with valid JSON only. No markdown, no explanation outside JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 600,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    // Validate required fields
    const requiredFields = ['diagnosis', 'recovery_probability', 'recommended_action', 'reasoning', 'risk_level'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate action value
    const validActions = ['retry', 'reminder', 'escalate', 'stop'];
    if (!validActions.includes(parsed.recommended_action)) {
      parsed.recommended_action = 'escalate';
    }

    // Validate risk level
    const validRiskLevels = ['low', 'medium', 'high'];
    if (!validRiskLevels.includes(parsed.risk_level)) {
      parsed.risk_level = 'medium';
    }

    // Clamp probability
    parsed.recovery_probability = Math.max(0, Math.min(100, Math.round(parsed.recovery_probability)));

    return {
      ...parsed,
      is_fallback: false,
      model_used: 'gpt-4o-mini'
    };
  } catch (error) {
    const status = error.status || error.statusCode;
    if (status === 401) {
      console.error('OpenAI auth error (invalid API key) — check OPENAI_API_KEY in .env');
    } else if (status === 429) {
      console.error('OpenAI rate limit hit — falling back to rule engine');
    } else {
      console.error('OpenAI API error, falling back to rule-based analysis:', error.message);
    }
    return fallbackAnalysis(payment);
  }
}

module.exports = { analyzePayment };
