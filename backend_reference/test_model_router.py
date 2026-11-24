
import unittest
import model_router


def request(question_type, values):
    return {
        "original_question": "Test financial calculation",
        "assumptions": [
            {
                "variable": key,
                "value": value,
                "unit": None,
                "source": "stated",
                "source_detail": "Test input",
            }
            for key, value in values.items()
        ],
        "extra_inputs": {},
        "parameters": {},
        "extraction_meta": {"question_type": question_type},
    }


def metrics(result):
    return {
        item["label"]: item["value"]
        for item in result.get("metrics", [])
    }


class TestModels(unittest.TestCase):

    def test_budget(self):
        result = model_router.calculate(request(
            "budget_cash_flow",
            {"monthly_income": 2400, "monthly_spending": 1850},
        ))
        self.assertEqual(result["status"], "ready")
        self.assertEqual(metrics(result)["Monthly surplus"], "$550.00")

    def test_phone_change(self):
        result = model_router.calculate(request(
            "budget_cash_flow",
            {
                "monthly_surplus": 300,
                "replaced_recurring_cost": 45,
                "recurring_cost": 70,
            },
        ))
        self.assertEqual(
            metrics(result)["Projected monthly surplus"], "$275.00"
        )

    def test_equal_split(self):
        result = model_router.calculate(request(
            "bill_split",
            {"total_bill": 96, "participants": 3, "split_method": "equal"},
        ))
        self.assertEqual(result["status"], "ready")
        self.assertEqual(metrics(result)["Person 1"], "$32.00")

    def test_debt_zero_apr(self):
        result = model_router.calculate(request(
            "debt_repayment",
            {"principal_balance": 1200, "apr": 0, "monthly_payment": 200},
        ))
        self.assertEqual(metrics(result)["Estimated payoff months"], "6")

    def test_debt_with_interest(self):
        result = model_router.calculate(request(
            "debt_repayment",
            {"principal_balance": 1000, "apr": 12, "monthly_payment": 510},
        ))
        self.assertEqual(metrics(result)["Estimated payoff months"], "2")
        self.assertEqual(metrics(result)["Total interest"], "$15.00")

    def test_missing_apr(self):
        result = model_router.calculate(request(
            "debt_repayment",
            {"principal_balance": 5000, "monthly_payment": 200},
        ))
        self.assertEqual(result["status"], "needs_input")
        self.assertEqual(result["missing_inputs"][0]["variable"], "apr")


if __name__ == "__main__":
    unittest.main()
