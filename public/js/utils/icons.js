/**
 * icons.js — Centralized Lucide-style SVG icon functions.
 * All icons use: stroke-based SVG, viewBox="0 0 24 24", fill="none",
 * stroke="currentColor", stroke-width="2", stroke-linecap="round", stroke-linejoin="round"
 *
 * Usage: import { iconEdit } from './icons.js';
 *        element.innerHTML = `${iconEdit(14)} Editar`;
 */

const SVG_OPEN = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;flex-shrink:0;">`;
const SVG_CLOSE = `</svg>`;

/** Pencil / edit (✏️) */
export function iconEdit(size = 16) {
  return `${SVG_OPEN(size)}<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>${SVG_CLOSE}`;
}

/** Plus / add (＋) */
export function iconPlus(size = 16) {
  return `${SVG_OPEN(size)}<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>${SVG_CLOSE}`;
}

/** X / close (✕) */
export function iconClose(size = 16) {
  return `${SVG_OPEN(size)}<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>${SVG_CLOSE}`;
}

/** Trash / delete (🗑) */
export function iconTrash(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>${SVG_CLOSE}`;
}

/** Magnifying glass / search (🔍) */
export function iconSearch(size = 16) {
  return `${SVG_OPEN(size)}<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>${SVG_CLOSE}`;
}

/** Filter / funnel */
export function iconFilter(size = 16) {
  return `${SVG_OPEN(size)}<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>${SVG_CLOSE}`;
}

/** File / document (📄) */
export function iconDocument(size = 16) {
  return `${SVG_OPEN(size)}<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>${SVG_CLOSE}`;
}

/** File-text / note (📝) */
export function iconNote(size = 16) {
  return `${SVG_OPEN(size)}<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>${SVG_CLOSE}`;
}

/** Download arrow (⬇️) */
export function iconDownload(size = 16) {
  return `${SVG_OPEN(size)}<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>${SVG_CLOSE}`;
}

/** Upload arrow (⬆) */
export function iconUpload(size = 16) {
  return `${SVG_OPEN(size)}<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>${SVG_CLOSE}`;
}

/** Checkmark (✅ ✓) */
export function iconCheck(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="20 6 9 17 4 12"/>${SVG_CLOSE}`;
}

/** Alert triangle (⚠️) */
export function iconAlert(size = 16) {
  return `${SVG_OPEN(size)}<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>${SVG_CLOSE}`;
}

/** Info circle (ℹ️ 💡) */
export function iconInfo(size = 16) {
  return `${SVG_OPEN(size)}<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>${SVG_CLOSE}`;
}

/** Gear / settings (⚙️) */
export function iconSettings(size = 16) {
  return `${SVG_OPEN(size)}<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>${SVG_CLOSE}`;
}

/** User person (👤) */
export function iconUser(size = 16) {
  return `${SVG_OPEN(size)}<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>${SVG_CLOSE}`;
}

/** Refresh / reload (🔄) */
export function iconRefresh(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>${SVG_CLOSE}`;
}

/** Eye / view */
export function iconEye(size = 16) {
  return `${SVG_OPEN(size)}<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>${SVG_CLOSE}`;
}

/** Package / box (📦) */
export function iconPackage(size = 16) {
  return `${SVG_OPEN(size)}<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>${SVG_CLOSE}`;
}

/** Link / chain (🔗) */
export function iconLink(size = 16) {
  return `${SVG_OPEN(size)}<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>${SVG_CLOSE}`;
}

/** Copy (📋) */
export function iconCopy(size = 16) {
  return `${SVG_OPEN(size)}<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>${SVG_CLOSE}`;
}

/** Star */
export function iconStar(size = 16) {
  return `${SVG_OPEN(size)}<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>${SVG_CLOSE}`;
}

/** Chevron down */
export function iconChevronDown(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="6 9 12 15 18 9"/>${SVG_CLOSE}`;
}

/** Chevron right */
export function iconChevronRight(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="9 18 15 12 9 6"/>${SVG_CLOSE}`;
}

/** Home (🏠) */
export function iconHome(size = 16) {
  return `${SVG_OPEN(size)}<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>${SVG_CLOSE}`;
}

/** Lock (🔒) */
export function iconLock(size = 16) {
  return `${SVG_OPEN(size)}<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>${SVG_CLOSE}`;
}

/** Key (🔑) */
export function iconKey(size = 16) {
  return `${SVG_OPEN(size)}<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>${SVG_CLOSE}`;
}

/** Bell / notification (🔔) */
export function iconBell(size = 16) {
  return `${SVG_OPEN(size)}<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>${SVG_CLOSE}`;
}

/** Bar chart (📊) */
export function iconBarChart(size = 16) {
  return `${SVG_OPEN(size)}<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>${SVG_CLOSE}`;
}

/** Send / paper plane */
export function iconSend(size = 16) {
  return `${SVG_OPEN(size)}<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>${SVG_CLOSE}`;
}

/** Printer */
export function iconPrinter(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>${SVG_CLOSE}`;
}

