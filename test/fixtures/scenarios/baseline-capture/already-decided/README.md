# shop-platform

Two services, one shared database. Cross-service reads go through read-only
views; decision 0001 is active and describes that arrangement.

A broker (Kafka) has since been provisioned for the platform, and the orders
team has asked whether new cross-service reads should still go through views.
