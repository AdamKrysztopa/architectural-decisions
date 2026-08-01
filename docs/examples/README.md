# Examples

Real outputs produced by the skills, from synthetic scenarios (no private code). They show the
through-line: **recommend the least architecture that meets the requirement, and name the cost of
every pick.**

| Example | Skill · mode | Shows |
|---------|--------------|-------|
| [agentic-pdf-no-agent](agentic-pdf-no-agent.md) | agentic-patterns · greenfield | Talking you *out* of an agent you don't need |
| [agentic-refund-bot](agentic-refund-bot.md) | agentic-patterns · greenfield | A layered agent design with HITL on irreversible actions |
| [architecture-ecommerce](architecture-ecommerce.md) | decide-architecture · greenfield | Going heavy (microservices + Saga + CQRS) only when forces demand it |
| [design-patterns-payment](design-patterns-payment.md) | design-patterns · greenfield | The GoF pattern *and* its lighter Pythonic form |

## `test-patterns`

| Example | Mode | Shows |
|---------|------|-------|
| [invoicing-service](test-patterns/invoicing-service.md) | greenfield | Money in the path, and still no browser suite — evidence placed where the failures are |
| [legacy-e2e-heavy-suite](test-patterns/legacy-e2e-heavy-suite.md) | review | *Relocating* evidence rather than deleting tests; one move, measured |
| [data-pipeline](test-patterns/data-pipeline.md) | greenfield | Four concerns kept apart: code tests, contracts, data quality, monitoring |
| [rag-agent](test-patterns/rag-agent.md) | review | Deterministic scaffolding vs. stochastic evaluation, and an uncalibrated judge |
| [thin-llm-service](test-patterns/thin-llm-service.md) | greenfield | Declining the pyramid, the QA phase, the E2E suite, and the LLM judge |

Each shows the scenario, the prompt, what was observed in the repository, the composed evidence
portfolio, what was deliberately omitted, the reopening signals, and the artifact produced.

Greenfield runs also write an ADR to `docs/adr/NNNN-*.md`; refactoring runs write a review report.
A run asked to "review only" writes nothing and says where the artifact would have gone.
