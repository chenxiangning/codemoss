import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  RequestUserInputRequest,
  RequestUserInputResponse,
} from "../../../types";
import { requestUserInputIdentityKey } from "../../../utils/requestUserInputIdentity";
import {
  getUserInputOptionKey,
  getUserInputOptionValue,
  getUserInputQuestionKey,
  USER_INPUT_OTHER_OPTION_MARKER,
  UserInputQuestionCard,
  type UserInputNotesState,
  type UserInputSecretVisibilityState,
  type UserInputSelectionState,
} from "./UserInputQuestionCard";
import {
  buildRecommendedDefaultAnswers,
  hasRecommendedDefaultAnswers,
  USER_INPUT_TIMEOUT_SECONDS,
  USER_INPUT_TIMEOUT_WARNING_SECONDS,
} from "./userInputTimeout";

const MAX_CUSTOM_INPUT_LENGTH = 2000;
const TIMEOUT_SECONDS = USER_INPUT_TIMEOUT_SECONDS;
const WARNING_THRESHOLD_SECONDS = USER_INPUT_TIMEOUT_WARNING_SECONDS;

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type AskUserQuestionDialogProps = {
  requests: RequestUserInputRequest[];
  activeThreadId: string | null;
  activeWorkspaceId?: string | null;
  activeEngine?: string | null;
  onSubmit: (
    request: RequestUserInputRequest,
    response: RequestUserInputResponse,
  ) => Promise<void> | void;
};

