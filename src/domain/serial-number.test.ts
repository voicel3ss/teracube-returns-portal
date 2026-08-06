import { describe, expect, it } from "vitest";
import type { DeviceModel } from "./model";
import { parseTeracubeSerial } from "./serial-number";

const models: DeviceModel[] = [
  { id: "model-2e", code: "T2E", name: "Teracube 2e", deviceType: "phone" },
  { id: "model-watch", code: "TW1", name: "Teracube Watch", deviceType: "watch" },
];

describe("parseTeracubeSerial", () => {
  it("parses phone serials and derives manufacturing data", () => {
    expect(parseTeracubeSerial("202112T2E235968", models)).toEqual({
      ok: true,
      value: {
        serial: "202112T2E235968",
        manufacturedYear: 2021,
        manufacturedMonth: 12,
        modelCode: "T2E",
        uniqueNumber: "235968",
        deviceType: "phone",
        modelId: "model-2e",
      },
    });
  });

  it("uses the same format for watches and infers type from model code", () => {
    const result = parseTeracubeSerial("202603TW1000042", models);
    expect(result.ok && result.value.deviceType).toBe("watch");
  });

  it("rejects invalid dates and unknown model codes", () => {
    expect(parseTeracubeSerial("202613T2E235968", models)).toEqual({ ok: false, reason: "invalid_format" });
    expect(parseTeracubeSerial("202112ZZZ235968", models)).toEqual({ ok: false, reason: "unknown_model_code" });
  });
});
