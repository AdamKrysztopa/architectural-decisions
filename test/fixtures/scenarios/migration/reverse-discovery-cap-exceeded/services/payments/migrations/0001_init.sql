create schema if not exists payments;
create table payments.items (id text primary key, payload jsonb not null);
