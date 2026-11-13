import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { FloorTable, ServiceLevel } from '../lib/ecosystemStore';

export interface TableQrGeneratorProps {
  venueName: string;
  venueSlug: string;
  serviceLevel: ServiceLevel;
  activeTable: number;
  tables: FloorTable[];
  onSelectTable: (tableNumber: number) => void;
  onAddTable: () => void;
  onTestTableMenu: (tableNumber: number) => void;
}

export function buildTableQrUrl(
  baseUrl: string,
  venueSlug: string,
  tableNumber: number,
  serviceLevel: ServiceLevel
): string {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}/?apk=guest&venue=${encodeURIComponent(venueSlug)}&table=${tableNumber}&level=${serviceLevel}`;
}

export const TableQrGenerator: React.FC<TableQrGeneratorProps> = ({
  venueName,
  venueSlug,
  serviceLevel,
  activeTable,
  tables,
  onSelectTable,
  onAddTable,
  onTestTableMenu,
}) => {
  const defaultOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://ais-pre-7n3qzj563wjsok2rrcviof-701800866090.asia-southeast1.run.app';

  const [baseUrl, setBaseUrl] = useState<string>(defaultOrigin);
  const [plaqueSubtitle, setPlaqueSubtitle] = useState<string>(
    'Scan with your phone camera to browse & swipe the menu'
  );
  const [qrDataUrls, setQrDataUrls] = useState<Record<number, string>>({});
  const [qrSvgStrings, setQrSvgStrings] = useState<Record<number, string>>({});
  const [showPrintAllSheet, setShowPrintAllSheet] = useState<boolean>(false);
  const [copiedTable, setCopiedTable] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateAllQrs() {
      const nextDataUrls: Record<number, string> = {};
      const nextSvgs: Record<number, string> = {};

      for (const t of tables) {
        const targetUrl = buildTableQrUrl(baseUrl, venueSlug, t.tableNumber, serviceLevel);
        try {
          const dataUrl = await QRCode.toDataURL(targetUrl, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 520,
            color: {
              dark: '#140905',
              light: '#FFFFFF',
            },
          });
          const svgStr = await QRCode.toString(targetUrl, {
            type: 'svg',
            errorCorrectionLevel: 'H',
            margin: 2,
            color: {
              dark: '#140905',
              light: '#FFFFFF',
            },
          });
          nextDataUrls[t.tableNumber] = dataUrl;
          nextSvgs[t.tableNumber] = svgStr;
        } catch {
          // Ignore single QR failure
        }
      }

      if (!cancelled) {
        setQrDataUrls(nextDataUrls);
        setQrSvgStrings(nextSvgs);
      }
    }

    generateAllQrs();
    return () => {
      cancelled = true;
    };
  }, [baseUrl, venueSlug, serviceLevel, tables]);

  const activeQrUrl = buildTableQrUrl(baseUrl, venueSlug, activeTable, serviceLevel);
  const activeQrDataUrl = qrDataUrls[activeTable];

  // Export High-Res 1200x1600 Print-Ready PNG Plaque
  const handleDownloadPngPlaque = async (tableNumber: number) => {
    const targetUrl = buildTableQrUrl(baseUrl, venueSlug, tableNumber, serviceLevel);
    const qrDataUrl =
      qrDataUrls[tableNumber] ||
      (await QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 760,
        color: { dark: '#140905', light: '#FFFFFF' },
      }));

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Cream Card
    ctx.fillStyle = '#F7F2ED';
    ctx.fillRect(0, 0, 1200, 1600);

    // Outer Espresso Frame
    ctx.strokeStyle = '#140905';
    ctx.lineWidth = 16;
    ctx.strokeRect(36, 36, 1128, 1528);

    // Top Header Espresso Banner
    ctx.fillStyle = '#140905';
    ctx.fillRect(36, 36, 1128, 250);

    // Venue Name
    ctx.fillStyle = '#FBEFE6';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(venueName.toUpperCase(), 600, 145);

    // Table Pill Subtitle
    ctx.fillStyle = '#C4F042';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`DIGITAL TABLE MENU · LEVEL ${serviceLevel}`, 600, 215);

    // Large TABLE X Badge
    ctx.fillStyle = '#E8500C';
    ctx.fillRect(350, 340, 500, 110);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(`TABLE ${tableNumber}`, 600, 418);

    // White QR Container Box
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(220, 500, 760, 760);
    ctx.strokeStyle = '#140905';
    ctx.lineWidth = 6;
    ctx.strokeRect(220, 500, 760, 760);

    // Draw QR Image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = qrDataUrl;
    });
    ctx.drawImage(img, 250, 530, 700, 700);

    // Bottom Callout Copy
    ctx.fillStyle = '#140905';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('SCAN WITH PHONE CAMERA TO ORDER', 600, 1350);

    ctx.fillStyle = '#6C625C';
    ctx.font = '26px sans-serif';
    ctx.fillText(plaqueSubtitle, 600, 1410);

    ctx.fillStyle = '#140905';
    ctx.font = '20px monospace';
    ctx.fillText(targetUrl.slice(0, 72), 600, 1495);

    const pngUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = pngUrl;
    a.download = `${venueSlug}-table-${tableNumber}-qr-plaque.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export Print-Ready Vector SVG Plaque
  const handleDownloadSvgPlaque = (tableNumber: number) => {
    const rawQrSvg = qrSvgStrings[tableNumber];
    if (!rawQrSvg) return;
    const targetUrl = buildTableQrUrl(baseUrl, venueSlug, tableNumber, serviceLevel);

    // Extract inner SVG content or embed rawQrSvg
    const svgInner = rawQrSvg
      .replace(/^<\?xml[^>]*\?>/i, '')
      .replace(/<svg[^>]*>/i, '<svg x="110" y="210" width="380" height="380" viewBox="0 0 45 45">');

    const plaqueSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#F7F2ED" />
  <rect x="18" y="18" width="564" height="764" fill="none" stroke="#140905" stroke-width="8" />
  <rect x="18" y="18" width="564" height="115" fill="#140905" />
  <text x="300" y="68" text-anchor="middle" fill="#FBEFE6" font-family="sans-serif" font-size="26" font-weight="bold">${venueName.replace(/&/g, '&amp;')}</text>
  <text x="300" y="102" text-anchor="middle" fill="#C4F042" font-family="monospace" font-size="14" font-weight="bold">TABLE ${tableNumber} · LEVEL ${serviceLevel} MENU</text>
  <rect x="180" y="150" width="240" height="46" rx="8" fill="#E8500C" />
  <text x="300" y="181" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="24" font-weight="bold">TABLE ${tableNumber}</text>
  <rect x="100" y="205" width="400" height="400" fill="#FFFFFF" stroke="#140905" stroke-width="3" />
  ${svgInner}
  <text x="300" y="655" text-anchor="middle" fill="#140905" font-family="sans-serif" font-size="20" font-weight="bold">SCAN TO OPEN SWIPE MENU</text>
  <text x="300" y="688" text-anchor="middle" fill="#6C625C" font-family="sans-serif" font-size="13">${plaqueSubtitle.replace(/&/g, '&amp;')}</text>
  <text x="300" y="745" text-anchor="middle" fill="#140905" font-family="monospace" font-size="10">${targetUrl.replace(/&/g, '&amp;')}</text>
</svg>`;

    const blob = new Blob([plaqueSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${venueSlug}-table-${tableNumber}-qr-plaque.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyUrl = (tableNumber: number) => {
    const url = buildTableQrUrl(baseUrl, venueSlug, tableNumber, serviceLevel);
    navigator.clipboard?.writeText(url);
    setCopiedTable(tableNumber);
    window.setTimeout(() => setCopiedTable(null), 1800);
  };

  return (
    <div className="flex flex-col gap-5" data-testid="admin-qr-generator">
      {/* Top Controls Bar */}
      <div className="p-4 sm:p-5 rounded-[12px] bg-[#FAF8F5] border border-[#E4E0D8] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#D9480F] block">
              Direct Table QR Generator · {tables.length} Tables
            </span>
            <h3 className="font-display text-[18px] font-semibold text-[#181615] m-0 mt-0.5">
              Export Print-Ready Table QR Plaques
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="qr-add-table-btn"
              onClick={onAddTable}
              className="min-h-[38px] px-3.5 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] hover:border-[#181615] text-[#181615] text-[12px] font-semibold cursor-pointer whitespace-nowrap"
            >
              + Add Table #{tables.length + 1}
            </button>
            <button
              type="button"
              data-testid="qr-toggle-print-sheet-btn"
              onClick={() => setShowPrintAllSheet((prev) => !prev)}
              className="min-h-[38px] px-3.5 rounded-[8px] bg-[#181615] hover:bg-[#292524] text-[#FAF8F5] text-[12px] font-semibold cursor-pointer whitespace-nowrap"
            >
              {showPrintAllSheet
                ? 'Back to Single Plaque'
                : `View All ${tables.length} Tables Sheet`}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="qr-base-url-input"
              className="text-[11px] font-semibold text-[#5C5852]"
            >
              Guest Menu Base URL
            </label>
            <input
              id="qr-base-url-input"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="h-9 px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[12px] font-mono-code text-[#181615]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="qr-subtitle-input"
              className="text-[11px] font-semibold text-[#5C5852]"
            >
              Plaque Scan Instruction
            </label>
            <input
              id="qr-subtitle-input"
              type="text"
              value={plaqueSubtitle}
              onChange={(e) => setPlaqueSubtitle(e.target.value)}
              className="h-9 px-3 rounded-[8px] bg-[#FFFFFF] border border-[#E4E0D8] text-[12px] text-[#181615]"
            />
          </div>
        </div>
      </div>

      {!showPrintAllSheet ? (
        /* Single Table Designer + Table Selector Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Live Printable Plaque Preview */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div
              data-testid="active-qr-plaque-card"
              className="w-full max-w-[330px] rounded-[16px] bg-[#FAF8F5] border-2 border-[#181615] overflow-hidden flex flex-col items-center text-center"
            >
              <div className="w-full bg-[#181615] text-[#FAF8F5] py-3.5 px-4">
                <div className="font-display font-semibold text-[17px] tracking-wide uppercase">
                  {venueName}
                </div>
                <div className="font-mono-code text-[10px] text-[#FAF8F5]/75 mt-0.5">
                  Digital Swipe Menu · Level {serviceLevel}
                </div>
              </div>

              <div className="mt-3 px-4 py-1 rounded-[8px] bg-[#D9480F] text-[#FFFFFF] font-mono-code text-[15px] font-bold">
                TABLE {activeTable}
              </div>

              <div className="my-3 p-3 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] flex items-center justify-center">
                {activeQrDataUrl ? (
                  <img
                    src={activeQrDataUrl}
                    alt={`Scannable QR Code for Table ${activeTable}`}
                    data-testid={`qr-img-table-${activeTable}`}
                    className="w-[184px] h-[184px] block"
                  />
                ) : (
                  <div className="w-[184px] h-[184px] flex items-center justify-center font-mono-code text-[11px] text-[#5C5852]">
                    Generating QR...
                  </div>
                )}
              </div>

              <div className="px-4 pb-4 flex flex-col gap-1">
                <div className="font-semibold text-[12px] text-[#181615] uppercase tracking-wider">
                  Scan With Phone Camera
                </div>
                <div className="text-[11px] text-[#5C5852] leading-snug">
                  {plaqueSubtitle}
                </div>
                <div
                  data-testid="active-qr-encoded-url"
                  className="font-mono-code text-[9px] text-[#5C5852] break-all mt-1"
                >
                  {activeQrUrl}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Table Selector + Direct Export Actions */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="p-4 sm:p-5 rounded-[12px] bg-[#FAF8F5] border border-[#E4E0D8] flex flex-col gap-3">
              <div className="text-[12px] font-semibold text-[#181615]">
                1. Select Table Number
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {tables.map((t) => (
                  <button
                    key={t.tableNumber}
                    type="button"
                    data-testid={`qr-select-table-${t.tableNumber}`}
                    onClick={() => onSelectTable(t.tableNumber)}
                    className={`min-h-[38px] px-2 rounded-[8px] font-mono-code text-[12px] font-semibold cursor-pointer border transition-colors whitespace-nowrap ${
                      activeTable === t.tableNumber
                        ? 'bg-[#D9480F] text-[#FFFFFF] border-[#D9480F]'
                        : 'bg-[#FFFFFF] text-[#181615] border-[#E4E0D8] hover:border-[#181615]'
                    }`}
                  >
                    Table {t.tableNumber}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-[#181615]">
                  2. Export Table {activeTable} Plaque for Print
                </span>
                <span className="font-mono-code text-[11px] text-[#5C5852]">
                  300 DPI ISO QR
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="qr-download-png-btn"
                  onClick={() => handleDownloadPngPlaque(activeTable)}
                  className="min-h-[42px] px-4 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer"
                >
                  Download PNG Plaque (1200×1600)
                </button>

                <button
                  type="button"
                  data-testid="qr-download-svg-btn"
                  onClick={() => handleDownloadSvgPlaque(activeTable)}
                  className="min-h-[42px] px-4 rounded-[8px] bg-[#181615] hover:bg-[#292524] text-[#FAF8F5] text-[12px] font-semibold cursor-pointer"
                >
                  Download Vector SVG Plaque
                </button>

                <button
                  type="button"
                  data-testid="qr-copy-url-btn"
                  onClick={() => handleCopyUrl(activeTable)}
                  className="min-h-[42px] px-4 rounded-[8px] bg-[#FAF8F5] hover:bg-[#EFECE6] border border-[#E4E0D8] text-[#181615] text-[12px] font-medium cursor-pointer"
                >
                  {copiedTable === activeTable
                    ? `Copied Table ${activeTable} Link`
                    : `Copy Table ${activeTable} URL`}
                </button>

                <button
                  type="button"
                  data-testid="qr-test-scan-btn"
                  onClick={() => onTestTableMenu(activeTable)}
                  className="min-h-[42px] px-4 rounded-[8px] bg-[#ECFDF3] hover:bg-[#D1FAE5] border border-[#15803D]/30 text-[#15803D] text-[12px] font-semibold cursor-pointer"
                >
                  Open Table {activeTable} Menu →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Print-Ready Sheet of All Tables */
        <div className="flex flex-col gap-4" data-testid="qr-all-tables-print-sheet">
          <div className="p-3.5 rounded-[12px] bg-[#FAF8F5] border border-[#E4E0D8] flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-[#181615]">
              Print Sheet Ready · All {tables.length} Tables ({venueName})
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[38px] px-4 rounded-[8px] bg-[#D9480F] hover:bg-[#B83B0A] text-[#FFFFFF] text-[12px] font-semibold cursor-pointer"
            >
              Print All {tables.length} Table Plaques
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {tables.map((t) => (
              <div
                key={t.tableNumber}
                className="p-3 rounded-[12px] bg-[#FFFFFF] border border-[#E4E0D8] flex flex-col items-center text-center gap-2"
              >
                <div className="w-full py-1.5 rounded-[6px] bg-[#181615] text-[#FAF8F5] font-mono-code text-[11px] font-semibold uppercase">
                  {venueName} · TABLE {t.tableNumber}
                </div>

                {qrDataUrls[t.tableNumber] ? (
                  <img
                    src={qrDataUrls[t.tableNumber]}
                    alt={`Table ${t.tableNumber} QR`}
                    className="w-[140px] h-[140px] bg-[#FFFFFF] p-1.5 rounded-[8px] border border-[#E4E0D8]"
                  />
                ) : (
                  <div className="w-[140px] h-[140px] flex items-center justify-center text-[11px]">
                    ...
                  </div>
                )}

                <div className="font-mono-code text-[10px] font-semibold text-[#D9480F]">
                  SCAN TO ORDER · TABLE {t.tableNumber}
                </div>

                <div className="w-full flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadPngPlaque(t.tableNumber)}
                    className="flex-1 min-h-[32px] rounded-[6px] bg-[#D9480F] text-[#FFFFFF] font-mono-code text-[10px] font-semibold cursor-pointer"
                  >
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSvgPlaque(t.tableNumber)}
                    className="flex-1 min-h-[32px] rounded-[6px] bg-[#181615] text-[#FAF8F5] font-mono-code text-[10px] font-semibold cursor-pointer"
                  >
                    SVG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
