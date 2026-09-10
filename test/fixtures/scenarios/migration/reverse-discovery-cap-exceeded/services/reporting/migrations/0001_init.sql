create schema if not exists reporting;
create table reporting.items (id text primary key, payload jsonb not null);
