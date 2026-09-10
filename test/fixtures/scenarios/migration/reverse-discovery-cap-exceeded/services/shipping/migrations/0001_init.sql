create schema if not exists shipping;
create table shipping.items (id text primary key, payload jsonb not null);
