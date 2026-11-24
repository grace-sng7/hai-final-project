
"""Route financial questions to the correct calculator."""

import savings_goal_model
import budget_cash_flow_model
import bill_split_model
import debt_repayment_model

MODELS = {
    "savings_goal": savings_goal_model.calculate,
    "save_for_goal": savings_goal_model.calculate,
    "budget_cash_flow": budget_cash_flow_model.calculate,
    "bill_split": bill_split_model.calculate,
    "debt_repayment": debt_repayment_model.calculate,
}


def calculate(request: dict) -> dict:
    meta = request.get("extraction_meta") or {}
    question_type = meta.get("question_type")

    if question_type in MODELS:
        return MODELS[question_type](request)

    return {
        "status": "unsupported",
        "message": (
            "Please select a supported financial question type: "
            "budget, savings, bill splitting, or debt repayment."
        ),
    }
