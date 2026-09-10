# Escaped-defect register

Every production defect from the last two quarters, with the question the team
asks about each one: could a test we do not have have caught it?

| Ref | What happened | Could a test have caught it? |
|---|---|---|
| INC-104 | A supplier changed a price-feed field name without notice. | No — an upstream contract change outside our repository. Handled by a schema check on ingest, not by a test of our code. |
| INC-107 | A cloud provider zone outage took the checkout offline for 20 minutes. | No — availability, not correctness. |
| INC-112 | A customer-support macro sent the wrong template. | No — content, not code. |

No defect in this window is attributable to a missing unit, integration, or
end-to-end test. No test has been quarantined, retried, or muted in this window
either.
