create table invoices (
  id text primary key,
  account_id text not null,
  total_cents integer not null,
  state text not null
);
