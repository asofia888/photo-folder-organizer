# Tests

Vitest + React Testing Library, jsdom environment. Setup and browser-API
mocks live in `setup.ts`; shared helpers (custom `render` with the language
provider, mock files and directory entries, `mockWorkerResponse`) in
`test-utils.tsx`.

```
src/test/
├── build/
│   ├── securityHeaders.test.ts       # CSP & co. in vercel.json stay strict
│   └── staticAssets.test.ts          # files the app fetches at runtime exist in public/
├── components/
│   ├── ErrorNotification.test.tsx    # toasts and their container
│   └── Thumbnail.test.tsx            # lazy loading, source fallback (RAW/HEIC), a11y
├── fixtures/exifJpeg.ts              # synthetic JPEG with real EXIF + thumbnail
├── hooks/useFolderProcessor.test.ts  # scanning, worker lifecycle, cancel, errors
├── integration/exifr.test.ts         # the real exifr API the worker relies on
└── utils/
    ├── dateUtils.test.ts             # local-date formatting, folder date choice
    ├── errorHandler.test.ts
    ├── fileSystemUtils.test.ts       # "copy into organized folders" (in-memory FS)
    ├── folderNaming.test.ts          # final names, invalid/duplicate detection
    ├── nameDrafts.test.ts            # names restored after reload
    ├── renameScript.test.ts          # runs the generated sh script for real
    └── typeGuards.test.ts
```

Prefer tests that exercise real behavior over mocks: the rename script test
executes the generated script against real folders, the exifr test runs the
real library, and the organize tests use an in-memory file system that follows
the File System Access API's error names.

## Running

```bash
npm run test:run                                  # whole suite, once
npx vitest run src/test/utils/renameScript.test.ts  # a single file
npm run test:coverage
```
