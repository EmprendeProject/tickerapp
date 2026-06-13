-- ============================================================
-- TickerApp — Supabase SQL Setup
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Organizer Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS organizer_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  org_name        TEXT,
  phone           TEXT,
  payment_phone   TEXT,
  payment_bank    TEXT,
  payment_ci      TEXT,
  email_notifications BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Events
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  date            TIMESTAMPTZ NOT NULL,
  location        TEXT,
  banner_url      TEXT,
  payment_phone   TEXT NOT NULL,
  payment_bank    TEXT NOT NULL,
  payment_ci      TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ticket Types
CREATE TABLE IF NOT EXISTS ticket_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'USD',
  quantity        INTEGER NOT NULL DEFAULT 0,
  sold            INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Orders
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  ticket_type_id      UUID REFERENCES ticket_types(id) ON DELETE SET NULL,
  buyer_name          TEXT NOT NULL,
  buyer_email         TEXT NOT NULL,
  buyer_phone         TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  total_amount        NUMERIC(10,2),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payment_proof_url   TEXT,
  qr_code             TEXT UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;

-- organizer_profiles: only own row
CREATE POLICY "Users can manage own profile" ON organizer_profiles
  FOR ALL USING (auth.uid() = id);

-- events: organizer can manage, anyone can read
CREATE POLICY "Organizers manage own events" ON events
  FOR ALL USING (auth.uid() = organizer_id);

CREATE POLICY "Public can read events" ON events
  FOR SELECT USING (TRUE);

-- ticket_types: organizer manages, public reads
CREATE POLICY "Organizers manage ticket types" ON ticket_types
  FOR ALL USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
  );

CREATE POLICY "Public can read ticket types" ON ticket_types
  FOR SELECT USING (TRUE);

-- orders: organizer reads own, anyone can insert
CREATE POLICY "Anyone can insert orders" ON orders
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Organizers read own orders" ON orders
  FOR SELECT USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
  );

CREATE POLICY "Organizers update own orders" ON orders
  FOR UPDATE USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
  );

-- ============================================================
-- Function: increment sold count
-- ============================================================
CREATE OR REPLACE FUNCTION increment_sold(ticket_type_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE ticket_types
  SET sold = sold + 1
  WHERE id = ticket_type_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Auto-create profile on signup trigger
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO organizer_profiles (id, full_name, org_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'org_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Storage bucket for payment proofs
-- ============================================================
-- Run this in Supabase Dashboard > Storage:
-- 1. Create bucket named "payment-proofs"  (Public: YES)
-- 2. Set max file size to 5MB

-- Storage policy (run after creating bucket):
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Proofs are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs');
