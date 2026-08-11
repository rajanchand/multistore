import PDFDocument from 'pdfkit';
import { formatMoney } from '@repo/types';
import type { ReportKind } from '@repo/validation';

type AnyRecord = Record<string, unknown>;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function money(value: unknown): string {
  return formatMoney(typeof value === 'number' ? value : 0);
}

function dateLabel(value: unknown): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  colWidths: number[],
): void {
  const startX = doc.x;
  const rowHeight = 16;
  doc.fontSize(9).font('Helvetica-Bold');
  let x = startX;
  headers.forEach((h, i) => {
    doc.text(h, x, doc.y, { width: colWidths[i], continued: false });
    x += colWidths[i]!;
  });
  doc.moveDown(0.4);
  doc
    .moveTo(startX, doc.y)
    .lineTo(startX + colWidths.reduce((a, b) => a + b, 0), doc.y)
    .strokeColor('#cbd5e1')
    .stroke();
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#0f172a');

  for (const row of rows.slice(0, 25)) {
    if (doc.y > 740) {
      doc.addPage();
    }
    const y = doc.y;
    x = startX;
    row.forEach((cell, i) => {
      doc.text(cell, x, y, { width: colWidths[i], height: rowHeight, ellipsis: true });
      x += colWidths[i]!;
    });
    doc.y = y + rowHeight;
  }
  doc.moveDown(0.6);
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.4);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(title);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(9);
}

