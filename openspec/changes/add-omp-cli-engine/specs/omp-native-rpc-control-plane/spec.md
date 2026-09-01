## ADDED Requirements

### Requirement: OMP Native RPC MUST Negotiate Before Requests

The system MUST consume the OMP RPC ready frame and negotiate a supported protocol version before issuing requests.

#### Scenario: Ready frame is valid
- **WHEN** OMP emits a ready frame with supported protocol versions and frame limits
- **THEN** the client MUST record the negotiated version and limits
- **AND** MUST reject unsupported versions before sending business requests

#### Scenario: Ready frame is missing or invalid
- **WHEN** the process emits no valid ready frame within the startup boundary
- **THEN** the runtime MUST fail the OMP startup explicitly
- **AND** MUST NOT mark the session ready

### Requirement: RPC Responses MUST Correlate With Requests

Every OMP RPC request MUST have a unique correlation id; responses and errors MUST resolve only the matching pending request.

#### Scenario: Response arrives out of order
- **WHEN** responses for multiple requests arrive in a different order
- **THEN** each response MUST resolve its own request
- **AND** no response may settle another turn

### Requirement: RPC Control Events MUST Stay Outside Conversation Timeline

Command discovery, extension UI, job control, memory, security and admin events MUST enter their feature-local control stores and MUST NOT be rendered as assistant text.

#### Scenario: Extension UI request arrives
- **WHEN** OMP emits an extension UI request
- **THEN** the control-plane adapter MUST publish a typed UI request
- **AND** the Conversation timeline MUST remain unchanged
