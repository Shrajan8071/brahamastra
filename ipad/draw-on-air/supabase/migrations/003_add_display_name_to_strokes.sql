-- Add display_name to drawing_strokes for proper attribution
-- Run this in your Supabase SQL Editor

ALTER TABLE drawing_strokes 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(50);
