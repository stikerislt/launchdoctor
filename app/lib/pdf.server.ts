import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdfDocument } from "../components/ReportPdf";
import prisma from "./prisma.server";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

export type PdfFinding = {
  severity: string;
  title: string;
  body: string;
  fixSteps: string[];
};

type AuditForPdf = {
  id: string;
  launchScore: number | null;
  pdfUrl: string | null;
  store: { shopDomain: string };
  findings: Array<{
    severity: string;
    title: string;
    body: string;
    fixSteps: unknown;
  }>;
};

export function isPdfStorageConfigured(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY);
}

export function normalizeFindingsForPdf(
  findings: AuditForPdf["findings"],
): PdfFinding[] {
  return findings.map((finding) => ({
    severity: finding.severity,
    title: finding.title,
    body: finding.body,
    fixSteps: Array.isArray(finding.fixSteps)
      ? (finding.fixSteps as string[])
      : [],
  }));
}

export async function renderAuditPdfBuffer(audit: AuditForPdf): Promise<Buffer> {
  return renderToBuffer(
    ReportPdfDocument({
      shopName: audit.store.shopDomain,
      launchScore: audit.launchScore ?? 0,
      findings: normalizeFindingsForPdf(audit.findings),
    }) as Parameters<typeof renderToBuffer>[0],
  );
}

async function uploadPdfBuffer(auditId: string, buffer: Buffer): Promise<string> {
  const key = `reports/${auditId}.pdf`;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    }),
  );
  return key;
}

export async function generateAndUploadPdf(
  auditId: string,
  shopName: string,
  launchScore: number,
  findings: Array<{
    severity: string;
    title: string;
    body: string;
    fixSteps: string[] | unknown;
  }>,
): Promise<string> {
  const buffer = await renderToBuffer(
    ReportPdfDocument({ shopName, launchScore, findings }) as Parameters<
      typeof renderToBuffer
    >[0],
  );
  return uploadPdfBuffer(auditId, buffer);
}

export async function getSignedPdfUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: 30 * 24 * 60 * 60 });
}

/** Best-effort S3 cache after unlock. No-op when storage is not configured. */
export async function cacheAuditPdfIfPossible(auditId: string): Promise<void> {
  if (!isPdfStorageConfigured()) return;

  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { findings: true, store: true },
  });

  if (!audit || audit.pdfUrl) return;

  try {
    const buffer = await renderAuditPdfBuffer(audit);
    const key = await uploadPdfBuffer(auditId, buffer);
    await prisma.audit.update({
      where: { id: auditId },
      data: { pdfUrl: key },
    });
  } catch {
    // PDF caching is best-effort
  }
}

async function readPdfBufferFromStorage(key: string): Promise<Buffer> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("PDF not found in storage");
  }

  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deliverAuditPdf(audit: AuditForPdf): Promise<Response> {
  let buffer: Buffer;

  if (audit.pdfUrl && isPdfStorageConfigured()) {
    try {
      buffer = await readPdfBufferFromStorage(audit.pdfUrl);
    } catch {
      buffer = await renderAuditPdfBuffer(audit);
    }
  } else {
    buffer = await renderAuditPdfBuffer(audit);

    if (isPdfStorageConfigured() && !audit.pdfUrl) {
      void uploadPdfBuffer(audit.id, buffer)
        .then((key) =>
          prisma.audit.update({
            where: { id: audit.id },
            data: { pdfUrl: key },
          }),
        )
        .catch(() => undefined);
    }
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="launch-doctor-audit-${audit.id}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
