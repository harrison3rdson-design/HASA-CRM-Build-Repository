-- The draft-deletion RPC runs as the server-only service role and must lock and
-- decrement the private annual proposal-number sequence in the same transaction.
grant usage on schema private to service_role;
grant select, update on table private.proposal_number_sequences to service_role;
