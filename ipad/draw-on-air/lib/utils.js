import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a random 6-digit room code
 */
export function generateRoomCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validate a room code (exactly 6 digits)
 */
export function isValidRoomCode(code) {
  return /^\d{6}$/.test(code);
}

/**
 * Sanitize display name (strip control characters and zero-width spaces)
 */
export function sanitizeDisplayName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '').trim();
}

/**
 * Validate display name
 */
export function isValidDisplayName(name) {
  const sanitized = sanitizeDisplayName(name);
  return sanitized.length >= 1 && sanitized.length <= 30;
}

/**
 * Generate a unique stroke ID
 */
export function generateStrokeId() {
  return `stroke_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Simplify stroke point array to remove redundant co-linear or micro-adjacent points
 */
export function simplifyStrokePoints(points, minDistance = 0.5) {
  if (!Array.isArray(points) || points.length <= 2) return points;
  const result = [points[0]];
  let prev = points[0];

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    if (Math.sqrt(dx * dx + dy * dy) >= minDistance) {
      result.push(pt);
      prev = pt;
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Format a timestamp to a human-readable time
 */
export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Shortest distance from point p to line segment vw
 */
export function distanceToSegment(p, v, w) {
  if (!v || !w) return Infinity;
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) {
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  const dx = p.x - projX;
  const dy = p.y - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

