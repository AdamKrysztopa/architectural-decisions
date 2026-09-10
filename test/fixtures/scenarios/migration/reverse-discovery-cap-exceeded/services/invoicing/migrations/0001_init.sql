create schema if not exists invoicing;
create table invoicing.items (id text primary key, payload jsonb not null);
