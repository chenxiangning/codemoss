//! OMP-owned ACK, terminal and recovery state machine.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpTurnState {
    Accepted,
    Queued,
    Streaming,
    ToolCall,
    AwaitingApproval,
    CancelRequested,
    Completed,
    Cancelled,
    RecoverableError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OmpTerminalReason {
    Completed,
    Cancelled,
    Disconnected,
    MalformedFrame,
    TimedOut,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OmpSettlement {
    pub state: OmpTurnState,
    pub terminal_reason: Option<OmpTerminalReason>,
}

impl Default for OmpSettlement {
    fn default() -> Self {
        Self {
            state: OmpTurnState::Accepted,
            terminal_reason: None,
        }
    }
}

impl OmpSettlement {
    pub fn apply_ack(&mut self) {
        if self.state == OmpTurnState::Accepted {
            self.state = OmpTurnState::Queued;
        }
    }

    pub fn apply_stream(&mut self) {
        match self.state {
            OmpTurnState::Queued | OmpTurnState::Streaming => self.state = OmpTurnState::Streaming,
            _ if !self.is_terminal() => {
                self.state = OmpTurnState::RecoverableError;
                self.terminal_reason = Some(OmpTerminalReason::MalformedFrame);
            }
            _ => {}
        }
    }

    pub fn apply_tool_call(&mut self) {
        match self.state {
            OmpTurnState::Streaming | OmpTurnState::ToolCall => self.state = OmpTurnState::ToolCall,
            _ if !self.is_terminal() => {
                self.state = OmpTurnState::RecoverableError;
                self.terminal_reason = Some(OmpTerminalReason::MalformedFrame);
            }
            _ => {}
        }
    }

    pub fn apply_approval_request(&mut self) {
        match self.state {
            OmpTurnState::ToolCall => self.state = OmpTurnState::AwaitingApproval,
            _ if !self.is_terminal() => {
                self.state = OmpTurnState::RecoverableError;
                self.terminal_reason = Some(OmpTerminalReason::MalformedFrame);
            }
            _ => {}
        }
    }

    pub fn request_cancel(&mut self) {
        if !self.is_terminal() {
            self.state = OmpTurnState::CancelRequested;
        }
    }

    pub fn settle(&mut self, reason: OmpTerminalReason) -> bool {
        if self.is_terminal() {
            return false;
        }
        let valid = match reason {
            OmpTerminalReason::Completed => {
                matches!(self.state, OmpTurnState::Streaming | OmpTurnState::ToolCall)
            }
            OmpTerminalReason::Cancelled => self.state == OmpTurnState::CancelRequested,
            OmpTerminalReason::Disconnected
            | OmpTerminalReason::MalformedFrame
            | OmpTerminalReason::TimedOut => true,
        };
        if !valid {
            self.state = OmpTurnState::RecoverableError;
            self.terminal_reason = Some(OmpTerminalReason::MalformedFrame);
            return false;
        }
        self.terminal_reason = Some(reason);
        self.state = match reason {
            OmpTerminalReason::Completed => OmpTurnState::Completed,
            OmpTerminalReason::Cancelled => OmpTurnState::Cancelled,
            OmpTerminalReason::Disconnected
            | OmpTerminalReason::MalformedFrame
            | OmpTerminalReason::TimedOut => OmpTurnState::RecoverableError,
        };
        true
    }

    pub fn is_terminal(&self) -> bool {
        matches!(
            self.state,
            OmpTurnState::Completed | OmpTurnState::Cancelled | OmpTurnState::RecoverableError
        )
    }
}

#[cfg(test)]
mod tests {
    use super::{OmpSettlement, OmpTerminalReason, OmpTurnState};

    #[test]
    fn tracks_ack_stream_tool_and_typed_terminal_evidence() {
        let mut settlement = OmpSettlement::default();
        settlement.apply_ack();
        settlement.apply_stream();
        settlement.apply_tool_call();
        assert_eq!(settlement.state, OmpTurnState::ToolCall);
        assert!(settlement.settle(OmpTerminalReason::Completed));
        assert_eq!(settlement.state, OmpTurnState::Completed);
        assert!(!settlement.settle(OmpTerminalReason::Disconnected));
    }

    #[test]
    fn rejects_out_of_order_stream_approval_and_successful_settlement() {
        let mut settlement = OmpSettlement::default();
        settlement.apply_stream();
        assert_eq!(settlement.state, OmpTurnState::RecoverableError);

        let mut approval = OmpSettlement::default();
        approval.apply_ack();
        approval.apply_stream();
        approval.apply_approval_request();
        assert_eq!(approval.state, OmpTurnState::RecoverableError);

        let mut cancelling = OmpSettlement::default();
        cancelling.apply_ack();
        cancelling.apply_stream();
        cancelling.request_cancel();
        assert!(!cancelling.settle(OmpTerminalReason::Completed));
        assert_eq!(cancelling.state, OmpTurnState::RecoverableError);
    }

    #[test]
    fn process_exit_without_terminal_becomes_recoverable_error() {
        let mut settlement = OmpSettlement::default();
        settlement.apply_ack();
        settlement.apply_stream();
        assert!(settlement.settle(OmpTerminalReason::Disconnected));
        assert_eq!(settlement.state, OmpTurnState::RecoverableError);
        assert!(!settlement.settle(OmpTerminalReason::TimedOut));
    }

    #[test]
    fn cancellation_is_idempotent_and_cannot_be_resurrected() {
        let mut settlement = OmpSettlement::default();
        settlement.apply_ack();
        settlement.apply_stream();
        settlement.request_cancel();
        assert_eq!(settlement.state, OmpTurnState::CancelRequested);
        assert!(settlement.settle(OmpTerminalReason::Cancelled));
        settlement.apply_stream();
        assert_eq!(settlement.state, OmpTurnState::Cancelled);
    }
}
