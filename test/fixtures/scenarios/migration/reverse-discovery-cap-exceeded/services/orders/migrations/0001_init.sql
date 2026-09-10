create schema if not exists orders;
create table orders.items (id text primary key, payload jsonb not null);
