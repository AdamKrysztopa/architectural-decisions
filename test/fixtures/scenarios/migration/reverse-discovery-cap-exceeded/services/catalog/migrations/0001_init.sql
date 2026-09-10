create schema if not exists catalog;
create table catalog.items (id text primary key, payload jsonb not null);
