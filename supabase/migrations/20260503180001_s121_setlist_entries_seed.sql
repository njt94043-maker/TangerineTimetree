-- S121: seed setlist_entries with the band's actual setlist (verbatim from
-- Nathan's Setlist.md). 24 Staples / 3 Party / 5 Classic Rock = 32 rows.
-- Click flags from the y/n column. BPM left null — to be filled in via
-- the APK / Media Server PWA setlist authoring UI.
--
-- Idempotent: only inserts when the table is empty (re-run safe).

insert into public.setlist_entries (list_id, position, title, artist, click_y_n)
select * from (values
  -- Staples (24)
  ('staples',       1::int, 'Sympathy for the devil',         'Rolling Stones',          false),
  ('staples',       2::int, 'Come Together',                  'The Beatles',             true),
  ('staples',       3::int, 'Sultans of swing',               'Dire Straits',            true),
  ('staples',       4::int, 'I shot the sheriff',             'Bob Marley',              true),
  ('staples',       5::int, 'Purple Haze',                    'Jimmy Hendrix',           true),
  ('staples',       6::int, 'Get Back',                       'The Beatles',             false),
  ('staples',       7::int, 'Another one bites the dust',     'Queen',                   true),
  ('staples',       8::int, 'A little less conversation',     'Elvis',                   false),
  ('staples',       9::int, 'Play that funky music white boy','Wild Cherry',             false),
  ('staples',      10::int, 'By the way',                     'Red hot chilli peppers',  false),
  ('staples',      11::int, 'Hard to handle',                 'Black crows',             true),
  ('staples',      12::int, 'Under pressure',                 'Queen',                   false),
  ('staples',      13::int, 'Jumping jack flash',             'Rolling stones',          false),
  ('staples',      14::int, 'Day tripper',                    'The beatles',             false),
  ('staples',      15::int, 'Crazy little thing called love', 'Queen',                   false),
  ('staples',      16::int, 'I feel good',                    'James brown',             false),
  ('staples',      17::int, 'Superstition',                   'Stevie wonder',           true),
  ('staples',      18::int, 'Disco Inferno',                  'The Trammps',             false),
  ('staples',      19::int, 'Proud mary',                     'Tina turner',             false),
  ('staples',      20::int, 'Jonny B Goode',                  'Chuck berry',             false),
  ('staples',      21::int, 'Purple Rain',                    'Prince',                  false),
  ('staples',      22::int, 'Sweet home alabama',             'Lynyrd Skinard',          false),
  ('staples',      23::int, 'Cant stop',                      'Red hot chilli peppers',  false),
  ('staples',      24::int, 'Park life',                      'Blur',                    false),
  -- Party (3)
  ('party',         1::int, 'Dakota',                         'Stereophonics',           false),
  ('party',         2::int, 'Hound dog',                      'Elvis',                   false),
  ('party',         3::int, 'Take me out',                    'Franz ferdinand',         false),
  -- Classic Rock (5)
  ('classic_rock',  1::int, 'Comfortably Numb',               'Pink Floyd',              true),
  ('classic_rock',  2::int, 'Warpigs',                        'Black Sabbath',           true),
  ('classic_rock',  3::int, 'Another Brick in the wall',      'Pink Floyd',              false),
  ('classic_rock',  4::int, 'Sunshine of your love',          'Cream',                   false),
  ('classic_rock',  5::int, 'Dancing in the moonlight',       'Thin lizzy',              true)
) as v(list_id, position, title, artist, click_y_n)
where not exists (select 1 from public.setlist_entries);
