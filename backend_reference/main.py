"""Run:  uvicorn main:app --reload --port 8000      (from this folder)
Interactive docs & manual testing:  http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import extraction_service
import savings_model
from contract import CalculateRequest, CalculateResponse, CorrectRequest, ExtractionResponse, ExtractRequest

app = FastAPI(title="Pennyscope backend")
# The frontend talks to us through its own server (no CORS needed), but this makes /docs and direct tests easy.
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/extract", response_model=ExtractionResponse)
def extract(req: ExtractRequest):
    return extraction_service.extract(req.user_message, req.reference_date, req.timezone)


@app.post("/correct", response_model=ExtractionResponse)
def correct(req: CorrectRequest):
    return extraction_service.correct(req.user_message, req.reference_date, req.timezone, req.previous_extraction.model_dump(), req.user_correction)


@app.post("/calculate", response_model=CalculateResponse)
def calculate(req: CalculateRequest):
    # To add a new question type: write another module with the same dict-in/dict-out shape,
    # and choose between models here (e.g. by req.extraction_meta.get("question_type")).
    return savings_model.calculate(req.model_dump())
