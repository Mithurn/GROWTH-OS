const crypto = require('crypto');
async function run() {
  const payload = {
    eventId: "test-event-123",
    providerMessageId: "test-prov-123",
    communicationId: "81eb383b-e103-4dc1-bc8b-d72937eec528", // Fake ID format
    status: "SENT",
    timestamp: new Date().toISOString(),
    sequenceNumber: 2
  };
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', 'xeno-webhook-secret-dev').update(body).digest('hex');
  const res = await fetch('http://localhost:3001/api/webhooks/channel-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-signature': sig },
    body: body
  });
  console.log(res.status, await res.text());
}
run();
