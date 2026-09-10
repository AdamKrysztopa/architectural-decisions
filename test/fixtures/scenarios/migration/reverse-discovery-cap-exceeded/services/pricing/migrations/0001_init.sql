create schema if not exists pricing;
create table pricing.items (id text primary key, payload jsonb not null);
