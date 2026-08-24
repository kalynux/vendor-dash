/**
 * Getting a file out of the app and onto the device (CAPACITOR-PLAN.md → P4.6).
 *
 * ⚠ **`<a download>` is inert in a Capacitor WebView** — and it is *also* inert
 * in a browser for a cross-origin URL, which every file in this app is: the
 * bundle is served from `vendor.wi-mall.com` (or `vendor.wi-mall.internal`) and
 * the files come from the API host. So a "Download" affordance built the obvious
 * way opens a tab on the web and does nothing at all on a device. That is the
 * gap this module closes, on both platforms.
 *
 * ── Why cache-then-share, and not a Downloads folder ─────────────────────────
 *
 * The tempting shape is `Directory.Documents` / `Directory.External`. It is a
 * trap on Android: scoped storage (API 29+) makes a direct write to a public
 * collection unreliable from Capacitor, and on API ≤28 it needs
 * `WRITE_EXTERNAL_STORAGE` — a runtime prompt, for a file the vendor already
 * owns, that some devices refuse anyway. The result is a feature that works on
 * the test phone and fails on a slice of the fleet, with a permission dialog as
 * the consolation prize.
 *
 * So the bytes go to the app's own cache — no permission on any version, on
 * either platform — and the file is handed to the **system share sheet**, which
 * is where "Save to Files", "Save to Drive" and every send-to-an-app target
 * actually live. It is the platform's own answer to "put this somewhere", and it
 * does strictly more than a Downloads folder would: the vendor can send an
 * attachment straight to WhatsApp without a second step.
 *
 * The web keeps the mechanism it has always had — an object URL and a synthetic
 * `<a download>` click — which for a *blob* URL is same-origin, and therefore
 * actually honours the filename, unlike the cross-origin case above.
 */
import { Directory, Filesystem } from '@capacitor/filesystem';

import { isNative } from './env';
import { shareContent } from './share';

/**
 * Where native downloads are staged, under the app's cache directory.
 *
 * A dedicated folder so {@link pruneStagingDir} can clear it without touching
 * anything else Capacitor keeps in the cache — the camera's temporary captures
 * live there too, and deleting one mid-upload would be a hard bug to find.
 */
const STAGING_DIR = 'downloads';

export type SaveOutcome =
  /** The bytes reached the device — a browser download, or a share target. */
  | 'saved'
  /** The share sheet opened and was dismissed. A decision, not a failure. */
  | 'dismissed'
  | 'failed';

export interface SaveBlobInput {
  blob: Blob;
  /** Suggested name, with extension. Sanitised before it touches the disk. */
  fileName: string;
}

export interface DownloadFileInput {
  /** A fetchable URL. Public files only — see {@link fetchFileBlob}. */
  url: string;
  fileName: string;
}

/** Characters the mobile and desktop filesystems variously reject. */
const RESERVED_FILENAME_CHARS = /[<>:"|?*]/g;
/**
 * Drop the C0 control range, which is legal in a JS string and not in a
 * filename.
 *
 * A character-code filter rather than a regex: every regex form of this — a
 * literal, or one built from escapes — trips eslint no-control-regex, and that
 * rule is worth keeping on rather than suppressing here. DEL goes too, for the
 * same reason the rest do.
 */
function stripControlChars(value: string): string {
  return Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join('');
}

/**
 * Make a server-supplied name safe to write to disk.
 *
 * ⚠ This is not cosmetic. The name originates from whatever the uploader called
 * the file, it is echoed back by the API, and `Filesystem.writeFile` joins it
 * onto a directory path — so a name containing `../` writes outside the staging
 * directory, and one containing `/` fails on Android in a way that reads as "the
 * download is broken" rather than "the name was bad".
 *
 * Spaces and hyphens are deliberately **kept**: stripping them would turn
 * "Q3 invoice - final.pdf" into something the vendor cannot recognise in their
 * own file manager, which is a worse outcome than the one being prevented.
 */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = stripControlChars(base)
    .replace(RESERVED_FILENAME_CHARS, '')
    // A leading dot hides the file on both platforms, and `..` would climb out
    // of the staging directory.
    .replace(/^\.+/, '')
    .trim();

  // Cap the length: some filesystems reject names over 255 bytes, and one that
  // long is never meaningful anyway. The extension is preserved by trimming the
  // stem rather than the tail, so the file still opens in the right app.
  if (cleaned.length <= 120) return cleaned || 'download';
  const dot = cleaned.lastIndexOf('.');
  if (dot <= 0) return cleaned.slice(0, 120);
  const ext = cleaned.slice(dot);
  return cleaned.slice(0, 120 - ext.length) + ext;
}

