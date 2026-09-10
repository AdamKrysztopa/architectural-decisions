create schema if not exists notifications;
create table notifications.items (id text primary key, payload jsonb not null);
