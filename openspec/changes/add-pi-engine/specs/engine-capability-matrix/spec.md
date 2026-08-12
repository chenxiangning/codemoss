## MODIFIED Requirements

### Requirement: Matrix includes PI engine

The capability matrix fixture and generated projections MUST include a `pi` engine row covering all capability keys.

#### Scenario: PI streaming and tools

- **WHEN** capability lookup is performed for engine `pi`
- **THEN** streaming.text, streaming.reasoning, tool.use, session.resume, and reasoning.effort resolve to supported (or documented states in the fixture)
