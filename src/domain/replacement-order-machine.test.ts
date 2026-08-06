import { describe, expect, it } from "vitest";
import {
  applyReplacementEvent,
  canClose,
  initialReplacementProgress,
  InvalidReplacementTransitionError,
} from "./replacement-order-machine";

function reviewed(flow: "advance" | "regular") {
  let progress = initialReplacementProgress(flow);
  progress = applyReplacementEvent(progress, { type: "PAYMENT_CAPTURED" });
  progress = applyReplacementEvent(progress, { type: "VERIFICATION_QUEUED" });
  return applyReplacementEvent(progress, { type: "CLAIM_REVIEWED" });
}

describe("replacement order state machine", () => {
  it("enforces ship-first sequencing for advance replacement", () => {
    let progress = reviewed("advance");
    expect(() => applyReplacementEvent(progress, { type: "RETURN_TRACKING_STARTED" })).toThrow(
      InvalidReplacementTransitionError,
    );
    progress = applyReplacementEvent(progress, { type: "REFURB_DISPATCHED" });
    progress = applyReplacementEvent(progress, { type: "REFURB_DELIVERED" });
    progress = applyReplacementEvent(progress, { type: "RETURN_TRACKING_STARTED" });
    progress = applyReplacementEvent(progress, { type: "RETURN_RECEIVED" });
    expect(canClose(progress)).toBe(true);
    expect(applyReplacementEvent(progress, { type: "CLOSE" }).status).toBe("closed");
  });

  it("allows regular replacement legs to finish in either order after return tracking begins", () => {
    let progress = reviewed("regular");
    progress = applyReplacementEvent(progress, { type: "RETURN_TRACKING_STARTED" });
    progress = applyReplacementEvent(progress, { type: "RETURN_RECEIVED" });
    progress = applyReplacementEvent(progress, { type: "REFURB_DISPATCHED" });
    progress = applyReplacementEvent(progress, { type: "REFURB_DELIVERED" });
    expect(applyReplacementEvent(progress, { type: "CLOSE" }).status).toBe("closed");
  });

  it("never dispatches a refurb before claim verification", () => {
    let progress = initialReplacementProgress("advance");
    progress = applyReplacementEvent(progress, { type: "PAYMENT_CAPTURED" });
    progress = applyReplacementEvent(progress, { type: "VERIFICATION_QUEUED" });
    expect(() => applyReplacementEvent(progress, { type: "REFURB_DISPATCHED" })).toThrow(
      InvalidReplacementTransitionError,
    );
  });
});
