# Email with Postal

[Back to SpiderRoute](../README.md)

Set `POSTAL_API_URL`, `POSTAL_API_KEY`, `POSTAL_FROM_EMAIL`, and `POSTAL_WEBHOOK_PUBLIC_KEY` (PEM or base64 PEM). Use a dedicated SpiderRoute credential. Add domain-specific DKIM, one SPF policy, and an aligned return path using Postal's exact values. Preserve existing MX records. Start DMARC in monitoring mode.

The contact address uses an exact `hello` incoming route in Postal, forwarding to the privately configured owner mailbox. Publish the Postal SMTP host as the domain MX; other recipient names have no catch-all route. Incoming forwarding events are acknowledged without changing transactional recipient suppressions.

Webhook: `https://app.spiderroute.com/api/postal/webhook`. The receiver checks `x-postal-signature-256` using RSA-SHA256. The outbox retries failures with backoff, records provider IDs and suppresses bounced recipients. Delivery attempts are at-least-once: a network timeout after provider acceptance can cause a repeat; a stable X-SpiderRoute-Outbox-ID header aids diagnosis. No marketing automation is included.

Verify actual delivery to a controlled mailbox and inspect SPF/DKIM/DMARC, Postal delivery status and signed webhook events. An API success alone does not prove delivery. Never expose route data in test emails.
