import type { DeviceModel, DeviceType } from "./model";

const TERACUBE_SERIAL_PATTERN = /^(20\d{2})(0[1-9]|1[0-2])([A-Z0-9]{3})(\d{6})$/;

export type ParsedSerial = {
  serial: string;
  manufacturedYear: number;
  manufacturedMonth: number;
  modelCode: string;
  uniqueNumber: string;
  deviceType: DeviceType;
  modelId: string;
};

export type SerialParseResult =
  | { ok: true; value: ParsedSerial }
  | { ok: false; reason: "invalid_format" | "unknown_model_code" };

export function parseTeracubeSerial(serial: string, models: readonly DeviceModel[]): SerialParseResult {
  const normalized = serial.trim().toUpperCase();
  const match = TERACUBE_SERIAL_PATTERN.exec(normalized);

  if (!match) {
    return { ok: false, reason: "invalid_format" };
  }

  const [, year, month, modelCode, uniqueNumber] = match;
  const model = models.find((candidate) => candidate.code.toUpperCase() === modelCode);

  if (!model) {
    return { ok: false, reason: "unknown_model_code" };
  }

  return {
    ok: true,
    value: {
      serial: normalized,
      manufacturedYear: Number(year),
      manufacturedMonth: Number(month),
      modelCode,
      uniqueNumber,
      deviceType: model.deviceType,
      modelId: model.id,
    },
  };
}
