import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Paths, File, Directory } from 'expo-file-system';

function getPdfDir(): Directory {
  return new Directory(Paths.document, 'pdfs');
}

function ensurePdfDir(): void {
  const dir = getPdfDir();
  if (!dir.exists) {
    dir.create();
  }
}

export async function generatePdf(html: string, filename: string): Promise<string> {
  ensurePdfDir();

  const { uri } = await Print.printToFileAsync({ html });

  // expo-print gives us a temp file, share directly from there
  // We store the URI for resharing later
  const dest = new File(getPdfDir(), `${filename}.pdf`);
  if (dest.exists) {
    dest.delete();
  }

  // Move from temp location
  const tempFile = new File(uri);
  tempFile.move(dest);

  return dest.uri;
}

export async function sharePdf(uri: string, dialogTitle: string): Promise<void> {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle,
    });
  }
}

export function deletePdf(uri: string): void {
  if (!uri) return;
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export async function generateAndSharePdf(html: string, filename: string, dialogTitle: string): Promise<string> {
  const uri = await generatePdf(html, filename);
  await sharePdf(uri, dialogTitle);
  return uri;
}
