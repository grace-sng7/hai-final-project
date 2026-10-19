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


def test_missing_is_never_guessed():
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