export function AskUserQuestionDialog({
  requests,
  activeThreadId,
  activeWorkspaceId,
  activeEngine,
  onSubmit,
}: AskUserQuestionDialogProps) {
  const { t } = useTranslation();

  const activeRequests = useMemo(
    () =>
      requests.filter((req) => {
        if (!activeThreadId) return false;
        const requestThreadId = (req.params.thread_id ?? "").trim();
        if (requestThreadId && requestThreadId !== activeThreadId) return false;
        if (activeWorkspaceId && req.workspace_id !== activeWorkspaceId) return false;
        return true;
      }),
    [requests, activeThreadId, activeWorkspaceId],
  );

  const [selections, setSelections] = useState<UserInputSelectionState>({});
  const [customInputs, setCustomInputs] = useState<UserInputNotesState>({});
  const [secretVisible, setSecretVisible] = useState<UserInputSecretVisibilityState>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(TIMEOUT_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [locallySettledRequestKeys, setLocallySettledRequestKeys] = useState<
    Set<string>
  >(() => new Set());

  const customInputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRequestIdRef = useRef<string | null>(null);
  const timeoutSettledRequestKeysRef = useRef<Set<string>>(new Set());

  const isTimeWarning = remainingSeconds <= WARNING_THRESHOLD_SECONDS && remainingSeconds > 0;
  const isTimedOut = remainingSeconds <= 0;

  const visibleActiveRequests = useMemo(
    () =>
      activeRequests.filter(
        (req) => !locallySettledRequestKeys.has(requestUserInputIdentityKey(req)),
      ),
    [activeRequests, locallySettledRequestKeys],
  );
  const visibleActiveRequest = visibleActiveRequests[0] ?? null;
  const visibleRequestId = visibleActiveRequest
    ? requestUserInputIdentityKey(visibleActiveRequest)
    : null;

  // Drop local settlement marks once parent queue no longer carries the request.
  useEffect(() => {
    setLocallySettledRequestKeys((current) => {
      if (current.size === 0) {
        return current;
      }
      const liveKeys = new Set(requests.map(requestUserInputIdentityKey));
      let changed = false;
      const next = new Set<string>();
      current.forEach((key) => {
        if (liveKeys.has(key)) {
          next.add(key);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [requests]);

  // Reset when a new request arrives
  useEffect(() => {
    if (visibleRequestId && visibleRequestId !== prevRequestIdRef.current) {
      prevRequestIdRef.current = visibleRequestId;
      setQuestionIndex(0);
      setRemainingSeconds(TIMEOUT_SECONDS);
      setIsSubmitting(false);
      setSubmitError(null);

      if (visibleActiveRequest) {
        const nextSelections: UserInputSelectionState = {};
        const nextCustom: UserInputNotesState = {};
        const nextSecret: UserInputSecretVisibilityState = {};
        visibleActiveRequest.params.questions.forEach((q, i) => {
          const key = getUserInputQuestionKey(q, i);
          nextSelections[key] = new Set();
          nextCustom[key] = "";
          nextSecret[key] = false;
        });
        setSelections(nextSelections);
        setCustomInputs(nextCustom);
        setSecretVisible(nextSecret);
      }
    }
  }, [visibleRequestId, visibleActiveRequest]);

  // Countdown timer
  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    if (!visibleActiveRequest || !visibleRequestId) {
      clearTimer();
      return;
    }
    clearTimer();
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearTimer;
  }, [visibleRequestId, visibleActiveRequest]);

  const markRequestSettledLocally = useCallback((key: string) => {
    setLocallySettledRequestKeys((current) => {
      if (current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  const handleCancel = useCallback(() => {
    if (!visibleActiveRequest || !visibleRequestId) return;
    // Skip must unblock the agent the same way as submit: empty answers +
    // explicit skippedQuestionIds so MCP oneshot / resume always receives a result.
    const skippedQuestionIds = visibleActiveRequest.params.questions
      .map((question) => question.id)
      .filter((questionId) => questionId.trim().length > 0);
    void Promise.resolve(
      onSubmit(visibleActiveRequest, {
        answers: {},
        ...(skippedQuestionIds.length > 0 ? { skippedQuestionIds } : {}),
      }),
    ).then(
      () => {
        markRequestSettledLocally(visibleRequestId);
      },
    );
  }, [
    markRequestSettledLocally,
    onSubmit,
    visibleActiveRequest,
    visibleRequestId,
  ]);

  // Auto-submit recommended (first) option on timeout
  useEffect(() => {
    if (
      !isTimedOut ||
      !visibleActiveRequest ||
      !visibleRequestId ||
      isSubmitting ||
      timeoutSettledRequestKeysRef.current.has(visibleRequestId)
    ) {
      return;
    }
    timeoutSettledRequestKeysRef.current.add(visibleRequestId);
    const recommended = buildRecommendedDefaultAnswers(
      visibleActiveRequest.params.questions,
    );
    const response: RequestUserInputResponse = hasRecommendedDefaultAnswers(
      recommended,
    )
      ? { answers: recommended }
      : { answers: {} };
    void Promise.resolve(onSubmit(visibleActiveRequest, response))
      .then(() => {
        markRequestSettledLocally(visibleRequestId);
        timeoutSettledRequestKeysRef.current.delete(visibleRequestId);
      })
      .catch(() => {
        timeoutSettledRequestKeysRef.current.delete(visibleRequestId);
        setSubmitError(t("approval.submitFailed"));
      });
  }, [
    isSubmitting,
    isTimedOut,
    markRequestSettledLocally,
    onSubmit,
    t,
    visibleActiveRequest,
    visibleRequestId,
  ]);

  // ESC key
  useEffect(() => {
    if (!visibleActiveRequest) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visibleActiveRequest, handleCancel]);

  if (!visibleActiveRequest) return null;

  const { questions } = visibleActiveRequest.params;
  if (!questions.length) return null;

  const safeIndex = Math.max(0, Math.min(questionIndex, questions.length - 1));
  const currentQ = questions[safeIndex];
  if (!currentQ) return null;

  const qKey = getUserInputQuestionKey(currentQ, safeIndex);
  const options = currentQ.options ?? [];
  const hasOptions = options.length > 0;
  const isLastQuestion = safeIndex === questions.length - 1;
  const currentSelections = selections[qKey] ?? new Set();
  const currentCustom = customInputs[qKey] ?? "";
  const isOtherSelected = currentSelections.has(USER_INPUT_OTHER_OPTION_MARKER);
  const isPlanBlockerQuestion = currentQ.id === "plan_blocker_resolution";
  const isCodexEngine = (activeEngine ?? "").trim().toLowerCase() === "codex";
  const useComposerOverlayMode = isPlanBlockerQuestion && isCodexEngine;

  const hasRegularSelection = Array.from(currentSelections).some((l) => l !== USER_INPUT_OTHER_OPTION_MARKER);
  const hasValidCustom = isOtherSelected && currentCustom.trim().length > 0;
  const hasPlainText = !hasOptions && currentCustom.trim().length > 0;
  const canProceed = hasRegularSelection || hasValidCustom || hasPlainText || currentQ.isSecret;

  const handleOptionToggle = (
    questionId: string,
    optionKey: string,
    multiSelect: boolean,
  ) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[questionId] ?? []);
      if (multiSelect) {
        if (set.has(optionKey)) set.delete(optionKey);
        else set.add(optionKey);
      } else if (set.size === 1 && set.has(optionKey)) {
        set.clear();
      } else {
        set.clear();
        set.add(optionKey);
      }
      next[questionId] = set;
      return next;
    });
    if (optionKey === USER_INPUT_OTHER_OPTION_MARKER) {
      setTimeout(() => customInputRef.current?.focus(), 0);
    }
  };

  const handleCustomChange = (questionId: string, value: string) => {
    setCustomInputs((prev) => ({
      ...prev,
      [questionId]: value.slice(0, MAX_CUSTOM_INPUT_LENGTH),
    }));
  };

  const handleToggleSecret = (questionId: string) => {
    setSecretVisible((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const buildAnswers = (): RequestUserInputResponse["answers"] => {
    const answers: RequestUserInputResponse["answers"] = {};
    questions.forEach((q, i) => {
      if (!q.id) return;
      const key = getUserInputQuestionKey(q, i);
      const answerList: string[] = [];
      const selected = selections[key] ?? new Set();
      const qOptions = q.options ?? [];
      const qHasOptions = qOptions.length > 0;

      // Regular selected options
      qOptions.forEach((option, optionIndex) => {
        if (!selected.has(getUserInputOptionKey(optionIndex))) {
          return;
        }
        answerList.push(getUserInputOptionValue(option, optionIndex));
      });

      // "Other" custom text
      if (selected.has(USER_INPUT_OTHER_OPTION_MARKER)) {
        const custom = (customInputs[key] ?? "").trim();
        if (custom) answerList.push(custom);
      }

      // Plain text (no options)
      const note = (customInputs[key] ?? "").trim();
      if (!qHasOptions && note) {
        answerList.push(note);
      } else if (qHasOptions && note && !selected.has(USER_INPUT_OTHER_OPTION_MARKER)) {
        answerList.push(`user_note: ${note}`);
      }

      answers[q.id] = { answers: answerList };
    });
    return answers;
  };

  const handleNext = () => {
    if (isLastQuestion) {
      void handleSubmitFinal();
    } else {
      setQuestionIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (safeIndex > 0) setQuestionIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSubmitFinal = async () => {
    if (!visibleActiveRequest || !visibleRequestId) {
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(visibleActiveRequest, { answers: buildAnswers() });
      // Hide immediately even if parent queue lag leaves the request briefly.
      markRequestSettledLocally(visibleRequestId);
    } catch {
      setSubmitError(t("approval.submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRequests = visibleActiveRequests.length;

  return (
    <div
      className={[
        "ask-user-question-overlay",
        useComposerOverlayMode && "is-composer-overlay",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {!useComposerOverlayMode && (
        <div className="ask-user-question-backdrop" onClick={handleCancel} />
      )}
      <UserInputQuestionCard
        flavor="ask"
        role="dialog"
        className={[
          isTimeWarning && "is-time-warning",
          useComposerOverlayMode && "is-composer-overlay",
        ]
          .filter(Boolean)
          .join(" ")}
        title={t("askUserQuestion.title")}
        queueLabel={
          totalRequests > 1
            ? t("approval.requestOf", { current: 1, total: totalRequests })
            : null
        }
        questions={questions}
        activeQuestionIndex={safeIndex}
        remainingSecondsLabel={formatCountdown(remainingSeconds)}
        isTimeWarning={isTimeWarning}
        selections={selections}
        notes={customInputs}
        secretVisible={secretVisible}
        submitError={submitError}
        isSubmitting={isSubmitting}
        includeOtherOption={true}
        canProceed={canProceed}
        showStepActions={true}
        customInputRef={customInputRef}
        onQuestionTabChange={setQuestionIndex}
        onOptionToggle={handleOptionToggle}
        onNotesChange={handleCustomChange}
        onToggleSecret={handleToggleSecret}
        onBack={handleBack}
        onNext={handleNext}
        onDismiss={handleCancel}
        onSubmit={() => void handleSubmitFinal()}
      />
    </div>
  );
}
