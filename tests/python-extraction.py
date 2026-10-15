"""Offline route checks: no API key or external model request is used.
Run with the backend environment: python -B tests/python-extraction.py
"""
import ast
import asyncio
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend_reference'))
import extraction_service  # noqa: E402
from main import app  # noqa: E402


async def post(path, payload):
    """Exercise FastAPI directly via ASGI without extra HTTP test dependencies."""
    messages = []
    body = json.dumps(payload).encode()

    async def receive():
        return {'type': 'http.request', 'body': body, 'more_body': False}

    async def send(message):
        messages.append(message)

    await app({'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
               'method': 'POST', 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
               'query_string': b'', 'root_path': '', 'headers': [(b'content-type', b'application/json')],
               'server': ('localhost', 8000), 'client': ('127.0.0.1', 12345)}, receive, send)
    status = next(m['status'] for m in messages if m['type'] == 'http.response.start')
    data = b''.join(m.get('body', b'') for m in messages if m['type'] == 'http.response.body')
    return status, json.loads(data)


class ExtractionIntegration(unittest.TestCase):
    def setUp(self):
        self.request = {'user_message': 'I earn $2800 monthly and want to buy a $900 bicycle.',
                        'reference_date': '2026-10-15', 'timezone': 'America/New_York'}
        self.response = {
            'assumptions': [
                {'variable': 'monthly_income', 'value': 2800, 'unit': '$/month', 'source': 'stated', 'source_detail': 'User supplied'},
                {'variable': 'goal_description', 'value': 'Buy a bicycle', 'unit': None, 'source': 'stated', 'source_detail': 'User supplied'},
                {'variable': 'monthly_expenses', 'value': None, 'unit': '$/month', 'source': 'missing', 'source_detail': 'Not supplied'},
            ],
            'clarification_questions': [{'target_variable': 'monthly_expenses', 'question': 'What are your monthly expenses?', 'why_it_matters': 'Needed to assess the budget'}],
            'goal_summary': 'Buy a bicycle', 'confidence_note': 'Offline test fixture',
            'future_metadata': {'preserved': True},
        }

    def test_exact_notebook_prompt(self):
        notebook = json.loads((ROOT / 'show_your_work_extraction.ipynb').read_text())
        nodes = ast.parse(''.join(notebook['cells'][4]['source'])).body
        prompt = next(ast.literal_eval(n.value) for n in nodes if isinstance(n, ast.Assign)
                      and any(isinstance(t, ast.Name) and t.id == 'SYSTEM_PROMPT' for t in n.targets))
        self.assertEqual(extraction_service.SYSTEM_PROMPT, prompt)

    def test_extract_route(self):
        with patch.object(extraction_service, '_call_llm', return_value=self.response) as model:
            status, body = asyncio.run(post('/extract', self.request))
        self.assertEqual(status, 200)
        self.assertEqual(body, self.response)
        prompt = model.call_args.args[0]
        for text in self.request.values():
            self.assertIn(text, prompt)

    def test_correct_route(self):
        corrected = {**self.response, 'clarification_questions': []}
        request = {**self.request, 'previous_extraction': self.response, 'user_correction': 'monthly_expenses: 1600'}
        with patch.object(extraction_service, '_call_llm', return_value=corrected) as model:
            status, body = asyncio.run(post('/correct', request))
        self.assertEqual(status, 200)
        self.assertEqual(body, corrected)
        prompt = model.call_args.args[0]
        for text in [self.request['user_message'], self.request['reference_date'], self.request['timezone'], 'monthly_expenses: 1600', 'previously extracted', 'future_metadata']:
            self.assertIn(text, prompt)

    def test_bad_request_never_calls_model(self):
        with patch.object(extraction_service, '_call_llm') as model:
            status, _ = asyncio.run(post('/extract', {'user_message': 'Missing context'}))
        self.assertEqual(status, 422)
        model.assert_not_called()

    def test_missing_key_fails_before_provider_call(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(extraction_service, '_client', None):
            with self.assertRaises(Exception) as caught:
                extraction_service._get_client()
        self.assertEqual(caught.exception.status_code, 500)
        self.assertEqual(caught.exception.detail, 'OPENROUTER_API_KEY is not set on the server')


if __name__ == '__main__':
    unittest.main()
