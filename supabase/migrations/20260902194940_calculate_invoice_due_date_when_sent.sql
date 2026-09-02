create or replace function public.calculate_invoice_due_date(
  p_sent_at timestamptz,
  p_payment_terms text
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days integer;
begin
  if p_sent_at is null then
    return null;
  end if;

  v_days := case p_payment_terms
    when 'NET 15' then 15
    when 'NET 30' then 30
    when 'NET 90' then 90
    else null
  end;

  if v_days is null then
    raise exception 'Payment terms must be NET 15, NET 30, or NET 90.';
  end if;

  return timezone('America/New_York', p_sent_at)::date + v_days;
end;
$$;

create or replace function public.set_invoice_due_date_from_send_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.due_date := public.calculate_invoice_due_date(new.sent_at, new.payment_terms);
  return new;
end;
$$;

drop trigger if exists invoices_calculate_due_date on public.invoices;
create trigger invoices_calculate_due_date
before insert or update of sent_at, payment_terms, due_date
on public.invoices
for each row
execute function public.set_invoice_due_date_from_send_date();

update public.invoices
set due_date = public.calculate_invoice_due_date(sent_at, payment_terms)
where sent_at is not null;

update public.invoices
set due_date = null
where sent_at is null
  and due_date is not null;
