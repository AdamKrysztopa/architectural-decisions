create schema if not exists checkout;
create table checkout.items (id text primary key, payload jsonb not null);
