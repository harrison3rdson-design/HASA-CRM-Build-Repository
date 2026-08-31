-- The counter is internal-only. This explicit deny policy provides defense in
-- depth and documents that no API role may read or write it directly.
create policy "proposal number sequence internal only"
on private.proposal_number_sequences
as restrictive
for all
to public
using (false)
with check (false);
