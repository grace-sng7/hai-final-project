"""Test bridge: real FastAPI routes, with only the external LLM call stubbed."""
import asyncio
import importlib.util
import json
from pathlib import Path
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('extraction_tests', ROOT / 'tests/python-extraction.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
command = json.load(sys.stdin)
with patch.object(module.extraction_service, '_call_llm', return_value=command.get('model_response')):
    status, body = asyncio.run(module.post(command['path'], command['body']))
json.dump({'status': status, 'body': body}, sys.stdout, allow_nan=False)
