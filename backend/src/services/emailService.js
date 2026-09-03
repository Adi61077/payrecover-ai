const { Resend } = require('resend');

let resendClient = null;
let resendChecked = false;

function getResendClient() {
  if (!resendChecked) {
    resendChecked = true;
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && apiKey !== 'your_resend_api_key_here') {
      resendClient = new Resend(apiKey);
      console.log('✅ Resend email client initialised');
    } else {
      console.log('ℹ️  RESEND_API_KEY not set — email sending disabled');
    }
  }
  return resendClient;
}

/**
 * Build the plain-text + HTML reminder email body.
 * Clearly states this is a demo simulation — no real payment is processed.
 */
function buildReminderEmail(payment) {
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const subject = `Action Required: Payment of ${fmt(payment.amount)} needs your attention`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,system-ui,sans-serif;color:#e2e8f0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#6272f3);padding:28px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px">⚡ PayRecover AI</span>
                  <span style="display:block;font-size:12px;color:#c7d2fe;margin-top:4px">Revenue Recovery · Demo Simulation</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Demo banner -->
        <tr>
          <td style="background:#7c3aed22;border-bottom:1px solid #334155;padding:10px 32px;text-align:center">
            <span style="font-size:11px;color:#a78bfa;font-weight:600;letter-spacing:0.05em">
              ⚠ DEMO SIMULATION — No real payment is processed. No money is moved.
            </span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <p style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 8px">Dear ${payment.customer_name},</p>
            <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.6">
              We noticed that a recent payment could not be processed. We'd like to help you complete it.
            </p>

            <!-- Payment details card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;border:1px solid #334155;margin-bottom:24px">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #1e293b">
                <span style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Payment Details</span>
              </td></tr>
              <tr><td style="padding:16px 20px">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding-bottom:8px">Payment ID</td>
                    <td align="right" style="font-size:12px;color:#94a3b8;font-family:monospace;padding-bottom:8px">${payment.id}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding-bottom:8px">Amount</td>
                    <td align="right" style="font-size:16px;color:#f1f5f9;font-weight:700;padding-bottom:8px">${fmt(payment.amount)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#64748b;padding-bottom:8px">Failure Reason</td>
                    <td align="right" style="font-size:12px;color:#fca5a5;padding-bottom:8px">${payment.failure_reason}</td>
                  </tr>
                  <tr>
                    <td style="font-size:12px;color:#64748b">Failure Code</td>
                    <td align="right" style="font-size:11px;color:#94a3b8;font-family:monospace">${payment.failure_code}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- CTA -->
            <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;line-height:1.6">
              To complete your payment, please update your payment method or try again with a valid card/UPI.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:24px">
              <tr>
                <td style="background:#4f46e5;border-radius:8px;padding:12px 24px">
                  <span style="color:#fff;font-size:14px;font-weight:600;text-decoration:none">
                    Update Payment Method (Simulated)
                  </span>
                </td>
              </tr>
            </table>

            <p style="font-size:13px;color:#475569;line-height:1.6;margin:0">
              If you have already resolved this, please ignore this email. Your account remains secure.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;background:#0f172a22">
            <p style="font-size:11px;color:#475569;margin:0;text-align:center;line-height:1.6">
              This is an automated demo message from PayRecover AI.<br>
              Razorpay AI Buildathon 2026 · Track 3: AI Revenue Recovery<br>
              <strong style="color:#7c3aed">No real payment action has been taken.</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `PayRecover AI — Payment Reminder (DEMO SIMULATION)
================================================
⚠ No real payment is processed. No money is moved.

Dear ${payment.customer_name},

A payment of ${fmt(payment.amount)} could not be processed.

Payment ID   : ${payment.id}
Amount       : ${fmt(payment.amount)}
Failure      : ${payment.failure_reason} (${payment.failure_code})

Please update your payment method to complete this transaction.

---
PayRecover AI · Razorpay AI Buildathon 2026
This is a demo simulation. No real actions are taken.
`;

  return { subject, html, text };
}

/**
 * Send a recovery reminder email.
 * Returns { success, messageId } on success or { success: false, error } on failure.
 * Never throws — always returns a result object so the caller can audit-log the outcome.
 */
async function sendReminderEmail(payment, toEmail) {
  const client = getResendClient();

  if (!client) {
    return {
      success: false,
      error: 'Email service not configured. Set RESEND_API_KEY in backend .env to enable emails.',
      not_configured: true,
    };
  }

  const { subject, html, text } = buildReminderEmail(payment);

  try {
    const result = await client.emails.send({
      from: 'PayRecover AI <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html,
      text,
    });

    if (result.error) {
      console.error('Resend API returned error:', result.error);
      return { success: false, error: result.error.message || 'Email send failed' };
    }

    console.log(`✅ Reminder email sent to ${toEmail} (id: ${result.data?.id})`);
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    console.error('Resend send error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendReminderEmail };
