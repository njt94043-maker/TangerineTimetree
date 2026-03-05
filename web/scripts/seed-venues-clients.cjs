const { createClient } = require('@supabase/supabase-js');
// Requires SUPABASE_SERVICE_ROLE_KEY env var
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const sb = createClient('https://jlufqgslgjowfaqmqlds.supabase.co', serviceKey);

// === VENUE DEFINITIONS ===
// Canonical name → all text variants that should match
const VENUES = [
  { name: 'Gin & Juice, Mumbles', variants: ['gin and juice', 'gin & juice', 'gin & juice, mumbles', 'gin and juice mumbles'] },
  { name: 'Ludo Bar, Cardiff', variants: ['ludo bar - cardiff', 'ludo bar, cardiff', 'ludo bar cardiff'] },
  { name: 'Potters, Newport', variants: ['potters newport', 'potters, newport'] },
  { name: 'Ystrad RFC', variants: ['ystrad rfc', 'ystrad rfc'] },
  { name: 'The Hanbury, Bargoed', variants: ['hanbury', 'hanbury arms bargoed', 'hanbury bargoed', 'the hanbury, bargoed', 'the hanbury bargoed'] },
  { name: 'The Hanbury, Swansea', variants: ['hanbury swansea', 'the hanbury, swansea', 'hanbury swanseaneedpa'] },
  { name: 'New Foresters', variants: ['foresters', 'the foresters', 'new foresters'] },
  { name: 'Three Compasses, Clydach', variants: ['three compasses, clydach', 'three compasses clydach'] },
  { name: 'Kings Arms, Caerphilly', variants: ['kings arms, caerphilly', 'kings arms caerphilly'] },
  { name: 'The Haywain, Brackla', variants: ['the haywain, brackla', 'the haywain brackla'] },
  { name: 'Riverside Holiday Park', variants: ['riverside holiday park'] },
  { name: 'Snooks', variants: ['snooks'] },
  { name: 'The Foundry Social, Cardiff', variants: ['foundry social cardiff', 'the foundry social - cardiff', 'the foundry social cardiff'] },
  { name: 'North Star, Cardiff', variants: ['north star gig- cardiff', 'north star cardiff', 'north star gig cardiff'] },
  { name: 'The Marine, Porthcawl', variants: ['marine - porthcawl', 'the marine, porthcawl', 'marine porthcawl'] },
  { name: 'Earl Haig', variants: ['hosting earl haig jam night', 'jam night earl haig', 'earl haig'] },
  { name: 'Forgeside RFC, Blaenavon', variants: ['forgeside rfc blaenavon', 'forgeside blaenavon', 'blaenavon forgeside'] },
  { name: 'Albert Hall, Swansea', variants: ['albert hall, swansea', 'albert hall swansea'] },
  { name: 'Tondu RFC', variants: ['tondu rfc'] },
  { name: 'Tondu Cricket Club', variants: ['tondu cricket club'] },
  { name: 'PILCS, Torfaen', variants: ['pilcs, torfaen', 'pilcs torfaen'] },
  { name: 'Sarn Workingmens Club', variants: ['sarn workingmens club', 'sarn social club beer garden', 'sarn social club (beer garden'] },
  { name: 'Three Horse Shoes, Bridgend', variants: ['three horse shoes, bridgend', 'three horse shoes bridgend'] },
  { name: 'Bryngarw House', variants: ['bryngarw house'] },
  { name: 'Beddau RFC', variants: ['beddau rfc'] },
  { name: "Murray's, Bargoed", variants: ["murrays, bargoed", "murrays bargoed"] },
  { name: 'The Old House 1147', variants: ['the old house 1147'] },
  { name: 'Bonnie Rogues, Swansea', variants: ['bonnie rogues, swansea', 'bonnie rogues swansea'] },
  { name: 'Abercwmboi Festival', variants: ['abercwmboi festival'] },
  { name: 'Ancient Briton', variants: ['ancient briton'] },
  { name: 'The Pheasant, Pen Y Fai', variants: ['the pheasant, pen y fai', 'the pheasant pen y fai'] },
  { name: 'King Arthur Hotel, Gower', variants: ['king arthur hotel, gower', 'king arthur hotel gower'] },
  { name: 'Nottage, Porthcawl', variants: ['nottage, porthcawl', 'nottage porthcawl'] },
  { name: 'The Exchange, Risca', variants: ['the exchange risca'] },
  { name: 'Valley Tavern, Blackwood', variants: ['valley tavern fluer de lis blackwood'] },
  { name: 'Maerdy Working Mens Club', variants: ['maerdy shot'] },
  { name: 'Bar Red', variants: ['bar red'] },
  { name: "Workman's Top Club, Cwmaman", variants: ["workmans top club cwmaman"] },
  { name: 'Abercarn Top Club', variants: ['abercarn top club'] },
  { name: 'Abertysswg Rugby Club', variants: ['abertysswg rugby club'] },
  { name: 'Ferndale Labour Club', variants: ['ferndale labour'] },
  { name: 'District Club', variants: ['district club'] },
  { name: 'Hibernia, Gelli', variants: ['hibernia gelli 300'] },
  { name: 'Skinny Dog', variants: ['skinny dog'] },
  { name: 'Three Brass Monkeys, Swansea', variants: ['three brass monkeys swansea'] },
  { name: 'Black Horse Inn', variants: ['black horse inn sa4 0un'] },
  { name: 'Baden, Ynyshir', variants: ['baden ynyshir'] },
  { name: 'Dowlais RFC', variants: ['dowlais rfc'] },
  { name: 'Newton Festival', variants: ['newton fest'] },
  { name: 'Ynysybwl RFC', variants: ['yynysybwl rfc'] },
  { name: 'Llanarth Club', variants: ['llanarth club party'] },
  { name: 'Prince of Wales, Treorchy', variants: ['prince of wales treorchy'] },
  { name: 'Monkey Club, Pandy', variants: ['monkey club pandy'] },
  { name: 'Heritage Park Hotel, Trehafod', variants: ['thoms wedding'] },
  { name: 'Port Talbot RFC', variants: ['callum port talbot rfc'] },
  { name: 'Volkswagen Event', variants: ['volkswagen event'] },
  { name: 'Green Rooms', variants: ['green rooms'] },
  { name: "Steve's Jam Night", variants: ["steves jam night"] },
  { name: 'Num Club', variants: ['num club'] },
  { name: 'Snooker Club', variants: ['snooker club'] },
  { name: 'Plasmarl', variants: ['plasmarl sa1 2fa'] },
  { name: 'Swansea Stadium', variants: ['swansea stadium'] },
  { name: 'Imps Christmas Bonanza', variants: ['imps christmas bonanza'] },
  { name: 'Charity Gig, Porthcawl', variants: ['charity gig porthcawl'] },
  { name: 'Ferndale Conservative Club', variants: ['halloween party ferndale con'] },
];

