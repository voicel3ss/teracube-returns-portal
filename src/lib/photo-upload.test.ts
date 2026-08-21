import { describe, expect, it } from "vitest";
import { decodePhotoUploads, PhotoUploadError } from "./photo-upload";

describe("photo upload decoding", () => {
  it("decodes a valid photo before database or provider work starts", () => {
    const [photo] = decodePhotoUploads([{ name: "device.png", type: "image/png", data: Buffer.from("image bytes").toString("base64") }]);
    expect(photo.filename).toBe("device.png");
    expect(photo.data.toString()).toBe("image bytes");
  });

  it("returns a controlled validation error for malformed uploads", () => {
    expect(() => decodePhotoUploads([{ name: "broken.png", type: "image/png", data: "not base64!" }])).toThrow(PhotoUploadError);
  });

  it("rejects decoded photos larger than five megabytes", () => {
    const data = Buffer.alloc(5_000_001).toString("base64");
    expect(() => decodePhotoUploads([{ name: "large.jpg", type: "image/jpeg", data }])).toThrow("5 MB or smaller");
  });
});
