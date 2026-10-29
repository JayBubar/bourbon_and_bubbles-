-- Donation receipts for auction donors and sponsors, issued by Opa's Learning Academy.

alter table public.companies
  add column receipt_sent_on date,
  add column receipt_sent_by uuid references public.allowed_users (id) on delete set null;

alter table public.settings
  add column org_name text not null default 'Opa''s Learning Academy',
  add column org_ein text not null default '39-3456595',
  add column org_address text,
  add column receipt_signer_name text not null default 'Virginia Wells',
  add column receipt_signer_title text,
  add column tax_status_statement text not null default
    'Opa''s Learning Academy is a tax-exempt organization under Section 501(c)(3) of the Internal Revenue Code. Please keep this letter for your tax records.';
