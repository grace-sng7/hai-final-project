"""Offline checks of the LLM-calculates / calculator-verifies pipeline (no API key needed).
Run: python -B tests/python-verification.py
"""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend_reference'))
import verification  # noqa: E402
import savings_goal_model  # noqa: E402
from main import calculate  # noqa: E402
from contract import CalculateRequest  # noqa: E402


def A(var, value, unit='$'):
    return {'variable': var, 'value': value, 'unit': unit, 'source': 'stated', 'source_detail': '', 'edited_by_user': False}


ONE_TIME = [A('monthly_income', 2000, '$/month'), A('monthly_expenses', 1650, '$/month'), A('current_savings', 1200),
            A('goal_amount', 3000), A('goal_deadline', 8, 'months'), A('savings_floor_to_keep', 600)]
RECURRING = [A('monthly_income', 4000, '$/month'), A('monthly_expenses', 3200, '$/month'), A('current_savings', 2000),
             A('goal_amount', 400, '$/month')]
# Correct working for ONE_TIME: surplus 350, usable 600, min saving (3000-600)/8 = 300, feasible (600+350*8=3400).
GOOD = {'goal_type': 'one_time', 'monthly_surplus': 350, 'usable_savings': 600, 'min_monthly_saving': 300, 'feasible': True, 'reasoning': 'ok'}


def req(assumptions, verify=True):
    return CalculateRequest(original_question='q', assumptions=assumptions, verify=verify)


class Verification(unittest.TestCase):
    def test_calculator_figures_one_time(self):
        figs = verification.calculator_figures(savings_goal_model.calculate(req(ONE_TIME).model_dump()))
        self.assertEqual(figs, {'goal_type': 'one_time', 'monthly_surplus': 350, 'usable_savings': 600, 'min_monthly_saving': 300, 'feasible': True})

    def test_calculator_figures_recurring(self):
        figs = verification.calculator_figures(savings_goal_model.calculate(req(RECURRING).model_dump()))
        self.assertEqual((figs['goal_type'], figs['monthly_surplus'], figs['new_surplus'], figs['feasible']), ('recurring', 800, 400, True))

    def test_llm_matches(self):
        with patch.object(verification, 'llm_calculate', return_value=GOOD):
            out = calculate(req(ONE_TIME))
        self.assertEqual(out['verification']['status'], 'match')
        self.assertTrue(all(c['match'] for c in out['verification']['checked']))

    def test_mismatch_calculator_wins(self):
        wrong = {**GOOD, 'usable_savings': 1200, 'min_monthly_saving': 225}   # forgot the savings floor
        with patch.object(verification, 'llm_calculate', return_value=wrong):
            out = calculate(req(ONE_TIME))
        v = out['verification']
        self.assertEqual(v['status'], 'mismatch')
        self.assertEqual({c['key'] for c in v['checked'] if not c['match']}, {'usable_savings', 'min_monthly_saving'})
        # The answer the user sees is the calculator's, unchanged.
        self.assertEqual(out['answer'], savings_goal_model.calculate(req(ONE_TIME).model_dump())['answer'])

    def test_within_tolerance_counts_as_match(self):
        with patch.object(verification, 'llm_calculate', return_value={**GOOD, 'min_monthly_saving': 300.4}):
            self.assertEqual(calculate(req(ONE_TIME))['verification']['status'], 'match')

    def test_llm_unavailable_does_not_block_answer(self):
        with patch.object(verification, 'llm_calculate', side_effect=RuntimeError('no key')):
            out = calculate(req(ONE_TIME))
        self.assertEqual(out['verification']['status'], 'unavailable')
        self.assertIn(out['status'], ('ready', 'conditional'))

    def test_no_llm_call_without_verify(self):
        with patch.object(verification, 'llm_calculate') as llm:
            out = calculate(req(ONE_TIME, verify=False))
        llm.assert_not_called()
        self.assertNotIn('verification', out)

    def test_no_llm_call_when_inputs_missing(self):
        with patch.object(verification, 'llm_calculate') as llm:
            out = calculate(req(ONE_TIME[:2]))
        llm.assert_not_called()
        self.assertEqual(out['status'], 'needs_input')


if __name__ == '__main__':
    unittest.main()
