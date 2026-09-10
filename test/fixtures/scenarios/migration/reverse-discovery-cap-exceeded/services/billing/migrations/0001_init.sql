create schema if not exists billing;
create table billing.items (id text primary key, payload jsonb not null);
