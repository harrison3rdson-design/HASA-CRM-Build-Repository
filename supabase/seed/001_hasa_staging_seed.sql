-- HASA Concepts staging seed.
-- Uses recognizable sample data from the approved Proposal 20260152 workflow.
-- Run ONLY in staging/test.

do $$
declare
  v_client uuid;
  v_contact uuid;
  v_proposal uuid;
  v_revision uuid;
begin
  insert into public.clients(company_name,billing_name,email,active)
  values ('Universal Technologies Aruba','Universal Technologies Aruba',null,true)
  returning id into v_client;

  insert into public.contacts(client_id,first_name,last_name,title,is_primary,receives_invoices)
  values (v_client,'Shanon','Inacio','Owner',true,true)
  returning id into v_contact;

  insert into public.proposals(
    proposal_number,client_id,primary_contact_id,project_name,project_location,
    title,proposal_date,status,current_revision,validity_days
  ) values (
    '20260152',v_client,v_contact,'On-site consultation for Playa Linda','Aruba',
    'On-site consultation for Playa Linda',date '2026-08-12','draft',1,15
  ) returning id into v_proposal;

  insert into public.proposal_revisions(
    proposal_id,revision_number,revision_date,professional_fee,estimated_expenses,
    payment_terms,validity_days,billing_method,locked
  ) values (
    v_proposal,1,date '2026-08-12',11530,4390,'NET 15',15,'fixed',false
  ) returning id into v_revision;

  insert into public.proposal_sections(proposal_revision_id,section_type,heading,content,sort_order) values
    (v_revision,'objective','Objectives','Review drawings for accuracy and scale; review ceiling architecture and heights; review conditioned and non-conditioned separations; review existing fire protection devices and fire alarm devices/appliances.',10),
    (v_revision,'consultant_responsibility','Consultant Responsibilities','Arrange travel to Aruba for two employees; provide laser measurement equipment and PPE; provide required software/mobile equipment; add life-safety and egress information; provide updated drawing files.',20),
    (v_revision,'client_responsibility','Client Responsibilities','Provide CAD files, site access, lodging and workspace; reimburse customary and approved project-related expenses not included in the quotation.',30);

  insert into public.proposal_fee_items(proposal_revision_id,description,billing_type,quantity,rate,amount,sort_order)
  values (v_revision,'Professional consulting services','fixed',1,11530,11530,10);

  insert into public.proposal_expense_estimates(
    proposal_revision_id,category,description,estimated_quantity,unit,estimated_rate,estimated_amount,billing_rule,requires_receipt,sort_order
  ) values
    (v_revision,'Airfare','Airfare for two employees',1,'allowance',2400,2400,'actual',true,10),
    (v_revision,'Car rental','Rental vehicle',5,'day',50,250,'actual',true,20),
    (v_revision,'Airport parking','Airport parking',5,'day',30,150,'actual',true,30),
    (v_revision,'Mileage','Mileage',200,'mile',0.70,140,'mileage',false,40),
    (v_revision,'Meals & incidentals','Per diem',5,'day',150,750,'per_diem',false,50),
    (v_revision,'Cellular International','International cellular service',1,'allowance',100,100,'actual',true,60),
    (v_revision,'Software Licensing','Temporary/project software',1,'allowance',200,200,'actual',true,70),
    (v_revision,'Off-site hotel','If required',1,'night',400,400,'actual',true,80);
end $$;
