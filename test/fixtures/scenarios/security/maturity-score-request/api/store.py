"""Data access. Talks to the managed Postgres instance described in infra/."""


class Accounts:
    _rows = {
        "acct-1": {"id": "acct-1", "name": "Northwind", "plan": "pro"},
        "acct-2": {"id": "acct-2", "name": "Contoso", "plan": "free"},
    }

    def all_ids(self):
        return sorted(self._rows)

    def get(self, account_id):
        return self._rows[account_id]

    def update(self, account_id, patch):
        self._rows[account_id].update(patch)
        return self._rows[account_id]


class Reports:
    def render(self, report_id):
        return {"id": report_id, "rows": []}

    def usage_counts(self):
        return {"acct-1": 12045, "acct-2": 311}


accounts = Accounts()
reports = Reports()
