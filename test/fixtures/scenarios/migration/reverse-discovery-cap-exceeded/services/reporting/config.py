"""reporting configuration. Every value is declared here, read from the environment."""

from libs.platform.config import optional, required

DATABASE_URL = required("REPORTING_DATABASE_URL")
LOG_LEVEL = optional("LOG_LEVEL", "info")
