import { mapStatus, COLLECTED_STATUSES } from "../src/normalize/statusMap";

describe("status allow-list", () => {
  it("maps known statuses to their canonical value", () => {
    expect(mapStatus("stripe", "succeeded")).toBe("collected");
    expect(mapStatus("stripe", "refunded")).toBe("refunded");
    expect(mapStatus("generic_invoicing", "paid")).toBe("collected");
  });

  it("is case/whitespace tolerant", () => {
    expect(mapStatus("stripe", "  Succeeded  ")).toBe("collected");
  });

  it("maps ANY unrecognized status to 'unknown', never 'collected'", () => {
    const surprises = [
      "chargeback_pending",
      "disputed",
      "requires_action",
      "totally_new_status_from_a_future_api_version",
      "",
      "SUCCEEDED_2",
    ];
    for (const s of surprises) {
      const result = mapStatus("stripe", s);
      expect(result).not.toBe("collected");
      expect(result).toBe("unknown");
    }
  });

  it("does the same for a source that has never been seen before", () => {
    expect(mapStatus("some_brand_new_payment_provider", "paid")).toBe("unknown");
  });

  it("COLLECTED_STATUSES is a strict allow-list, not derived from exclusion", () => {
    // Guards against someone "simplifying" this later into
    // `all_statuses.filter(s => !EXCLUDED.includes(s))`, which would let
    // any new status default to true.
    expect(COLLECTED_STATUSES).toEqual(["collected"]);
  });
});
