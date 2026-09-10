create schema if not exists accounts;
create table accounts.items (id text primary key, payload jsonb not null);
