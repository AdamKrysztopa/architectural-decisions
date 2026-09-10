# Network shape

There is exactly one path to the database: the application server security
group. No bastion, no analyst laptop, no reporting replica. A second reader
would need a new ingress rule in `database.yml`, which is a reviewed change.
