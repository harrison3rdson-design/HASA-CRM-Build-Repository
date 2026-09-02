drop policy if exists "additional service labor write authorized"
  on public.additional_service_labor_items;
drop policy if exists "additional service expense write authorized"
  on public.additional_service_expense_items;

create policy "additional service labor insert authorized"
on public.additional_service_labor_items for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager']));

create policy "additional service labor update authorized"
on public.additional_service_labor_items for update
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create policy "additional service labor delete authorized"
on public.additional_service_labor_items for delete
to authenticated
using (public.has_role(array['owner_admin','project_manager']));

create policy "additional service expense insert authorized"
on public.additional_service_expense_items for insert
to authenticated
with check (public.has_role(array['owner_admin','project_manager']));

create policy "additional service expense update authorized"
on public.additional_service_expense_items for update
to authenticated
using (public.has_role(array['owner_admin','project_manager']))
with check (public.has_role(array['owner_admin','project_manager']));

create policy "additional service expense delete authorized"
on public.additional_service_expense_items for delete
to authenticated
using (public.has_role(array['owner_admin','project_manager']));
