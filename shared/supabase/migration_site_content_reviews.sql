-- Migration: site_content + site_reviews tables
-- Run in Supabase SQL Editor

-- ─── Site Content (editable website text) ───────────────
CREATE TABLE site_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_content" ON site_content FOR SELECT USING (true);
CREATE POLICY "Auth insert site_content" ON site_content FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update site_content" ON site_content FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete site_content" ON site_content FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── Site Reviews ───────────────────────────────────────
CREATE TABLE site_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name text NOT NULL,
  review_text text NOT NULL,
  rating int CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
  source text DEFAULT 'Facebook',
  review_date date,
  visible boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE site_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read visible reviews" ON site_reviews FOR SELECT USING (visible = true);
CREATE POLICY "Auth read all reviews" ON site_reviews FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth insert reviews" ON site_reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update reviews" ON site_reviews FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete reviews" ON site_reviews FOR DELETE USING (auth.uid() IS NOT NULL);

-- ─── Seed Reviews (11 Facebook recommendations) ────────
INSERT INTO site_reviews (author_name, review_text, rating, source, sort_order) VALUES
(
  'Lydia Harley',
  'The absolute best of the best! We had the Green Tangerine perform at our Engagement Party on Saturday night and they were absolutely amazing. What a great bunch of people – nothing was too much trouble. We had the best night celebrating, and our family and friends have given us nothing but positive feedback about the band. We would recommended The Green Tangerine 100 times over and genuinely can''t recommend them enough! A great mix of songs that kept us wanting to dance all night.',
  5, 'Facebook', 0
),
(
  'Thomas Mark Baker',
  'Booked them for my wedding recently and they kept the dancefloor moving all night. Superb musicians delivering a quality set of songs from across the generations - worth proposing to the first person you bump in to just so that you can watch them at your wedding!',
  5, 'Facebook', 1
),
(
  'Liam Protheroe',
  'Booked to see these Saturday night and they didn''t disappoint. Absolutely fantastic band.',
  5, 'Facebook', 2
),
(
  'Mark Evans',
  'We had them in Ystrad Rhondda RFC last night, it was nice to hear a different set list from the usual sex on fire, dakota etc these lads will definitely make a name for themselves. A pleasure to work with and mix for them.',
  5, 'Facebook', 3
),
(
  'Alex Tovey',
  'Seen this in Porthcawl tonight. Really good band, very good choice of songs. Musically very good and superb tones. Would love to see these guys again at the marine in Porthcawl. Super tight band. Keep up the good work guys.',
  5, 'Facebook', 4
),
(
  'Tracy James',
  'Absolutely brilliant band that really know their stuff!! Packed our venue out yesterday. Book them up, you won''t be sorry.',
  5, 'Facebook', 5
),
(
  'LS Stimp',
  'Seen the band multiple times, great live music experience. Highly recommend if you love classic rock. Loved the Led Zeppelin and Dire Straits covers.',
  5, 'Facebook', 6
),
(
  'Ben Ryall',
  'Amazing band, outstanding live experience!',
  5, 'Facebook', 7
),
(
  'Leanne Lewis',
  'We had this band for my husband''s 60th birthday what can I say absolutely outstanding awesome guitarist and singer, all the band was amazing and very organised brill night from start to finish would recommend them to everyone thanks guys',
  5, 'Facebook', 8
),
(
  'Jeff Griffiths',
  'Saw these guys in the Foresters, Blackwood. They stepped in last minute due to illness in the band who were originally booked. They didn''t disappoint. With a lively mix of everything from James Brown to Sabbath and Prince to the Chilli Peppers they kept us all entertained. To top it all off, I found out later that this was only their second gig! Well done guys, I look forward to seeing you again. Keep doing what you do.',
  5, 'Facebook', 9
),
(
  'Chloe Symonds',
  'Wow!! These boys are amazing!! Booked them to play at my pub very last minute due to a cancellation. I took a risk considering it was only their second gig and I was very impressed! Not one bit of negative feedback from a pub full of people, who are usually a tough crowd to please! If you are thinking of booking this band then do it, you won''t be disappointed!! Can''t wait to have them back in the new year!',
  5, 'Facebook', 10
);
