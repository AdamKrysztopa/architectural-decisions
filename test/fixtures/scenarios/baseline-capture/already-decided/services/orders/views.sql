-- The orders service's published contract: one read-only view over its own
-- base tables. Consumers are granted select on this and nothing else.
create or replace view orders_public as
select id, account_id, total_cents, placed_at
from orders
where state <> 'draft';

grant select on orders_public to billing_service;
