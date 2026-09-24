'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pencil, Highlighter, Eraser, Minus, Plus, Hand, ZoomIn, ZoomOut,
  Users, XCircle, LogOut, Menu, X, ChevronDown, Check, Trash2, WifiOff, Compass, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase/client';
import {
  DRAWING_TOOL,
  DEFAULT_DRAWING,
  COLOR_PALETTE,
  REALTIME_EVENTS,
  BROADCAST_THROTTLE_MS,
  MEMBER_STATUS,
  MEMBER_ROLE,
  ROOM_STATUS,
} from '@/lib/constants';
import { generateStrokeId, simplifyStrokePoints, distanceToSegment } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function DrawingRoom({
  room,
  user,
  membership,
  isHost,
  members,
  joinRequests,
  onApprove,
  onReject,
  onRemoveParticipant,
  onEndSession,
  onLeave,
  onRefreshHostData,
}) {
  // Canvas refs
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const containerRef = useRef(null);

  // Drawing state (using refs for performance — no React re-renders during high-frequency events)
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const strokesRef = useRef([]); // All persisted strokes (stored in pure world coordinates)
  const pendingStrokesRef = useRef(new Map()); // Remote strokes being drawn in real time
  const activePointerIdRef = useRef(null); // Multi-touch palm rejection ref

  // Pan & Zoom state (refs for instantaneous rendering, state for UI controls)
  const zoomRef = useRef(1.0);
  const [zoom, setZoom] = useState(1.0);

  const panRef = useRef({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const isPanningRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const isSpacePressedRef = useRef(false);

  // Tool state with per-tool memory
  const toolSizesRef = useRef({
    [DRAWING_TOOL.PEN]: 4,
    [DRAWING_TOOL.MARKER]: 16,
    [DRAWING_TOOL.ERASER]: 30,
  });
  const [tool, setTool] = useState(DRAWING_TOOL.PEN);
  const [color, setColor] = useState(DEFAULT_DRAWING.PEN_COLOR);
  const [brushSize, setBrushSize] = useState(4); // Default 4px world width
  const [showToolbar, setShowToolbar] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const [showColors, setShowColors] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Realtime channel & fetch baseline timestamp
  const channelRef = useRef(null);
  const isSubscribedRef = useRef(false);
  const lastBroadcastRef = useRef(0);
  const pointsBufferRef = useRef([]);
  const lastFetchedAtRef = useRef(null);
  const sizeIntervalRef = useRef(null);

  const sendBroadcast = useCallback((event, payload) => {
    if (channelRef.current && isSubscribedRef.current) {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event,
          payload,
        });
      } catch {
        // Ignored
      }
    }
  }, []);

  // Canvas dimensions
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Attribution timer ref
  const attributionTimerRef = useRef(null);

  // Render a single stroke in world coordinates
  const renderStroke = useCallback((stroke) => {
    const ctx = ctxRef.current;
    if (!ctx || !stroke.points || stroke.points.length < 2) return;
    if (stroke.deleted_at) return;

    ctx.beginPath();
    ctx.strokeStyle = stroke.tool === DRAWING_TOOL.ERASER ? '#0a0a0f' : stroke.color;
    ctx.lineWidth = stroke.width || 4;
    ctx.globalAlpha = stroke.tool === DRAWING_TOOL.MARKER ? 0.4 : 1;
    ctx.globalCompositeOperation =
      stroke.tool === DRAWING_TOOL.ERASER ? 'destination-out' : 'source-over';

    const p0 = stroke.points[0];
    ctx.moveTo(p0.x, p0.y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      ctx.lineTo(p.x, p.y);
    }

    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }, []);

  // Render all strokes with 2D transform (pan & zoom)
  const renderAllStrokes = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const { width: cw, height: ch } = canvasSizeRef.current;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // Apply 2D Matrix transformation for Pan and Zoom
    ctx.setTransform(
      dpr * zoomRef.current,
      0,
      0,
      dpr * zoomRef.current,
      dpr * panRef.current.x,
      dpr * panRef.current.y
    );
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Render persisted strokes
    for (const stroke of strokesRef.current) {
      renderStroke(stroke);
    }

    // 2. Render pending remote strokes
    for (const [, stroke] of pendingStrokesRef.current) {
      renderStroke(stroke);
    }

    // 3. Render current local stroke being drawn
    if (currentStrokeRef.current) {
      renderStroke(currentStrokeRef.current);
    }

    ctx.restore();
  }, [renderStroke]);

  // Update zoom and pan smoothly
  const updateZoomPan = useCallback((newZoom, newPan) => {
    const clampedZoom = Math.max(0.15, Math.min(6.0, newZoom));
    zoomRef.current = clampedZoom;
    panRef.current = newPan;
    setZoom(clampedZoom);
    setPan(newPan);
    renderAllStrokes();
  }, [renderAllStrokes]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    const { width: cw, height: ch } = canvasSizeRef.current;
    const centerX = cw / 2;
    const centerY = ch / 2;
    const newZoom = Math.min(6.0, zoomRef.current * 1.25);
    const newPanX = centerX - (centerX - panRef.current.x) * (newZoom / zoomRef.current);
    const newPanY = centerY - (centerY - panRef.current.y) * (newZoom / zoomRef.current);
    updateZoomPan(newZoom, { x: newPanX, y: newPanY });
  }, [updateZoomPan]);

  const handleZoomOut = useCallback(() => {
    const { width: cw, height: ch } = canvasSizeRef.current;
    const centerX = cw / 2;
    const centerY = ch / 2;
    const newZoom = Math.max(0.15, zoomRef.current / 1.25);
    const newPanX = centerX - (centerX - panRef.current.x) * (newZoom / zoomRef.current);
    const newPanY = centerY - (centerY - panRef.current.y) * (newZoom / zoomRef.current);
    updateZoomPan(newZoom, { x: newPanX, y: newPanY });
  }, [updateZoomPan]);

  const handleResetZoom = useCallback(() => {
    updateZoomPan(1.0, { x: 0, y: 0 });
  }, [updateZoomPan]);

  // Mouse wheel zoom (centered at mouse pointer)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.max(0.15, Math.min(6.0, zoomRef.current * zoomFactor));

    const newPanX = mouseX - (mouseX - panRef.current.x) * (newZoom / zoomRef.current);
    const newPanY = mouseY - (mouseY - panRef.current.y) * (newZoom / zoomRef.current);

    updateZoomPan(newZoom, { x: newPanX, y: newPanY });
  }, [updateZoomPan]);

  // Spacebar key listener for quick panning
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(activeTag)) {
        isSpacePressedRef.current = true;
        const canvas = canvasRef.current;
        if (canvas) canvas.style.cursor = 'grab';
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.style.cursor =
            tool === DRAWING_TOOL.PAN
              ? 'grab'
              : tool === DRAWING_TOOL.ERASER
              ? 'cell'
              : 'crosshair';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [tool]);

  // Initialize canvas size
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    canvasSizeRef.current = { width: rect.width, height: rect.height };

    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    renderAllStrokes();
  }, [renderAllStrokes]);

  // Set up canvas on mount & window resize
  useEffect(() => {
    initCanvas();

    const handleResize = () => {
      initCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initCanvas]);

  // Attach wheel event with non-passive listener for zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Enforce strict 1-finger maximum touch policy to eliminate multi-finger hallucination
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleTouchStart = (e) => {
      e.preventDefault();
      if (e.touches && e.touches.length > 1) {
        if (isDrawingRef.current || isPanningRef.current) {
          isDrawingRef.current = false;
          isPanningRef.current = false;
          currentStrokeRef.current = null;
          activePointerIdRef.current = null;
          renderAllStrokes();
        }
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (e.touches && e.touches.length > 1) {
        if (isDrawingRef.current || isPanningRef.current) {
          isDrawingRef.current = false;
          isPanningRef.current = false;
          currentStrokeRef.current = null;
          activePointerIdRef.current = null;
          renderAllStrokes();
        }
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
        isDrawingRef.current = false;
        isPanningRef.current = false;
        currentStrokeRef.current = null;
        activePointerIdRef.current = null;
        renderAllStrokes();
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [renderAllStrokes]);

  // Helper: Convert legacy strokes once, leaving all world strokes 100% untouched
  const normalizeStrokeToWorld = useCallback((stroke) => {
    // If it's already a world stroke or flagged as world, return as-is immediately
    if (stroke.isWorld) {
      return stroke;
    }

    // Only convert old legacy strokes from initial prototype (width < 0.05 and 0..1 coordinates)
    if (
      stroke.width < 0.05 &&
      Array.isArray(stroke.points) &&
      stroke.points.length > 0 &&
      stroke.points[0].x <= 1 &&
      stroke.points[0].y <= 1
    ) {
      const cw = canvasSizeRef.current.width || 1200;
      const ch = canvasSizeRef.current.height || 800;
      const width = stroke.width * Math.min(cw, ch);
      const points = stroke.points.map((p) => ({
        ...p,
        x: p.x * cw,
        y: p.y * ch,
      }));
      return { ...stroke, width, points, isWorld: true };
    }

    return { ...stroke, isWorld: true };
  }, []);

  // Load persisted strokes
  const fetchStrokes = useCallback(async () => {
    const { data: strokes, error } = await supabase
      .from('drawing_strokes')
      .select('*')
      .eq('room_id', room.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!error && strokes) {
      const memberMap = new Map();
      if (members && members.length > 0) {
        members.forEach((m) => memberMap.set(m.user_id, m.display_name));
      }
      if (membership) {
        memberMap.set(user.id, membership.display_name);
      }

      const existingMap = new Map(strokesRef.current.map((s) => [s.id, s]));
      let updated = false;

      for (let stroke of strokes) {
        if (!stroke.display_name) {
          stroke.display_name = memberMap.get(stroke.user_id) || 'Unknown';
        }

        // If stroke is already in memory with isWorld = true, retain the exact memory object
        if (existingMap.has(stroke.id)) {
          const existing = existingMap.get(stroke.id);
          if (existing.isWorld && existing.deleted_at === stroke.deleted_at) {
            continue;
          }
        }

        stroke = normalizeStrokeToWorld(stroke);
        existingMap.set(stroke.id, stroke);
        updated = true;
      }

      if (updated || strokesRef.current.length !== existingMap.size) {
        strokesRef.current = Array.from(existingMap.values());
        renderAllStrokes();
      }
    }
  }, [room.id, renderAllStrokes, members, membership, user, normalizeStrokeToWorld]);

  // Initial load & foreground tab visibility listener
  useEffect(() => {
    fetchStrokes();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStrokes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchStrokes]);

  // Set up realtime channel for drawing & database changes
  useEffect(() => {
    if (!room.id || !user) return;

    const channel = supabase
      .channel(`drawing:${room.id}`, {
        config: {
          broadcast: { self: false, ack: true },
        },
      })
      .on('broadcast', { event: REALTIME_EVENTS.DRAW_START }, (payload) => {
        const data = payload.payload;
        if (!data || data.userId === user.id) return;

        pendingStrokesRef.current.set(data.strokeId, {
          id: data.strokeId,
          user_id: data.userId,
          display_name: data.displayName,
          tool: data.tool,
          color: data.color,
          width: data.width,
          points: [data.point],
          isWorld: true,
        });
        renderAllStrokes();
      })
      .on('broadcast', { event: REALTIME_EVENTS.DRAW_POINTS }, (payload) => {
        const data = payload.payload;
        if (!data || data.userId === user.id) return;
        const pending = pendingStrokesRef.current.get(data.strokeId);
        if (pending && data.points) {
          pending.points.push(...data.points);
          renderAllStrokes();
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.DRAW_END }, (payload) => {
        const data = payload.payload;
        if (!data || data.userId === user.id) return;
        const pending = pendingStrokesRef.current.get(data.strokeId);
        if (pending) {
          if (data.points?.length) {
            pending.points.push(...data.points);
          }
          strokesRef.current.push(pending);
          pendingStrokesRef.current.delete(data.strokeId);
          renderAllStrokes();
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.ERASE_STROKE }, (payload) => {
        const data = payload.payload;
        if (!data || data.userId === user.id) return;
        const stroke = strokesRef.current.find((s) => s.id === data.strokeId);
        if (stroke) {
          stroke.deleted_at = new Date().toISOString();
          renderAllStrokes();
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drawing_strokes',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchStrokes();
        }
      )
      .subscribe((status) => {
        isSubscribedRef.current = status === 'SUBSCRIBED';
      });

    channelRef.current = channel;

    const interval = setInterval(() => {
      fetchStrokes();
    }, 2500);

    return () => {
      isSubscribedRef.current = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [room.id, user, renderAllStrokes, fetchStrokes, normalizeStrokeToWorld]);

  // Periodically refresh host data for the host
  useEffect(() => {
    if (!isHost || !onRefreshHostData) return;
    onRefreshHostData();
    const interval = setInterval(() => {
      onRefreshHostData();
    }, 3000);

    return () => clearInterval(interval);
  }, [isHost, onRefreshHostData]);

  // Convert pointer screen position to infinite world coordinates
  const getPointerPos = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const x = (screenX - panRef.current.x) / zoomRef.current;
    const y = (screenY - panRef.current.y) / zoomRef.current;
    const pressure = e.pressure || 0.5;

    return { x, y, pressure };
  }, []);

  // Broadcast points (throttled)
  const broadcastPoints = useCallback((strokeId, points) => {
    const now = Date.now();
    pointsBufferRef.current.push(...points);

    if (now - lastBroadcastRef.current >= BROADCAST_THROTTLE_MS) {
      if (pointsBufferRef.current.length > 0) {
        sendBroadcast(REALTIME_EVENTS.DRAW_POINTS, {
          userId: user.id,
          strokeId,
          points: pointsBufferRef.current,
        });
        pointsBufferRef.current = [];
        lastBroadcastRef.current = now;
      }
    }
  }, [user, sendBroadcast]);

  // Synchronized Clear Canvas handler
  const handleClearCanvas = useCallback(async () => {
    strokesRef.current = [];
    pendingStrokesRef.current.clear();
    renderAllStrokes();

    sendBroadcast(REALTIME_EVENTS.CLEAR_CANVAS, {
      userId: user.id,
      timestamp: Date.now(),
    });

    try {
      await supabase
        .from('drawing_strokes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('room_id', room.id)
        .is('deleted_at', null);
    } catch {
      // Ignored
    }
  }, [room.id, user, renderAllStrokes, sendBroadcast]);

  // Handle eraser in world coordinates (clamped radius [8, 35], segment-based collision)
  const handleErase = useCallback((pos) => {
    const rawRadius = brushSize / zoomRef.current;
    const eraserRadius = Math.max(8, Math.min(35, rawRadius));

    const strokeCollides = (stroke) => {
      if (!stroke || !stroke.points || stroke.points.length === 0) return false;
      const threshold = eraserRadius + ((stroke.width || 4) / 2);
      if (stroke.points.length === 1) {
        const dx = stroke.points[0].x - pos.x;
        const dy = stroke.points[0].y - pos.y;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
      }
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const dist = distanceToSegment(pos, stroke.points[i], stroke.points[i + 1]);
        if (dist <= threshold) return true;
      }
      return false;
    };

    // 1. Check persisted strokes
    for (const stroke of strokesRef.current) {
      if (stroke.deleted_at) continue;
      if (strokeCollides(stroke)) {
        stroke.deleted_at = new Date().toISOString();

        supabase
          .from('drawing_strokes')
          .update({ deleted_at: stroke.deleted_at })
          .eq('id', stroke.id)
          .then();

        sendBroadcast(REALTIME_EVENTS.ERASE_STROKE, {
          userId: user.id,
          strokeId: stroke.id,
        });

        renderAllStrokes();
      }
    }

    // 2. Check pending remote strokes
    for (const [strokeId, stroke] of pendingStrokesRef.current) {
      if (strokeCollides(stroke)) {
        pendingStrokesRef.current.delete(strokeId);
        sendBroadcast(REALTIME_EVENTS.ERASE_STROKE, {
          userId: user.id,
          strokeId,
        });
        renderAllStrokes();
      }
    }
  }, [brushSize, user, renderAllStrokes, sendBroadcast]);

  // Pointer Down (with multi-touch palm rejection & 1-finger policy)
  const handlePointerDown = useCallback((e) => {
    if (membership?.status === MEMBER_STATUS.REMOVED) return;

    // Strict 1-finger rule: ignore multi-touch immediately
    if (e.pointerType === 'touch' && e.targetTouches && e.targetTouches.length > 1) {
      isDrawingRef.current = false;
      isPanningRef.current = false;
      currentStrokeRef.current = null;
      activePointerIdRef.current = null;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Palm rejection: ignore secondary touch pointers
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }
    activePointerIdRef.current = e.pointerId;

    // Check for Pan mode (Hand tool, middle mouse button, or Spacebar key held)
    if (tool === DRAWING_TOOL.PAN || e.button === 1 || isSpacePressedRef.current) {
      isPanningRef.current = true;
      startPanRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y,
      };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const pos = getPointerPos(e);
    if (!pos) return;

    if (tool === DRAWING_TOOL.ERASER) {
      handleErase(pos);
      return;
    }

    const strokeId = generateStrokeId();
    const displayName = membership?.display_name || 'Unknown';

    currentStrokeRef.current = {
      id: strokeId,
      room_id: room.id,
      user_id: user.id,
      display_name: displayName,
      tool,
      color,
      width: brushSize,
      points: [pos],
    };

    sendBroadcast(REALTIME_EVENTS.DRAW_START, {
      userId: user.id,
      displayName,
      strokeId,
      tool,
      color,
      width: brushSize,
      point: pos,
    });

    renderAllStrokes();
  }, [tool, color, brushSize, room.id, user, membership, getPointerPos, handleErase, renderAllStrokes, sendBroadcast]);

  // Pointer Move
  const handlePointerMove = useCallback((e) => {
    // Strict 1-finger rule during movement
    if (e.pointerType === 'touch' && e.targetTouches && e.targetTouches.length > 1) {
      isDrawingRef.current = false;
      isPanningRef.current = false;
      currentStrokeRef.current = null;
      activePointerIdRef.current = null;
      renderAllStrokes();
      return;
    }

    if (isPanningRef.current) {
      const newPanX = e.clientX - startPanRef.current.x;
      const newPanY = e.clientY - startPanRef.current.y;
      panRef.current = { x: newPanX, y: newPanY };
      setPan({ x: newPanX, y: newPanY });
      renderAllStrokes();
      return;
    }

    if (!isDrawingRef.current) return;

    const pos = getPointerPos(e);
    if (!pos) return;

    if (tool === DRAWING_TOOL.ERASER) {
      handleErase(pos);
      return;
    }

    const stroke = currentStrokeRef.current;
    if (!stroke) return;

    stroke.points.push(pos);
    renderAllStrokes();
    broadcastPoints(stroke.id, [pos]);
  }, [tool, getPointerPos, handleErase, broadcastPoints, renderAllStrokes]);

  // Pointer Up / Cancel
  const handlePointerUp = useCallback(async (e) => {
    const canvas = canvasRef.current;

    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      if (canvas) {
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        canvas.style.cursor = tool === DRAWING_TOOL.PAN ? 'grab' : tool === DRAWING_TOOL.ERASER ? 'cell' : 'crosshair';
      }
      return;
    }

    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (canvas) {
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    }

    if (tool === DRAWING_TOOL.ERASER) return;

    const stroke = currentStrokeRef.current;
    if (!stroke || stroke.points.length < 2) {
      currentStrokeRef.current = null;
      return;
    }

    const trailingPoints = [...pointsBufferRef.current];
    pointsBufferRef.current = [];

    if (trailingPoints.length > 0) {
      sendBroadcast(REALTIME_EVENTS.DRAW_POINTS, {
        userId: user.id,
        strokeId: stroke.id,
        points: trailingPoints,
      });
    }

    sendBroadcast(REALTIME_EVENTS.DRAW_END, {
      userId: user.id,
      strokeId: stroke.id,
      points: trailingPoints,
    });

    strokesRef.current.push({ ...stroke });

    if (room.status === ROOM_STATUS.ACTIVE) {
      try {
        await supabase.from('drawing_strokes').insert({
          id: stroke.id,
          room_id: stroke.room_id,
          user_id: stroke.user_id,
          tool: stroke.tool,
          color: stroke.color,
          width: stroke.width,
          points: simplifyStrokePoints(stroke.points),
        });
      } catch {
        // Ignored
      }
    }

    currentStrokeRef.current = null;
    renderAllStrokes();
  }, [tool, user, room.status, renderAllStrokes, sendBroadcast]);

  // Hover stroke attribution with segment distance clamping
  const handlePointerMoveForAttribution = useCallback((e) => {
    if (isDrawingRef.current || isPanningRef.current) {
      setAttribution(null);
      return;
    }

    const pos = getPointerPos(e);
    if (!pos) return;

    const hitRadiusWorld = 20 / zoomRef.current;

    for (let i = strokesRef.current.length - 1; i >= 0; i--) {
      const stroke = strokesRef.current[i];
      if (stroke.deleted_at) continue;

      let hit = false;
      const threshold = hitRadiusWorld + ((stroke.width || 4) / 2);
      if (stroke.points && stroke.points.length === 1) {
        const dx = stroke.points[0].x - pos.x;
        const dy = stroke.points[0].y - pos.y;
        hit = Math.sqrt(dx * dx + dy * dy) <= threshold;
      } else if (stroke.points && stroke.points.length > 1) {
        for (let j = 0; j < stroke.points.length - 1; j++) {
          if (distanceToSegment(pos, stroke.points[j], stroke.points[j + 1]) <= threshold) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        const isOwn = stroke.user_id === user.id;
        const displayName = stroke.display_name || 'Unknown';
        const container = containerRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const rawX = e.clientX - containerRect.left;
        const rawY = e.clientY - containerRect.top;
        const clampedX = Math.max(80, Math.min(containerRect.width - 80, rawX));
        const clampedY = Math.max(45, Math.min(containerRect.height - 20, rawY));

        setAttribution({
          name: isOwn ? `You (${membership?.display_name || ''})` : displayName,
          x: clampedX,
          y: clampedY,
        });

        if (attributionTimerRef.current) clearTimeout(attributionTimerRef.current);
        attributionTimerRef.current = setTimeout(() => setAttribution(null), 2500);
        return;
      }
    }

    setAttribution(null);
  }, [user, membership, getPointerPos]);

  useEffect(() => {
    return () => {
      if (attributionTimerRef.current) clearTimeout(attributionTimerRef.current);
      if (sizeIntervalRef.current) clearInterval(sizeIntervalRef.current);
    };
  }, []);

  // Update canvas cursor based on selected tool
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (tool === DRAWING_TOOL.PAN) {
      canvas.style.cursor = 'grab';
    } else if (tool === DRAWING_TOOL.ERASER) {
      canvas.style.cursor = 'cell';
    } else {
      canvas.style.cursor = 'crosshair';
    }
  }, [tool]);

  // Tool selection handler with per-tool brush size memory
  const selectTool = useCallback((newTool) => {
    setTool(newTool);
    if (toolSizesRef.current[newTool] !== undefined) {
      setBrushSize(toolSizesRef.current[newTool]);
    }
  }, []);

  const adjustBrushSize = useCallback((delta) => {
    setBrushSize((prev) => {
      const next = Math.max(1, Math.min(100, prev + delta));
      if (tool) {
        toolSizesRef.current[tool] = next;
      }
      return next;
    });
  }, [tool]);

  const startSizeInterval = useCallback((delta) => {
    adjustBrushSize(delta);
    if (sizeIntervalRef.current) clearInterval(sizeIntervalRef.current);
    sizeIntervalRef.current = setInterval(() => {
      adjustBrushSize(delta);
    }, 100);
  }, [adjustBrushSize]);

  const stopSizeInterval = useCallback(() => {
    if (sizeIntervalRef.current) {
      clearInterval(sizeIntervalRef.current);
      sizeIntervalRef.current = null;
    }
  }, []);

  const approvedMembers = members
    ? members.filter((m) => m.status === MEMBER_STATUS.APPROVED)
    : [];

  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-[#0a0a0f] overflow-hidden pt-[env(safe-area-inset-top)]">
      {/* Offline / Reconnecting Warning Banner */}
      {!isConnected && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-xs px-3 py-1 flex items-center justify-center gap-1.5 font-medium z-40 animate-pulse">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Realtime connection lost. Reconnecting to room...</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/80 backdrop-blur border-b border-border/50 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowSidebar(!showSidebar)}
            id="btn-toggle-sidebar"
            aria-label="Toggle Room Information Sidebar"
          >
            {showSidebar ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
          <span className="text-sm font-medium hidden sm:block">Draw on Air</span>
          <Badge variant="default" className="text-[10px]">
            {room.room_code}
          </Badge>
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Users className="w-3 h-3" />
            {approvedMembers.length || 1}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Host Clear Canvas Button */}
          {isHost && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setShowClearConfirm(true)}
              id="btn-clear-canvas"
              title="Clear entire canvas"
              aria-label="Clear entire canvas"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Canvas</span>
            </Button>
          )}

          {isHost && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-8 text-xs gap-1"
              onClick={() => setShowEndConfirm(true)}
              id="btn-end-session"
              aria-label="End Room Session"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End Session</span>
            </Button>
          )}
          {!isHost && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setShowLeaveConfirm(true)}
              id="btn-leave-room"
              aria-label="Leave Drawing Room"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Leave Room</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Mobile & Desktop backdrop for sidebar */}
        {showSidebar && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-15"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Sidebar */}
        {showSidebar && (
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card/95 backdrop-blur border-r border-border/50 z-20 overflow-y-auto p-4 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Room Info
            </h3>

            {isHost && joinRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-warning flex items-center gap-1">
                  Pending Requests ({joinRequests.length})
                </p>
                {joinRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2 rounded-lg bg-secondary/50 border border-border/50 space-y-2"
                  >
                    <p className="text-sm font-medium">{req.display_name}</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-7 text-xs flex-1" onClick={() => onApprove(req)}>
                        Allow
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs flex-1"
                        onClick={() => onReject(req)}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Users className="w-3 h-3" />
                Participants ({approvedMembers.length || 1})
              </p>
              {approvedMembers.length > 0 ? (
                approvedMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                      <span className="text-sm truncate">{member.display_name}</span>
                      {member.role === MEMBER_ROLE.HOST && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">Host</Badge>
                      )}
                      {member.user_id === user.id && member.role !== MEMBER_ROLE.HOST && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">You</Badge>
                      )}
                    </div>
                    {isHost && member.role !== MEMBER_ROLE.HOST && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setParticipantToRemove(member)}
                        title={`Remove ${member.display_name}`}
                        aria-label={`Remove participant ${member.display_name}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-sm">{membership?.display_name || 'You'}</span>
                    {isHost && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">Host</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas Area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden select-none">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 touch-none"
            role="img"
            aria-label="Interactive multi-user drawing canvas"
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={(e) => {
              handlePointerMove(e);
              handlePointerMoveForAttribution(e);
            }}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={(e) => {
              handlePointerUp(e);
              setAttribution(null);
            }}
            style={{ touchAction: 'none' }}
          />

          {/* Attribution tooltip */}
          {attribution && (
            <div
              className="absolute z-50 px-3 py-1.5 rounded-lg bg-card/90 border border-border text-xs text-foreground shadow-lg pointer-events-none animate-fade-in"
              style={{
                left: attribution.x,
                top: attribution.y - 40,
                transform: 'translateX(-50%)',
              }}
            >
              Drawn by {attribution.name}
            </div>
          )}

          {/* Floating Zoom & Recenter Controls Overlay */}
          <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 p-1.5 rounded-xl bg-card/90 backdrop-blur border border-border/60 shadow-xl">
            {(zoom !== 1.0 || Math.abs(pan.x) > 50 || Math.abs(pan.y) > 50) && (
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 shadow-sm bg-secondary/80 hover:bg-secondary"
                onClick={handleResetZoom}
                title="Recenter Canvas"
                id="btn-recenter-canvas"
                aria-label="Recenter Canvas view to 100%"
              >
                <Compass className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Recenter</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleZoomOut}
              title="Zoom Out"
              id="btn-zoom-out"
              aria-label="Zoom Out Canvas"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs font-mono font-medium hover:bg-secondary rounded transition-colors"
              title="Reset Zoom to 100%"
              id="btn-zoom-reset"
              aria-label="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleZoomIn}
              title="Zoom In"
              id="btn-zoom-in"
              aria-label="Zoom In Canvas"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-center px-2 py-2 bg-card/80 backdrop-blur border-t border-border/50 z-30 shrink-0 w-full overflow-hidden">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 border border-border/50 max-w-full overflow-x-auto no-scrollbar shrink-0">
          {/* Hand / Pan Tool */}
          <Button
            variant={tool === DRAWING_TOOL.PAN ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 sm:px-3 shrink-0"
            onClick={() => selectTool(DRAWING_TOOL.PAN)}
            id="btn-tool-pan"
            title="Pan canvas (or hold Spacebar)"
            aria-label="Select Pan Tool"
          >
            <Hand className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Pan</span>
          </Button>

          {/* Pen */}
          <Button
            variant={tool === DRAWING_TOOL.PEN ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 sm:px-3 shrink-0"
            onClick={() => selectTool(DRAWING_TOOL.PEN)}
            id="btn-tool-pen"
            aria-label="Select Pen Tool"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Pen</span>
          </Button>

          {/* Marker */}
          <Button
            variant={tool === DRAWING_TOOL.MARKER ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 sm:px-3 shrink-0"
            onClick={() => selectTool(DRAWING_TOOL.MARKER)}
            id="btn-tool-marker"
            aria-label="Select Marker Tool"
          >
            <Highlighter className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Marker</span>
          </Button>

          {/* Eraser */}
          <Button
            variant={tool === DRAWING_TOOL.ERASER ? 'default' : 'ghost'}
            size="sm"
            className="h-8 px-2.5 sm:px-3 shrink-0"
            onClick={() => selectTool(DRAWING_TOOL.ERASER)}
            id="btn-tool-eraser"
            aria-label="Select Eraser Tool"
          >
            <Eraser className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Eraser</span>
          </Button>

          {/* Divider */}
          <div className="w-px h-5 bg-border/50 mx-0.5 sm:mx-1 shrink-0" />

          {/* Color palette selector */}
          {tool !== DRAWING_TOOL.ERASER && tool !== DRAWING_TOOL.PAN && (
            <div className="relative flex items-center gap-1.5 px-0.5 sm:px-1 shrink-0">
              {/* Quick primary colors (first 5) */}
              <div className="hidden md:flex items-center gap-1">
                {COLOR_PALETTE.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-6 h-6 rounded-full transition-all cursor-pointer relative flex items-center justify-center ${
                      color === c
                        ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    title={c}
                    aria-label={`Select color ${c}`}
                  >
                    {color === c && <Check className="w-3 h-3 text-black mix-blend-difference stroke-[3]" />}
                  </button>
                ))}
              </div>

              {/* Color picker toggle button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  className="flex items-center gap-1.5 p-1 pr-2 rounded-lg bg-secondary/80 border border-border/60 hover:bg-secondary transition-all cursor-pointer shadow-sm"
                  onClick={() => setShowColors(!showColors)}
                  id="btn-color-picker"
                  title="More colors"
                  aria-label="Toggle full color palette"
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shadow-inner shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showColors ? 'rotate-180' : ''}`} />
                </button>

                {/* Floating Popover Palette */}
                {showColors && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowColors(false)}
                    />

                    <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 z-50 p-3 rounded-2xl bg-[#12121a]/95 backdrop-blur-xl border border-white/10 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 min-w-[210px]">
                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1 px-0.5">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Select Color
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: color }}
                        />
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                              color === c
                                ? 'scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card shadow-lg'
                                : 'hover:scale-110 hover:shadow'
                            }`}
                            style={{ backgroundColor: c }}
                            onClick={() => {
                              setColor(c);
                              setShowColors(false);
                            }}
                            title={c}
                            aria-label={`Select color ${c}`}
                          >
                            {color === c && (
                              <Check className="w-3.5 h-3.5 text-black mix-blend-difference stroke-[3]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Brush size with hold-to-repeat controls */}
          {tool !== DRAWING_TOOL.PAN && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 touch-manipulation"
                onMouseDown={() => startSizeInterval(-1)}
                onMouseUp={stopSizeInterval}
                onMouseLeave={stopSizeInterval}
                onTouchStart={() => startSizeInterval(-1)}
                onTouchEnd={stopSizeInterval}
                id="btn-size-decrease"
                aria-label="Decrease brush size"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <div className="w-8 text-center text-xs text-muted-foreground font-mono select-none font-medium">
                {brushSize}px
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 touch-manipulation"
                onMouseDown={() => startSizeInterval(1)}
                onMouseUp={stopSizeInterval}
                onMouseLeave={stopSizeInterval}
                onTouchStart={() => startSizeInterval(1)}
                onTouchEnd={stopSizeInterval}
                id="btn-size-increase"
                aria-label="Increase brush size"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Canvas Confirmation */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Clear Entire Canvas?</DialogTitle>
            <DialogDescription>
              This will remove all drawings for everyone in the room. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowClearConfirm(false);
                handleClearCanvas();
              }}
            >
              Clear Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Participant Removal Confirmation */}
      <Dialog open={!!participantToRemove} onOpenChange={() => setParticipantToRemove(null)}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Remove Participant?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong className="text-foreground">{participantToRemove?.display_name}</strong> from the drawing room?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setParticipantToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = participantToRemove;
                setParticipantToRemove(null);
                if (target) onRemoveParticipant(target);
              }}
            >
              Remove Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Session Confirmation */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>End Session?</DialogTitle>
            <DialogDescription>
              This will permanently end the drawing session. All participants will be
              disconnected and the room cannot be restarted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowEndConfirm(false);
                onEndSession();
              }}
            >
              End Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Confirmation */}
      <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Leave Room?</DialogTitle>
            <DialogDescription>
              Your existing drawings will remain, but you won&apos;t be able to draw anymore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowLeaveConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowLeaveConfirm(false);
                onLeave();
              }}
            >
              Leave Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