/**
 * Blob → base64, without the `data:` prefix.
 *
 * ⚠ `Filesystem.writeFile` accepts a `Blob` **on web only**; a native write must
 * be given base64, which the bridge then decodes. That means the whole file
 * crosses the JS↔native boundary as a string about a third larger than the
 * bytes. Fine for the documents and images this app deals in, and the reason
 * this path would not suit a multi-gigabyte export if one ever existed.
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Clear anything staged by a previous save.
 *
 * Done *before* writing the next file rather than after sharing the current one:
 * the receiving app may still be reading through the content URI when the sheet
 * closes, and deleting the file out from under it hands someone a truncated
 * copy. By the next save that read is long finished.
 *
 * Best-effort by design — this is a cache the OS is free to clear anyway.
 */
async function pruneStagingDir(): Promise<void> {
  try {
    const { files } = await Filesystem.readdir({
      path: STAGING_DIR,
      directory: Directory.Cache,
    });
    await Promise.all(
      files.map((entry) =>
        Filesystem.deleteFile({
          path: `${STAGING_DIR}/${entry.name}`,
          directory: Directory.Cache,
        }).catch(() => {}),
      ),
    );
  } catch {
    // No staging directory yet — the first save creates it.
  }
}

/**
 * Fetch a file's bytes.
 *
 * ⚠ **For files the platform serves publicly**, which is every tree vendor-dash
 * touches: product media, avatars, logos, banners, and the general-intake
 * `documents/` or `images/` a ticket attachment actually lands in.
 *
 * ⚠ **No `credentials`, and no `Authorization` header either.** These trees are
 * unauthenticated, no-cookie content by the backend's own classification
 * (`core/storage/storage-trees.ts`), so there is nothing for either to carry.
 * Sending credentials anyway is not free: it obliges the response to come back
 * with `Access-Control-Allow-Credentials` and an exact-origin ACAO, which makes
 * a public byte-fetch fail on any origin `ALLOWED_ORIGINS` has not been told
 * about. An `Authorization` header would be worse still — it forces a preflight
 * that `express.static` does not answer. A bare cross-origin GET needs neither.
 *
 * ⚠ The two genuinely private trees (`digital/`, `shipments/`) are **not**
 * reachable this way, and must not be bolted on here: per the backend's
 * private-files changelog their `FileDetail.url` is `null` and the bytes come
 * from the owning entity's own authorized route. Point this at one and it 404s,
 * correctly.
 */
export async function fetchFileBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the file (${response.status})`);
  }
  return response.blob();
}

/**
 * Put a blob on the device. Never throws — the outcome is the answer, because a
 * dismissed share sheet and a failed write need different things said about them.
 */
export async function saveBlob({ blob, fileName }: SaveBlobInput): Promise<SaveOutcome> {
  const name = safeFileName(fileName);

  if (!isNative) {
    try {
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoked on the next task, not synchronously: some browsers cancel a
      // download whose object URL is released in the same tick as the click.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      return 'saved';
    } catch (err) {
      console.warn('[filesystem] could not start the browser download', err);
      return 'failed';
    }
  }

  try {
    await pruneStagingDir();
    const path = `${STAGING_DIR}/${name}`;
    await Filesystem.writeFile({
      path,
      data: await blobToBase64(blob),
      directory: Directory.Cache,
      // Creates `downloads/` on the first save. Without it the write fails on a
      // clean install and succeeds ever after — the worst kind of bug to chase.
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });

    // Handed to the share sheet as a `file://` URI; `@capacitor/share` converts
    // it to a `content://` URI through the FileProvider the Capacitor template
    // already declares, whose `file_paths.xml` covers the cache directory.
    const outcome = await shareContent({ title: name, dialogTitle: name, files: [uri] });
    if (outcome === 'cancelled') return 'dismissed';
    return outcome === 'shared' ? 'saved' : 'failed';
  } catch (err) {
    console.warn('[filesystem] could not save the file', err);
    return 'failed';
  }
}

/**
 * Fetch a file and put it on the device — the whole verb behind a "Download"
 * button, on both platforms.
 */
export async function downloadFile({ url, fileName }: DownloadFileInput): Promise<SaveOutcome> {
  try {
    const blob = await fetchFileBlob(url);
    return await saveBlob({ blob, fileName });
  } catch (err) {
    console.warn('[filesystem] could not download the file', url, err);
    return 'failed';
  }
}
