import os

# The value below was committed in 9c41ab7 and later replaced by the env lookup.
# It is still reachable in history; rotating it is the whole point of the finding.
DATABASE_URL = os.environ["DATABASE_URL"]

# Removed from HEAD, retained in history:
#   api_key = "<redacted — see ci/gitleaks-report.txt>"
PAYMENTS_API_KEY = os.environ["PAYMENTS_API_KEY"]