export async function buildReportPdf(
  kind: ReportKind,
  payload: AnyRecord,
  meta?: { rangeKey?: string; note?: string },
): Promise<{ buffer: Buffer; filename: string }> {
  const range = (payload.range ?? {}) as { from?: unknown; to?: unknown };
  const stamp = new Date().toISOString().slice(0, 10);
  const rangeKey = meta?.rangeKey ?? 'custom';
  const filename = `${kind}-report-${rangeKey}-${stamp}.pdf`;

  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.fontSize(18).font('Helvetica-Bold').text('MultiBranch Commerce');
  doc
    .fontSize(14)
    .fillColor('#0f766e')
    .text(`${kind.charAt(0).toUpperCase()}${kind.slice(1)} report`);
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#475569').font('Helvetica');
  if (range.from || range.to) {
    doc.text(`Period: ${dateLabel(range.from)} – ${dateLabel(range.to)}`);
  } else {
    doc.text('Period: current snapshot');
  }
  doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`);
  if (meta?.note) {
    doc.moveDown(0.2);
    doc.text(`Note: ${meta.note}`);
  }
  doc.moveDown(0.6);

  if (kind === 'summary' || kind === 'sales') {
    const overview = (payload.overview ?? {}) as AnyRecord;
    sectionTitle(doc, 'Overview');
    drawTable(
      doc,
      ['Metric', 'Value'],
      [
        ['Revenue', money(overview.totalRevenue)],
        ['Orders', String(overview.orders ?? 0)],
        ['Paid orders', String(overview.paidOrders ?? overview.orders ?? 0)],
        ['Average order', money(overview.averageOrderValue)],
        ['Customers', String(overview.customers ?? '—')],
        ['Refunds', money(overview.refundsTotal)],
        ['Low stock SKUs', String(overview.lowStockCount ?? '—')],
      ],
      [220, 220],
    );
  }

  if (kind === 'summary') {
    const byBranch = asArray<{
      branch?: { name?: string; code?: string };
      revenue?: number;
      orders?: number;
    }>(payload.revenueByBranch);
    if (byBranch.length) {
      sectionTitle(doc, 'Revenue by branch');
      drawTable(
        doc,
        ['Branch', 'Orders', 'Revenue'],
        byBranch.map((r) => [
          `${r.branch?.name ?? '—'} (${r.branch?.code ?? ''})`,
          String(r.orders ?? 0),
          money(r.revenue),
        ]),
        [260, 80, 100],
      );
    }

    const top = asArray<{ productName?: string; units?: number; revenue?: number }>(
      payload.topProducts,
    );
    if (top.length) {
      sectionTitle(doc, 'Top products');
      drawTable(
        doc,
        ['Product', 'Units', 'Revenue'],
        top.map((r) => [r.productName ?? '—', String(r.units ?? 0), money(r.revenue)]),
        [260, 80, 100],
      );
    }

    const inventory = (payload.inventory ?? {}) as AnyRecord;
    const lowStock = asArray<{
      branchCode?: string;
      sku?: string;
      productName?: string;
      available?: number;
      threshold?: number;
    }>(inventory.lowStock);
    if (lowStock.length) {
      sectionTitle(doc, 'Low stock');
      drawTable(
        doc,
        ['Branch', 'SKU', 'Product', 'Avail', 'Threshold'],
        lowStock.map((r) => [
          r.branchCode ?? '—',
          r.sku ?? '—',
          r.productName ?? '—',
          String(r.available ?? 0),
          String(r.threshold ?? 0),
        ]),
        [70, 90, 180, 50, 60],
      );
    }
  }

  if (kind === 'sales') {
    const cats = asArray<{ categoryName?: string; revenue?: number; units?: number }>(
      payload.salesByCategory,
    );
    if (cats.length) {
      sectionTitle(doc, 'Sales by category');
      drawTable(
        doc,
        ['Category', 'Units', 'Revenue'],
        cats.map((r) => [r.categoryName ?? '—', String(r.units ?? 0), money(r.revenue)]),
        [260, 80, 100],
      );
    }
    const methods = asArray<{
      provider?: string;
      status?: string;
      count?: number;
      amount?: number;
    }>(payload.paymentMethods);
    if (methods.length) {
      sectionTitle(doc, 'Payment methods');
      drawTable(
        doc,
        ['Provider', 'Status', 'Count', 'Amount'],
        methods.map((r) => [
          r.provider ?? '—',
          r.status ?? '—',
          String(r.count ?? 0),
          money(r.amount),
        ]),
        [140, 120, 70, 100],
      );
    }
  }

  if (kind === 'orders') {
    const byStatus = asArray<{ status?: string; count?: number; total?: number }>(payload.byStatus);
    if (byStatus.length) {
      sectionTitle(doc, 'Orders by status');
      drawTable(
        doc,
        ['Status', 'Count', 'Total'],
        byStatus.map((r) => [r.status ?? '—', String(r.count ?? 0), money(r.total)]),
        [180, 80, 120],
      );
    }
    const bySource = asArray<{ source?: string; count?: number; total?: number }>(payload.bySource);
    if (bySource.length) {
      sectionTitle(doc, 'Orders by source');
      drawTable(
        doc,
        ['Source', 'Count', 'Total'],
        bySource.map((r) => [r.source ?? '—', String(r.count ?? 0), money(r.total)]),
        [180, 80, 120],
      );
    }
    const recent = asArray<{
      orderNumber?: string;
      status?: string;
      total?: number;
      placedAt?: unknown;
      branch?: { code?: string };
      customer?: { firstName?: string; lastName?: string };
    }>(payload.recent);
    if (recent.length) {
      sectionTitle(doc, 'Recent orders');
      drawTable(
        doc,
        ['Order', 'Branch', 'Customer', 'Status', 'Total'],
        recent.map((r) => [
          r.orderNumber ?? '—',
          r.branch?.code ?? '—',
          `${r.customer?.firstName ?? ''} ${r.customer?.lastName ?? ''}`.trim() || '—',
          r.status ?? '—',
          money(r.total),
        ]),
        [90, 60, 120, 90, 70],
      );
    }
  }

  if (kind === 'inventory') {
    const totals = (payload.totals ?? {}) as AnyRecord;
    sectionTitle(doc, 'Inventory totals');
    drawTable(
      doc,
      ['Metric', 'Value'],
      [
        ['SKU rows', String(totals.skuRows ?? 0)],
        ['Available', String(totals.available ?? 0)],
        ['Reserved', String(totals.reserved ?? 0)],
        ['Incoming', String(totals.incoming ?? 0)],
      ],
      [220, 220],
    );
    const byBranch = asArray<{
      branchName?: string;
      branchCode?: string;
      skus?: number;
      available?: number;
      lowStock?: number;
    }>(payload.byBranch);
    if (byBranch.length) {
      sectionTitle(doc, 'By branch');
      drawTable(
        doc,
        ['Branch', 'SKUs', 'Available', 'Low stock'],
        byBranch.map((r) => [
          `${r.branchName ?? '—'} (${r.branchCode ?? ''})`,
          String(r.skus ?? 0),
          String(r.available ?? 0),
          String(r.lowStock ?? 0),
        ]),
        [220, 70, 80, 80],
      );
    }
    const lowStock = asArray<{
      branchCode?: string;
      sku?: string;
      productName?: string;
      available?: number;
      threshold?: number;
    }>(payload.lowStock);
    if (lowStock.length) {
      sectionTitle(doc, 'Low stock detail');
      drawTable(
        doc,
        ['Branch', 'SKU', 'Product', 'Avail', 'Threshold'],
        lowStock.map((r) => [
          r.branchCode ?? '—',
          r.sku ?? '—',
          r.productName ?? '—',
          String(r.available ?? 0),
          String(r.threshold ?? 0),
        ]),
        [70, 90, 180, 50, 60],
      );
    }
  }

  doc.end();
  const buffer = await done;
  return { buffer, filename };
}
