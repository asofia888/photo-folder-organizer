// Builds a minimal JPEG containing a real EXIF segment (DateTimeOriginal and
// an embedded thumbnail) entirely in memory, so tests can exercise the actual
// exifr APIs the worker uses instead of mocks.
//
// Byte layout: SOI + APP1("Exif\0\0" + TIFF) + EOI. The TIFF block is
// little-endian with IFD0 -> ExifIFD (DateTimeOriginal) and IFD0's next-IFD
// pointer -> IFD1 (thumbnail offset/length tags followed by the bytes).

export const EXIF_FIXTURE_THUMBNAIL = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x01, 0x02, 0x03, 0x04, 0xff, 0xd9,
]);

export function buildExifJpeg(dateTimeOriginal: string): Uint8Array {
  const dateStr = `${dateTimeOriginal}\0`; // EXIF ASCII, NUL-terminated
  if (dateStr.length !== 20) {
    throw new Error('dateTimeOriginal must be "YYYY:MM:DD HH:MM:SS" (19 chars)');
  }

  const IFD0_OFFSET = 8;
  const EXIF_IFD_OFFSET = IFD0_OFFSET + 2 + 12 + 4; // 26
  const DATE_STR_OFFSET = EXIF_IFD_OFFSET + 2 + 12 + 4; // 44
  const IFD1_OFFSET = DATE_STR_OFFSET + 20; // 64
  const THUMB_OFFSET = IFD1_OFFSET + 2 + 24 + 4; // 94

  const tiff = new Uint8Array(THUMB_OFFSET + EXIF_FIXTURE_THUMBNAIL.length);
  const view = new DataView(tiff.buffer);
  const writeEntry = (offset: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
  };

  // TIFF header: "II" (little-endian), magic 42, offset of IFD0
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, IFD0_OFFSET, true);

  // IFD0: one entry (ExifIFD pointer 0x8769), next-IFD pointer -> IFD1
  view.setUint16(IFD0_OFFSET, 1, true);
  writeEntry(IFD0_OFFSET + 2, 0x8769, 4 /* LONG */, 1, EXIF_IFD_OFFSET);
  view.setUint32(IFD0_OFFSET + 2 + 12, IFD1_OFFSET, true);

  // ExifIFD: one entry (DateTimeOriginal 0x9003, ASCII, 20 bytes)
  view.setUint16(EXIF_IFD_OFFSET, 1, true);
  writeEntry(EXIF_IFD_OFFSET + 2, 0x9003, 2 /* ASCII */, 20, DATE_STR_OFFSET);
  view.setUint32(EXIF_IFD_OFFSET + 2 + 12, 0, true);

  for (let i = 0; i < 20; i++) {
    tiff[DATE_STR_OFFSET + i] = dateStr.charCodeAt(i);
  }

  // IFD1: thumbnail location (0x0201 JPEGInterchangeFormat) and length (0x0202)
  view.setUint16(IFD1_OFFSET, 2, true);
  writeEntry(IFD1_OFFSET + 2, 0x0201, 4, 1, THUMB_OFFSET);
  writeEntry(IFD1_OFFSET + 2 + 12, 0x0202, 4, 1, EXIF_FIXTURE_THUMBNAIL.length);
  view.setUint32(IFD1_OFFSET + 2 + 24, 0, true);

  tiff.set(EXIF_FIXTURE_THUMBNAIL, THUMB_OFFSET);

  // Wrap the TIFF block in a JPEG container: SOI + APP1 + EOI
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const app1Length = 2 + exifHeader.length + tiff.length;
  const jpeg = new Uint8Array(2 + 2 + app1Length + 2);
  let p = 0;
  jpeg[p++] = 0xff;
  jpeg[p++] = 0xd8; // SOI
  jpeg[p++] = 0xff;
  jpeg[p++] = 0xe1; // APP1 marker
  jpeg[p++] = (app1Length >> 8) & 0xff; // APP1 length (big-endian)
  jpeg[p++] = app1Length & 0xff;
  for (const b of exifHeader) jpeg[p++] = b;
  jpeg.set(tiff, p);
  p += tiff.length;
  jpeg[p] = 0xff;
  jpeg[p + 1] = 0xd9; // EOI
  return jpeg;
}
