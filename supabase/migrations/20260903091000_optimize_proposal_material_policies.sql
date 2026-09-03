drop policy if exists "proposal materials write authorized"
  on public.proposal_material_items;

create policy "proposal materials insert authorized"
on public.proposal_material_items for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager']));

create policy "proposal materials update authorized"
on public.proposal_material_items for update
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create policy "proposal materials delete authorized"
on public.proposal_material_items for delete
to authenticated
using (public.has_role(array['owner_admin','project_manager']));
