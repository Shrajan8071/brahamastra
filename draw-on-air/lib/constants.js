// Shared constants for the Draw on Air application

// Room states
export const ROOM_STATUS = {
  WAITING: 'WAITING',
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
};

// Member roles
export const MEMBER_ROLE = {
  HOST: 'HOST',
  PARTICIPANT: 'PARTICIPANT',
};

// Member statuses
export const MEMBER_STATUS = {
  APPROVED: 'APPROVED',
  REMOVED: 'REMOVED',
  LEFT: 'LEFT',
};

// Join request statuses
export const REQUEST_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

// Drawing tools
export const DRAWING_TOOL = {
  PEN: 'pen',
  MARKER: 'marker',
  ERASER: 'eraser',
  PAN: 'pan',
};

// Realtime broadcast event types
export const REALTIME_EVENTS = {
  DRAW_START: 'DRAW_START',
  DRAW_POINTS: 'DRAW_POINTS',
  DRAW_END: 'DRAW_END',
  ERASE_STROKE: 'ERASE_STROKE',
  CLEAR_CANVAS: 'CLEAR_CANVAS',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_ENDED: 'SESSION_ENDED',
  JOIN_REQUEST: 'JOIN_REQUEST',
  JOIN_APPROVED: 'JOIN_APPROVED',
  JOIN_REJECTED: 'JOIN_REJECTED',
  USER_REMOVED: 'USER_REMOVED',
};

// Default drawing settings
export const DEFAULT_DRAWING = {
  PEN_COLOR: '#e8e8ed',
  MARKER_COLOR: '#6366f1',
  PEN_WIDTH: 0.003,       // Normalized width (relative to canvas)
  MARKER_WIDTH: 0.015,
  ERASER_WIDTH: 0.02,
  MIN_WIDTH: 0.001,
  MAX_WIDTH: 0.05,
};

// Color palette for drawing
export const COLOR_PALETTE = [
  '#e8e8ed', // White
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
];

// Broadcast throttle (ms)
export const BROADCAST_THROTTLE_MS = 50;

// Host reconnection grace period (seconds)
export const HOST_GRACE_PERIOD_SECONDS = 60;

// Room code length
export const ROOM_CODE_LENGTH = 6;

// Display name constraints
export const DISPLAY_NAME_MIN_LENGTH = 1;
export const DISPLAY_NAME_MAX_LENGTH = 30;
