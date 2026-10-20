from backend_reference.savings_goal_model import calculate


def A(var, value, unit="$", source="stated", **extra):
    d = {"variable": var, "value": value, "unit": unit, "source": source, "source_detail": ""}
    d.update(extra)
    return d


def req(*assumptions, **kw):
    return {"assumptions": list(assumptions), "extraction_meta": kw.get("meta", {}),
            "parameters": kw.get("parameters", {}), "extra_inputs": kw.get("extra_inputs", {})}


BASE = [A("monthly_income", 2000, "$/month"), A("monthly_expenses", 1650, "$/month"),
        A("current_savings", 1200), A("goal_amount", 3000), A("goal_deadline", 8, "months")]


def test_matches_contract_example():
    r = calculate(req(*BASE))
    assert r["status"] == "ready" or r["status"] == "conditional"
    assert r["answer"]["headline"] == ("Yes, if you save {monthly_contribution} per month, "
                                       "you'll use $200 from your savings.")
    p = r["parameters"][0]
    assert (p["key"], p["value"], p["min"], p["max"]) == ("monthly_contribution", 350, 0, 350)


def test_slider_value_is_used_and_clamped():
    r = calculate(req(*BASE, parameters={"monthly_contribution": 250}))
    assert r["parameters"][0]["value"] == 250
    assert "short" in r["answer"]["headline"] or "savings" in r["answer"]["headline"]
    r = calculate(req(*BASE, parameters={"monthly_contribution": 9999}))
    assert r["parameters"][0]["value"] == 350


def test_short_goal_gets_options():
    r = calculate(req(A("monthly_income", 2000, "$/month"), A("monthly_expenses", 1650, "$/month"),
                      A("rent", 900, "$/month"), A("dining", 300, "$/month"),
                      A("current_savings", 1200), A("goal_amount", 3000),
                      A("goal_deadline", 4, "months")))
    assert r["answer"]["headline"].startswith("Not yet")
    labels = [e["label"] for e in r["explanations"] if e["label"].startswith("Option:")]
    assert len(labels) == 3


def test_multiple_missing_inputs_request_information():
    r = calculate(req(A("current_savings", 1500), A("goal_amount", 2000)))
    assert r["status"] == "needs_input"
    assert {m["variable"] for m in r["missing_inputs"]} == {
        "monthly_income", "monthly_expenses", "goal_deadline"}


def test_extra_inputs_fill_the_gaps():
    r = calculate(req(A("current_savings", 1500), A("goal_amount", 2000),
                      extra_inputs={"monthly_income": 1800, "monthly_expenses": 1300,
                                    "goal_deadline": 4}))
    assert r["status"] in ("ready", "conditional")


def test_categories_never_added_on_top_of_total():
    r = calculate(req(*BASE, A("monthly_expenses_rent", 900, "$/month"),
                      A("monthly_expenses_food", 300, "$/month")))
    assert r["metrics"][2] == {"label": "Monthly available cash", "value": "$350"}


def test_floor_and_debt_reduce_usable_savings():
    r = calculate(req(*BASE, A("savings_floor_to_keep", 400), A("debt_owed", 300)))
    assert {"label": "Usable savings", "value": "$500"} in r["metrics"]


def test_recurring_goal():
    r = calculate(req(A("monthly_income", 2000, "$/month"), A("monthly_expenses", 1700, "$/month"),
                      A("current_savings", 600), A("goal_amount", 400, "$/month")))
    assert "$100 short each month" in r["answer"]["headline"]
    assert "6 months" in r["answer"]["headline"]


def test_unsupported():
    assert calculate(req(A("goal_amount", 5, "%")))["status"] == "unsupported"
    assert calculate(req(*BASE, meta={"question_type": "other"}))["status"] == "unsupported"


def test_edited_by_user_counts_as_stated():
    inferred = [dict(a, source="inferred") for a in BASE]
    assert calculate(req(*inferred))["status"] == "conditional"


def test_existing_savings_cover_goal_with_no_surplus():
    r = calculate(req(A("monthly_income", 1000, "$/month"), A("monthly_expenses", 1000, "$/month"),
                      A("current_savings", 5000), A("goal_amount", 1000), A("goal_deadline", 3, "months")))
    assert r["answer"]["headline"].startswith("Yes")
    assert "{" not in r["answer"]["headline"]


def test_deficit_can_be_covered_by_savings():
    r = calculate(req(A("monthly_income", 900, "$/month"), A("monthly_expenses", 1000, "$/month"),
                      A("current_savings", 1500), A("goal_amount", 1000), A("goal_deadline", 3, "months")))
    assert r["answer"]["headline"].startswith("Yes")
    assert {"label": "Projected at deadline", "value": "$1,200"} in r["metrics"]


def test_lowered_contribution_gets_actionable_option():
    r = calculate(req(*BASE, parameters={"monthly_contribution": 0}))
    assert "$1,800 short" in r["answer"]["headline"]
    assert any(e["label"] == "Option: Save $350 each month" for e in r["explanations"])


