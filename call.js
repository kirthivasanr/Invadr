/**
 * call.js — Twilio Voice Call Script (Multi-call)
 *
 * Triggered by the backend when "Alert Locals" is pressed.
 * Calls multiple verified numbers simultaneously.
 *
 * Usage:
 *   node call.js [species] [location]
 *
 * Example:
 *   node call.js "Cheatgrass" "Riverside Park, 34.05, -118.24"
 */

const twilio = require('twilio');

const accountSid = '';
const authToken = '';
const fromNumber = '+';

const client = twilio(accountSid, authToken);

// CLI args: species and location
const species = process.argv[2] || 'Unknown species';
const location = process.argv[3] || 'Unknown location';

const message = `Alert: An invasive species, ${species}, has been detected near ${location}. Please take immediate action.`;

const numbers = [
  '+',
  '+',
  '+',
];

async function callAll() {
  const callPromises = numbers.map(async (number) => {
    try {
      const call = await client.calls.create({
        to: number,
        from: fromNumber,
        twiml: `<Response><Say>${message}</Say></Response>`,
      });

      return {
        to: number,
        callSid: call.sid,
        status: 'initiated',
        error: null,
      };
    } catch (err) {
      return {
        to: number,
        callSid: null,
        status: 'failed',
        error: err.message,
      };
    }
  });

  const results = await Promise.all(callPromises);

  const successful = results.filter((r) => r.status === 'initiated');
  const failed = results.filter((r) => r.status === 'failed');

  console.log(`\nCall Summary: ${successful.length}/${results.length} initiated`);
  results.forEach((r) => {
    const icon = r.status === 'initiated' ? '✓' : '✗';
    console.log(`  ${icon} ${r.to} — ${r.status}${r.callSid ? ` (SID: ${r.callSid})` : ''}${r.error ? ` [${r.error}]` : ''}`);
  });

  if (failed.length === results.length) {
    process.exit(1);
  }
}

callAll().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
