"""Pydantic models = the machine-readable version of BACKEND_CONTRACT.md. Do not rename fields."""
from __future__ import annotations
from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, ConfigDict, Field

Value = Union[float, int, str, None]


# ---------- /extract and /correct (Grace) ----------
class ExtractRequest(BaseModel):
    user_message: str
    reference_date: str      # "YYYY-MM-DD", the user's "today"
    timezone: str


class Assumption(BaseModel):
    model_config = ConfigDict(extra="allow")
    variable: str
    value: Value = None
    unit: Optional[str] = None
    source: Literal["stated", "inferred", "missing"]
    source_detail: str


class ClarificationQuestion(BaseModel):
    model_config = ConfigDict(extra="allow")
    target_variable: str
    question: str
    why_it_matters: str


class ExtractionResponse(BaseModel):
    model_config = ConfigDict(extra="allow")   # new top-level fields (e.g. question_type) are passed through
    assumptions: list[Assumption]
    clarification_questions: list[ClarificationQuestion]
    goal_summary: str
    confidence_note: str


class CorrectRequest(ExtractRequest):
    previous_extraction: ExtractionResponse
    user_correction: str


# ---------- /calculate (calculation teammate) ----------
class WireAssumption(BaseModel):
    variable: str
    value: Value = None
    unit: Optional[str] = None
    source: Literal["stated", "inferred", "missing"]
    source_detail: str
    edited_by_user: bool = False


class FreeAnswer(BaseModel):
    target_variable: str
    question: str
    answer: str


class CalculateRequest(BaseModel):
    original_question: str
    assumptions: list[WireAssumption]
    extra_inputs: dict[str, Union[float, int, str]] = Field(default_factory=dict)
    answers: list[FreeAnswer] = Field(default_factory=list)
    parameters: dict[str, float] = Field(default_factory=dict)
    extraction_meta: dict[str, Any] = Field(default_factory=dict)


class MissingInput(BaseModel):
    required: bool = True
    variable: str
    label: Optional[str] = None
    unit: Optional[str] = None
    help: Optional[str] = None
    input_type: Optional[Literal["number", "text", "date"]] = None


class Parameter(BaseModel):
    key: str                      # letters, digits, _ or - only
    label: str
    value: float
    unit: Optional[str] = None    # "$" shows a currency symbol
    min: Optional[float] = None
    max: Optional[float] = None   # give BOTH min and max to get a slider
    step: Optional[float] = None


class Answer(BaseModel):
    headline: str                 # may contain {parameter_key} placeholders
    detail: Optional[str] = None


class SystemAssumptionOut(BaseModel):
    id: Optional[str] = None
    text: str
    parameter_key: Optional[str] = None
    review_label: Optional[str] = None


class LabelValue(BaseModel):
    label: str
    value: str


class LabelText(BaseModel):
    label: str
    text: str


class CalculateResponse(BaseModel):
    status: Literal["ready", "conditional", "needs_input", "unsupported"]
    message: Optional[str] = None            # REQUIRED for needs_input / unsupported
    answer: Optional[Answer] = None          # REQUIRED for ready / conditional
    missing_inputs: list[MissingInput] = Field(default_factory=list)
    parameters: list[Parameter] = Field(default_factory=list)
    metrics: list[LabelValue] = Field(default_factory=list)
    explanations: list[LabelText] = Field(default_factory=list)
    assumptions: list[SystemAssumptionOut] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
