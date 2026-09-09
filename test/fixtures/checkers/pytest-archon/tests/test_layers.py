import pytest_archon

def test_domain_does_not_import_infra():
    (
        pytest_archon.archrule("domain isolation")
        .match("myapp.domain.*")
        .should_not_import("myapp.infra.*")
        .check("myapp")
    )
