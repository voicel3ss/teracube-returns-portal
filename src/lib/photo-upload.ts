export type EncodedPhoto = { name: string; type: "image/jpeg" | "image/png" | "image/webp"; data: string };

export class PhotoUploadError extends Error {}

export function decodePhotoUploads(photos: EncodedPhoto[]) {
  return photos.map((photo) => {
    const encoded = photo.data.trim();
    if (encoded.length > Math.ceil(5_000_000 / 3) * 4) throw new PhotoUploadError("Each photo must be 5 MB or smaller.");
    if (!encoded || encoded.length % 4 !== 0) {
      throw new PhotoUploadError(`${photo.name} is not a valid image upload.`);
    }
    const data = Buffer.from(encoded, "base64");
    if (data.byteLength > 5_000_000) throw new PhotoUploadError("Each photo must be 5 MB or smaller.");
    if (data.toString("base64") !== encoded) throw new PhotoUploadError(`${photo.name} is not a valid image upload.`);
    return { filename: photo.name, contentType: photo.type, byteSize: data.byteLength, data };
  });
}
