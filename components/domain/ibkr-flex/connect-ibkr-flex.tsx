"use client";
import { IbkrFlexConnected } from "./ibkr-flex-connected";
import { IbkrFlexQueryIdStep, IbkrFlexTokenStep } from "./ibkr-flex-credential-steps";
import { IbkrFlexQueryStep } from "./ibkr-flex-query-step";
import { IbkrFlexStepIndicator, IbkrFlexTrustTags } from "./ibkr-flex-step-parts";
import { useIbkrFlexConnectFlow, type IbkrFlexStep } from "./use-ibkr-flex-connect";

/** Address of the Interactive Brokers connection page (status, sync, reconnect, disconnect). */
export const IBKR_FLEX_PAGE_HREF = "/connections/interactive-brokers";

export interface ConnectIbkrFlexProps {
  /** Called by «Fatto» once connected (the dialog closes); without it a link to the connection page is shown. */
  onDone?: () => void;
  /** Called as soon as the connection is saved, in place of the success screen (a reconnect closes its panel). */
  onConnected?: () => void;
  /** Where to start: a reconnect already has its query and starts at the Query ID. */
  initialStep?: IbkrFlexStep;
  /** Label of the final button: «Collega» for a new account, «Ricollega» when replacing a token. */
  submitLabel?: string;
}

/**
 * Connect Interactive Brokers in three steps, as Trade Republic connects in «Nuovo conto»: create the Flex Query,
 * copy its Query ID, generate the token. Each value is asked where IBKR shows it; then «collegato» with the history
 * import's progress. Read-only, never IBKR's username or password.
 */
export function ConnectIbkrFlex({ onDone, onConnected, initialStep = 0, submitLabel }: ConnectIbkrFlexProps) {
  const flow = useIbkrFlexConnectFlow(initialStep, onConnected);
  if (flow.connected) return onConnected ? null : <IbkrFlexConnected jobId={flow.jobId} pageHref={IBKR_FLEX_PAGE_HREF} onDone={onDone} />;
  return (
    <div className="flex flex-col gap-5">
      <IbkrFlexTrustTags />
      <IbkrFlexStepIndicator current={flow.step} />
      {flow.step === 0 ? <IbkrFlexQueryStep onNext={() => flow.goTo(1)} /> : null}
      {flow.step === 1 ? <IbkrFlexQueryIdStep flow={flow} canGoBack={initialStep === 0} /> : null}
      {flow.step === 2 ? <IbkrFlexTokenStep flow={flow} submitLabel={submitLabel} /> : null}
    </div>
  );
}
