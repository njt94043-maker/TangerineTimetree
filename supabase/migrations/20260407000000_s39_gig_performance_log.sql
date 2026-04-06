-- Session 39: Gig performance log — records what was actually played at each gig
-- Frontman calls songs live; Nathan loads them on the prompter; this logs the sequence.

CREATE TABLE gig_performance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  played_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_gpl_gig ON gig_performance_log(gig_id);
CREATE INDEX idx_gpl_song ON gig_performance_log(song_id);

ALTER TABLE gig_performance_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_gpl" ON gig_performance_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_gpl" ON gig_performance_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
