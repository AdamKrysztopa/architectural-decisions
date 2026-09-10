"""Configuration. Every credential is read straight from the environment."""

import os


class Config:
    database_url = os.environ["DATABASE_URL"]
    stripe_api_key = os.environ["STRIPE_API_KEY"]
    mailer_token = os.environ["MAILER_TOKEN"]
