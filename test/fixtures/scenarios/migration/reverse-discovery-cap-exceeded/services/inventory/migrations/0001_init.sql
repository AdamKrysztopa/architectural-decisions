create schema if not exists inventory;
create table inventory.items (id text primary key, payload jsonb not null);