def test_missing_protected_savings_is_not_assumed_zero():
    r = calculate(req(*BASE, A("savings_floor_to_keep", None, source="missing")))
    assert r["status"] == "needs_input"
    assert not r.get("parameters")
    assert r["missing_inputs"][0]["variable"] == "savings_floor_to_keep"


def test_invalid_numbers_are_requested_again():
    for value in (float("nan"), float("inf"), "1-2", "about 2000"):
        r = calculate(req(*[dict(a, value=value) if a["variable"] == "monthly_income" else a for a in BASE]))
        assert r["status"] == "needs_input"
    for value in (0, -1, 1.5):
        r = calculate(req(*[dict(a, value=value) if a["variable"] == "goal_deadline" else a for a in BASE]))
        assert r["status"] == "needs_input"


def test_savings_projection_matches_slider_changes():
    r = calculate(req(*BASE, parameters={"monthly_contribution": 200}))
    assert {"label": "Projected at deadline", "value": "$2,800"} in r["metrics"]
    assert {"label": "Remaining gap", "value": "$200"} in r["metrics"]
    assert {"label": "Monthly cash remaining", "value": "$150"} in r["metrics"]



def test_duplicate_variables_are_not_silently_used():
    assert calculate(req(*BASE, BASE[0]))["status"] == "unsupported"


def test_reserves_cannot_exceed_savings():
    r = calculate(req(*BASE, A("savings_floor_to_keep", 1000), A("debt_owed", 300)))
    assert r["status"] == "needs_input"


def test_negative_optional_values_are_rejected():
    for name in ("savings_floor_to_keep", "debt_owed"):
        assert calculate(req(*BASE, A(name, -100)))["status"] == "needs_input"



def test_laptop_requires_two_answers_before_one_can_be_skipped():
    import copy
    base = [A("current_savings", 1500), A("goal_amount", 2000),
            A("monthly_surplus", None, source="missing"), A("irrelevant", None, source="missing")]
    for remaining, provided, hypothetical in (
        ("goal_deadline", {"monthly_income": 1800, "monthly_expenses": 1300}, 4),
        ("monthly_income", {"monthly_expenses": 1300, "goal_deadline": 4}, 1800),
        ("monthly_expenses", {"monthly_income": 1800, "goal_deadline": 4}, 1300),
    ):
        request = req(*base, extra_inputs=provided)
        original = copy.deepcopy(request)
        initial = calculate(request)
        assert initial["status"] == "needs_input" and not initial.get("parameters")
        assert initial["missing_inputs"][0]["variable"] == remaining
        assert not initial["missing_inputs"][0]["required"]
        request["parameters"] = {"skip_input_" + remaining: 1, "hypothetical_" + remaining: hypothetical}
        before = copy.deepcopy(request)
        result = calculate(request)
        assert result["status"] == "conditional"
        assert len(result["parameters"]) == 1
        assert result["parameters"][0]["key"] == "hypothetical_" + remaining
        assert {"label": "Hypothetical projected at deadline", "value": "$3,500"} in result["metrics"]
        assert "not yet verified" in result["answer"]["headline"]
        assert not result["answer"]["headline"].startswith(("Yes", "No"))
        assert request == before
        assert request["extra_inputs"] == original["extra_inputs"]
        assert request["assumptions"] == original["assumptions"]


def test_two_or_more_unknowns_cannot_be_bypassed_by_skip_parameters():
    for extras in ({}, {"monthly_income": 1800}):
        result = calculate(req(A("goal_amount", 2000), A("current_savings", 1500),
                               extra_inputs=extras, parameters={"explore_unresolved": 1,
                               "skip_input_goal_deadline": 1, "hypothetical_goal_deadline": 4}))
        assert result["status"] == "needs_input"
        assert "answer" not in result and not result.get("parameters")
        assert all(q.get("required", True) for q in result["missing_inputs"])
        assert {"label": "Goal minus current savings (before reserves)", "value": "$500"} in result["metrics"]


def test_skip_permission_does_not_transfer_to_a_different_missing_input():
    result = calculate(req(*[a for a in BASE if a["variable"] != "monthly_income"],
                           parameters={"skip_input_goal_deadline": 1, "explore_unresolved": 1}))
    assert result["status"] == "needs_input"


def test_over_limit_preserves_known_facts():
    r = calculate(req(A("goal_amount", 2000), A("current_savings", 1500),
                      A("savings_floor_to_keep", None, source="missing"), A("debt_owed", None, source="missing")))
    assert r["status"] == "needs_input"
    assert {"label": "Goal minus current savings (before reserves)", "value": "$500"} in r["metrics"]


def test_confirmed_values_replace_hypotheticals_without_persisting_defaults():
    r = calculate(req(*BASE, parameters={"hypothetical_monthly_saving": 9999, "hypothetical_goal_deadline": 60}))
    assert not any(p["key"].startswith("hypothetical_") for p in r["parameters"])
    assert {"label": "Deadline", "value": "8 months"} in r["metrics"]
