const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://jlufqgslgjowfaqmqlds.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdWZxZ3NsZ2pvd2ZhcW1xbGRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAzNzc2MSwiZXhwIjoyMDg1NjEzNzYxfQ.DYY9PeitsdGfXwqJr091bQXqpy_-jdZmhtOF0_wbvTg'
);

(async () => {
  // Get all gigs that have a venue_id
  const { data: gigs } = await sb.from('gigs')
    .select('id, venue, client_name, venue_id, client_id')
    .not('venue_id', 'is', null)
    .order('date');

  // Get all venues
  const { data: venues } = await sb.from('venues').select('id, venue_name');
  const venueNameById = {};
  venues.forEach(v => { venueNameById[v.id] = v.venue_name; });

  // Get all clients
  const { data: clients } = await sb.from('clients').select('id, company_name');
  const clientNameById = {};
  clients.forEach(c => { clientNameById[c.id] = c.company_name; });

  let updated = 0;
  for (const gig of gigs) {
    const canonicalVenue = venueNameById[gig.venue_id];
    const canonicalClient = gig.client_id ? clientNameById[gig.client_id] : null;

    const update = {};
    if (canonicalVenue && canonicalVenue !== gig.venue) {
      update.venue = canonicalVenue;
    }
    if (canonicalClient && canonicalClient !== gig.client_name) {
      update.client_name = canonicalClient;
    }

    if (Object.keys(update).length > 0) {
      const { error } = await sb.from('gigs').update(update).eq('id', gig.id);
      if (error) {
        console.error(`Failed ${gig.id}:`, error.message);
      } else {
        updated++;
        const changes = [];
        if (update.venue) changes.push(`venue: "${gig.venue}" → "${update.venue}"`);
        if (update.client_name) changes.push(`client: "${gig.client_name}" → "${update.client_name}"`);
        console.log(changes.join(' | '));
      }
    }
  }

  console.log(`\nUpdated ${updated} gigs`);
})();