/** External link */
export function iconExternalLink(size = 16) {
  return `${SVG_OPEN(size)}<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>${SVG_CLOSE}`;
}

/** Camera (📷) */
export function iconCamera(size = 16) {
  return `${SVG_OPEN(size)}<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>${SVG_CLOSE}`;
}

/** Monitor / screen (🖥) */
export function iconMonitor(size = 16) {
  return `${SVG_OPEN(size)}<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>${SVG_CLOSE}`;
}

/** Smartphone / mobile (📱) */
export function iconSmartphone(size = 16) {
  return `${SVG_OPEN(size)}<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>${SVG_CLOSE}`;
}

/** Zap / lightning (⚡) */
export function iconZap(size = 16) {
  return `${SVG_OPEN(size)}<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>${SVG_CLOSE}`;
}

/** Folder / file open (📂) */
export function iconFolder(size = 16) {
  return `${SVG_OPEN(size)}<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>${SVG_CLOSE}`;
}

/** Save / floppy (💾) */
export function iconSave(size = 16) {
  return `${SVG_OPEN(size)}<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>${SVG_CLOSE}`;
}

/** QR code / scan (📲) */
export function iconQrCode(size = 16) {
  return `${SVG_OPEN(size)}<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="14" y1="18" x2="14" y2="21"/><line x1="17" y1="18" x2="21" y2="18"/><line x1="21" y1="21" x2="21" y2="18"/>${SVG_CLOSE}`;
}

/** Clipboard list (📋 tab icon) */
export function iconClipboard(size = 16) {
  return `${SVG_OPEN(size)}<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>${SVG_CLOSE}`;
}

/** Wrench / tool (🔧) */
export function iconWrench(size = 16) {
  return `${SVG_OPEN(size)}<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>${SVG_CLOSE}`;
}

/** New / sparkle (🆕) */
export function iconSparkle(size = 16) {
  return `${SVG_OPEN(size)}<path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5L12 2z"/>${SVG_CLOSE}`;
}

/** Chevron up */
export function iconChevronUp(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="18 15 12 9 6 15"/>${SVG_CLOSE}`;
}

/** Chevron left / back (🡨) */
export function iconChevronLeft(size = 16) {
  return `${SVG_OPEN(size)}<polyline points="15 18 9 12 15 6"/>${SVG_CLOSE}`;
}

/** Map pin / location (📍) */
export function iconMapPin(size = 16) {
  return `${SVG_OPEN(size)}<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>${SVG_CLOSE}`;
}

/** Message / chat (💬) */
export function iconMessage(size = 16) {
  return `${SVG_OPEN(size)}<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>${SVG_CLOSE}`;
}

/** Image / photo (🖼️) */
export function iconImage(size = 16) {
  return `${SVG_OPEN(size)}<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>${SVG_CLOSE}`;
}

/** Ticket / tag (🎟️) */
export function iconTag(size = 16) {
  return `${SVG_OPEN(size)}<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>${SVG_CLOSE}`;
}

/** CPU / desktop computer (💻) */
export function iconCpu(size = 16) {
  return `${SVG_OPEN(size)}<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>${SVG_CLOSE}`;
}

/** TV / television (📺) */
export function iconTv(size = 16) {
  return `${SVG_OPEN(size)}<rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/>${SVG_CLOSE}`;
}

/** Tablet device (📱 wide) */
export function iconTablet(size = 16) {
  return `${SVG_OPEN(size)}<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>${SVG_CLOSE}`;
}

/** Scan / barcode scanner */
export function iconScan(size = 16) {
  return `${SVG_OPEN(size)}<line x1="3" y1="12" x2="21" y2="12"/><polyline points="3 6 3 3 6 3"/><polyline points="21 6 21 3 18 3"/><polyline points="3 18 3 21 6 21"/><polyline points="21 18 21 21 18 21"/>${SVG_CLOSE}`;
}

/** Mouse / peripheral (🖱) */
export function iconMouse(size = 16) {
  return `${SVG_OPEN(size)}<rect x="6" y="3" width="12" height="18" rx="6"/><line x1="12" y1="3" x2="12" y2="9"/><circle cx="12" cy="13" r="1"/>${SVG_CLOSE}`;
}

/** Hamburger menu (☰) */
export function iconMenu(size = 16) {
  return `${SVG_OPEN(size)}<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>${SVG_CLOSE}`;
}
