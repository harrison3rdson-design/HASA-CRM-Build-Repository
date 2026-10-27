-- Transactional integration checks: no client records, proposals or invoices retained.
begin;
do $$
declare c uuid; p uuid; r uuid; a uuid; prop uuid; count_created integer; invoice_id uuid; t jsonb; today date:=(now() at time zone 'America/New_York')::date; anchor date; expected_count integer;
begin
 anchor:=make_date(extract(year from today)::integer,1,31);
 if today<anchor then anchor:=(anchor-interval '1 year')::date; end if;
 select count(*) into expected_count from generate_series(0,11) n where (anchor+make_interval(months=>n))::date<=today;
 select id into strict c from public.clients order by created_at limit 1;
 t:='{"name":"Integration test only","monthlyFee":349,"refreshMonthlyFee":168.75,"termMonths":12,"modelAllowance":15,"maintenanceMinutes":60,"scope":"Test covered property. Transfer and retain 30 days.","refreshScope":"Five visits."}'::jsonb;
 if public.valid_service_terms(t) is not true then raise exception 'Valid terms rejected'; end if;
 if public.valid_service_terms('{}'::jsonb) is true then raise exception 'Missing terms accepted'; end if;
 insert into public.proposals(proposal_number,client_id,project_name,status) values('TEST-'||gen_random_uuid()::text,c,'Temporary digital twin verification','draft') returning id into p;
 insert into public.proposal_revisions(proposal_id,revision_number,service_terms) values(p,1,t) returning id into r;
 begin
   perform public.create_service_agreement(r);
   raise exception 'Unaccepted agreement allowed';
 exception when raise_exception then
   if sqlerrm='Unaccepted agreement allowed' then raise; end if;
 end;
 insert into public.proposal_acceptances(proposal_revision_id,signer_name,acceptance_statement,accepted_at,accepted_snapshot)
 values(r,'Verification fixture','Test only',(anchor-1)::timestamptz,'{"revision":{}}');
 if (select accepted_snapshot->'recurringServices' from public.proposal_acceptances where proposal_revision_id=r) is distinct from t then raise exception 'Recurring terms missing from snapshot'; end if;
 a:=public.create_service_agreement(r);
 if public.create_service_agreement(r)<>a then raise exception 'Duplicate agreement creation'; end if;
 begin
   perform public.activate_service_agreement(a,anchor);
   raise exception 'Empty coverage allowed';
 exception when raise_exception then
   if sqlerrm='Empty coverage allowed' then raise; end if;
 end;
 insert into public.properties(client_id,name,property_type,address) values(c,'Temporary test property','commercial','Test only') returning id into prop;
 perform public.set_service_coverage(a,prop,false);
 perform public.activate_service_agreement(a,anchor);
 if (select ends_on from public.service_agreements where id=a)<>(anchor+interval '1 year')::date then raise exception 'Wrong term end'; end if;
 count_created:=public.generate_service_invoices(a);
 if count_created<>expected_count then raise exception 'Wrong number of due monthly periods: %',count_created; end if;
 if public.generate_service_invoices(a)<>0 then raise exception 'Retry produced duplicates'; end if;
 if (select invoice_date from public.invoices where service_agreement_id=a and service_period=1)<>(anchor+interval '1 month')::date then raise exception 'February month-end incorrect'; end if;
 if (select invoice_date from public.invoices where service_agreement_id=a and service_period=2)<>(anchor+interval '2 months')::date then raise exception 'Billing anchor drifted'; end if;
 if exists(select 1 from public.invoices where service_agreement_id=a and (total<>517.75 or status<>'draft' or due_date is not null)) then raise exception 'Wrong amount, status or premature due date'; end if;
 if (select sum(total) from public.invoices where service_agreement_id=a)<>expected_count*517.75 then raise exception 'Wrong aggregate billing'; end if;
 if public.calculate_invoice_due_date('2026-10-28T02:00:00Z','Due on Receipt')<>'2026-10-27' then raise exception 'Due date timezone incorrect'; end if;
 begin
   perform public.set_service_coverage(a,prop,true);
   raise exception 'Active scope changed';
 exception when raise_exception then
   if sqlerrm='Active scope changed' then raise; end if;
 end;
 perform public.cancel_service_agreement(a);
 if public.generate_service_invoices(a)<>0 then raise exception 'Cancelled agreement billed'; end if;
 if (select count(*) from public.invoices where service_agreement_id=a)<>expected_count then raise exception 'Cancellation altered invoice history'; end if;
 if has_function_privilege('authenticated','public.generate_service_invoices(uuid)','EXECUTE') or has_function_privilege('anon','public.create_service_agreement(uuid)','EXECUTE') then raise exception 'Public billing privilege'; end if;
 if has_table_privilege('anon','public.properties','SELECT') or has_table_privilege('authenticated','public.service_agreements','UPDATE') then raise exception 'Unexpected API write/access privilege'; end if;
end $$;
rollback;
select 'PASS: acceptance snapshot, activation, fixed monthly totals, month-end anchors, idempotency, cancellation, due dates and API privileges; fixtures rolled back' as result;