// === CLIENT OVERRIDES ===
// venue text → which client to link (when it's NOT "venue = client")
const CLIENT_OVERRIDES = {
  'ludo bar - cardiff': 'Suave Agency',
  'ludo bar, cardiff': 'Suave Agency',
  'potters newport': "Young & Co's Brewery PLC",
  'potters, newport': "Young & Co's Brewery PLC",
  'thoms wedding': 'Thomas (Wedding)',
  'callum port talbot rfc': 'Port Talbot RFC',
  'bryngarw house': null, // Private Party - create client from gig client_name
  'the pheasant, pen y fai': null, // Harri (Private Party) - create from gig client_name
  'king arthur hotel, gower': null, // Ellen Callahan - create from gig client_name
  'tbc suave wedding': 'Suave Agency', // TBC (Suave Wedding) - no venue, just client
  'private gig bridgend': null, // no venue data
};

const NATHAN_ID = 'f30962b3-2588-4b3d-827a-69b03bdfa6b1';

// Normalize venue text for matching
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

(async () => {
  // 1. Get all gigs
  const { data: gigs, error: ge } = await sb.from('gigs').select('id, venue, client_name, date, gig_type').order('date');
  if (ge) { console.error('Failed to get gigs:', ge); return; }
  console.log(`Loaded ${gigs.length} gigs\n`);

  // 2. Get existing venues and clients
  const { data: existingVenues } = await sb.from('venues').select('id, venue_name');
  const { data: existingClients } = await sb.from('clients').select('id, company_name');
  console.log(`Existing: ${existingVenues.length} venues, ${existingClients.length} clients\n`);

  // 3. Delete existing venues (we're doing a clean seed)
  if (existingVenues.length > 0) {
    const { error: dve } = await sb.from('venues').delete().in('id', existingVenues.map(v => v.id));
    if (dve) console.error('Failed to delete existing venues:', dve);
    else console.log(`Deleted ${existingVenues.length} existing venues`);
  }

  // 4. Create all venues
  const venueIdMap = {}; // normalized variant → venue id
  let createdVenues = 0;
  for (const vdef of VENUES) {
    const { data: venue, error: ve } = await sb.from('venues').insert({ venue_name: vdef.name, created_by: NATHAN_ID }).select().single();
    if (ve) { console.error(`Failed to create venue "${vdef.name}":`, ve); continue; }
    createdVenues++;
    for (const variant of vdef.variants) {
      venueIdMap[normalize(variant)] = venue.id;
    }
    // Also map the canonical name
    venueIdMap[normalize(vdef.name)] = venue.id;
  }
  console.log(`Created ${createdVenues} venues\n`);

  // 5. Build client map (existing + new)
  const clientIdMap = {}; // company_name → id
  // Re-fetch clients (some may have been created during testing)
  const { data: clients2 } = await sb.from('clients').select('id, company_name');
  clients2.forEach(c => { clientIdMap[c.company_name] = c.id; });

  // 6. Link gigs
  let linked = 0, skipped = 0, clientsCreated = 0;
  for (const gig of gigs) {
    if (!gig.venue) { skipped++; continue; }

    const norm = normalize(gig.venue);
    const venueId = venueIdMap[norm] || null;

    // Determine client
    let clientId = null;
    const override = CLIENT_OVERRIDES[norm];

    if (override === undefined) {
      // No override — venue IS the client
      // Use gig.client_name if available, otherwise venue name
      const clientName = gig.client_name || null;
      if (clientName && clientName !== 'TBC') {
        if (!clientIdMap[clientName]) {
          // Create client
          const { data: newClient, error: ce } = await sb.from('clients').insert({ company_name: clientName, created_by: NATHAN_ID }).select().single();
          if (ce) { console.error(`Failed to create client "${clientName}":`, ce); }
          else { clientIdMap[clientName] = newClient.id; clientsCreated++; }
        }
        clientId = clientIdMap[clientName] || null;
      }
    } else if (override === null) {
      // Use gig's own client_name
      const clientName = gig.client_name;
      if (clientName && clientName !== 'TBC') {
        if (!clientIdMap[clientName]) {
          const { data: newClient, error: ce } = await sb.from('clients').insert({ company_name: clientName, created_by: NATHAN_ID }).select().single();
          if (ce) { console.error(`Failed to create client "${clientName}":`, ce); }
          else { clientIdMap[clientName] = newClient.id; clientsCreated++; }
        }
        clientId = clientIdMap[clientName] || null;
      }
    } else {
      // Specific client override (Suave, Youngs, etc.)
      if (!clientIdMap[override]) {
        const { data: newClient, error: ce } = await sb.from('clients').insert({ company_name: override, created_by: NATHAN_ID }).select().single();
        if (ce) { console.error(`Failed to create client "${override}":`, ce); }
        else { clientIdMap[override] = newClient.id; clientsCreated++; }
      }
      clientId = clientIdMap[override] || null;
    }

    // Update gig
    const update = {};
    if (venueId) update.venue_id = venueId;
    if (clientId) update.client_id = clientId;

    if (Object.keys(update).length > 0) {
      const { error: ue } = await sb.from('gigs').update(update).eq('id', gig.id);
      if (ue) { console.error(`Failed to update gig ${gig.date} "${gig.venue}":`, ue); }
      else { linked++; }
    } else {
      skipped++;
    }
  }

  console.log(`\n=== RESULTS ===`);
  console.log(`Venues created: ${createdVenues}`);
  console.log(`Clients created: ${clientsCreated}`);
  console.log(`Gigs linked: ${linked}`);
  console.log(`Gigs skipped (no venue/TBC): ${skipped}`);

  // 7. Verify
  const { data: finalVenues } = await sb.from('venues').select('id, venue_name');
  const { data: finalClients } = await sb.from('clients').select('id, company_name');
  const { data: linkedGigs } = await sb.from('gigs').select('id').not('venue_id', 'is', null);
  console.log(`\nFinal: ${finalVenues.length} venues, ${finalClients.length} clients, ${linkedGigs.length} gigs with venue_id`);
})();
