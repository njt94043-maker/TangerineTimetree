-- Session 41: Active gig sessions table for PWA gig discovery
-- When Studio's phone server starts a gig, APK writes a row here.
-- PWAs subscribe via Supabase Realtime to detect active gigs.
CREATE TABLE IF NOT EXISTS active_gig_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid REFERENCES gigs(id) ON DELETE SET NULL,
  studio_ip text NOT NULL,
  ws_port integer NOT NULL DEFAULT 8731,
  pairing_secret text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- RLS: all authenticated users can read; only creator can insert/update
ALTER TABLE active_gig_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active gig sessions"
  ON active_gig_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own active gig sessions"
  ON active_gig_sessions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own active gig sessions"
  ON active_gig_sessions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE active_gig_sessions;
