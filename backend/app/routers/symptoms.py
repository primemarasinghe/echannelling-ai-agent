"""AI-powered symptom analyser — generates follow-up questions and lab test suggestions."""
import json
import logging

from fastapi import APIRouter, HTTPException
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/api/symptoms", tags=["symptoms"])
_log = logging.getLogger(__name__)


# Standard lab test catalog — Nawaloka Hospital price list
LAB_CATALOG = [
    {"code": "FBC",         "name": "Full Blood Count (FBC)",               "price": 950},
    {"code": "ESR",         "name": "Erythrocyte Sedimentation Rate (ESR)", "price": 600},
    {"code": "CRP",         "name": "C-Reactive Protein (CRP)",             "price": 1450},
    {"code": "LFT",         "name": "Liver Function Test (LFT)",            "price": 2800},
    {"code": "RFT",         "name": "Renal Function Test (RFT)",            "price": 3200},
    {"code": "FBS",         "name": "Fasting Blood Sugar (FBS)",            "price": 600},
    {"code": "HBA1C",       "name": "Glycated Haemoglobin (HbA1c)",         "price": 2200},
    {"code": "TFT",         "name": "Thyroid Function Test (T3, T4, TSH)",  "price": 3800},
    {"code": "LIPID",       "name": "Lipid Profile",                        "price": 2200},
    {"code": "UFR",         "name": "Urine Full Report (UFR)",              "price": 700},
    {"code": "ECG",         "name": "Electrocardiogram (ECG)",              "price": 1600},
    {"code": "CXRAY",       "name": "Chest X-Ray",                          "price": 2200},
    {"code": "VITD",        "name": "Vitamin D (25-OH)",                    "price": 3800},
    {"code": "DENGUE",      "name": "Dengue NS1 Antigen",                   "price": 2800},
    {"code": "STOOL",       "name": "Stool Full Report",                    "price": 850},
    {"code": "URICACID",    "name": "Serum Uric Acid",                      "price": 900},
    {"code": "CREATININE",  "name": "Serum Creatinine",                     "price": 850},
    {"code": "ELECTROLYTES","name": "Serum Electrolytes",                   "price": 1800},
    {"code": "FERRITIN",    "name": "Serum Ferritin",                       "price": 2600},
    {"code": "VITB12",      "name": "Vitamin B12",                          "price": 3200},
    {"code": "HB",          "name": "Haemoglobin (Hb)",                     "price": 600},
    {"code": "BLOODFILM",   "name": "Peripheral Blood Film",                "price": 1200},
    {"code": "MALARIA",     "name": "Malaria Antigen Test",                 "price": 2400},
    {"code": "WIDAL",       "name": "Widal Test (Typhoid)",                 "price": 1600},
    {"code": "URINE_CS",    "name": "Urine Culture & Sensitivity",          "price": 2200},
]

_CODE_MAP = {t["code"]: t for t in LAB_CATALOG}


def _llm():
    s = get_settings()
    return ChatOpenAI(
        model=s.openai_chat_model,
        api_key=s.openai_api_key,
        temperature=0,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


class QuestionsRequest(BaseModel):
    symptoms: list[str]
    body_areas: dict[str, list[str]]
    patient_name: str
    age: str
    gender: str


class AnalyzeRequest(BaseModel):
    symptoms: list[str]
    body_areas: dict[str, list[str]]
    patient_name: str
    age: str
    gender: str
    answers: dict[str, str]


@router.post("/questions")
def generate_questions(req: QuestionsRequest):
    symptoms_str = ", ".join(req.symptoms)
    areas_str = "; ".join(
        f"{s}: {', '.join(a)}" for s, a in req.body_areas.items() if a
    ) or "not specified"
    first_name = req.patient_name.split()[0] if req.patient_name else "the patient"

    prompt = f"""You are a clinical intake assistant at Nawaloka Hospital, Sri Lanka.

Patient: {req.patient_name}, {req.age} years old, {req.gender}
Symptoms reported: {symptoms_str}
Body areas affected: {areas_str}

Generate a structured clinical intake assessment. Return this exact JSON:

{{
  "potential_differentials": [
    "plain-language condition 1",
    "plain-language condition 2",
    "plain-language condition 3",
    "plain-language condition 4",
    "plain-language condition 5"
  ],
  "questions": [
    {{
      "id": "q1",
      "text": "A critical yes/no red-flag question about sudden or severe onset",
      "type": "yesno",
      "options": ["Yes", "No"]
    }},
    {{
      "id": "q2",
      "text": "Duration question using the patient first name ({first_name})",
      "type": "single",
      "options": ["Less than 1 day", "1 to 3 days", "4 to 7 days", "More than 1 week", "It comes and goes over many weeks"]
    }},
    {{
      "id": "q3",
      "text": "Character or nature of the main symptom — specific to THESE symptoms",
      "type": "single",
      "options": ["4 to 5 descriptive options relevant to these exact symptoms"]
    }},
    {{
      "id": "q4",
      "text": "Do you have any of these along with your symptoms?",
      "type": "multi",
      "options": ["6 to 8 associated symptoms that distinguish between the differentials above", "None of these"]
    }},
    {{
      "id": "q5",
      "text": "Has anything brought on or worsened your symptoms?",
      "type": "multi",
      "options": ["5 to 7 triggers or aggravating factors relevant to these symptoms", "Nothing clear"]
    }}
  ]
}}

Rules:
- Questions must be tailored to THESE exact symptoms and body areas — not generic
- q3 options must describe the specific character of THESE symptoms
- q4 options should be co-symptoms that clinically distinguish between the differentials
- potential_differentials must be brief plain English (e.g. "Stress or tension headache" not "Tension-type cephalalgia")
- Use the patient first name naturally in q2
- Write clearly — no medical jargon"""

    try:
        result = _llm().invoke([HumanMessage(content=prompt)])
        data = json.loads(result.content)
        return {
            "potential_differentials": data.get("potential_differentials", []),
            "questions": data.get("questions", []),
        }
    except Exception as exc:
        _log.error("Questions generation failed: %s", exc)
        raise HTTPException(500, "Could not generate questions. Please try again.")


@router.post("/analyze")
def analyze_symptoms(req: AnalyzeRequest):
    symptoms_str  = ", ".join(req.symptoms)
    areas_str     = "; ".join(
        f"{s}: {', '.join(a)}" for s, a in req.body_areas.items() if a
    )
    qa_str = "\n".join(f"Q: {q}\nA: {a}" for q, a in req.answers.items())
    catalog_str = "\n".join(
        f"- {t['code']}: {t['name']} (Rs. {t['price']})" for t in LAB_CATALOG
    )

    prompt = f"""You are a clinical decision support assistant at Nawaloka Hospital, Sri Lanka.

Patient: {req.patient_name}, {req.age} years old, {req.gender}
Symptoms: {symptoms_str}
Body areas: {areas_str}
Responses to follow-up questions:
{qa_str}

Available lab tests (use EXACT codes):
{catalog_str}

Provide a structured clinical assessment. Return JSON:
{{
  "conditions": [
    {{"name": "Condition", "likelihood": "High|Medium|Low", "description": "One sentence description"}}
  ],
  "lab_tests": [
    {{"code": "EXACT_CODE", "reason": "Why this test is needed (one sentence)"}}
  ],
  "specialist": "Recommended specialist type",
  "urgency": "Routine|Soon|Urgent",
  "urgency_note": "One sentence explaining urgency level",
  "disclaimer": "This analysis is AI-generated and not a substitute for professional medical advice."
}}

Rules:
- List 2-4 most likely conditions in order of likelihood
- Recommend 3-7 lab tests using exact codes from the catalog above
- urgency "Urgent" only for red-flag symptoms (chest pain, severe SOB, etc.)
- Always keep the disclaimer exactly as shown"""

    try:
        result = _llm().invoke([HumanMessage(content=prompt)])
        data = json.loads(result.content)

        # Enrich tests with catalog data
        enriched = []
        for lt in data.get("lab_tests", []):
            code = lt.get("code", "").upper()
            if code in _CODE_MAP:
                enriched.append({
                    **_CODE_MAP[code],
                    "reason": lt.get("reason", ""),
                    "selected": True,
                })

        return {
            "conditions":    data.get("conditions", []),
            "lab_tests":     enriched,
            "specialist":    data.get("specialist", "General Practitioner"),
            "urgency":       data.get("urgency", "Routine"),
            "urgency_note":  data.get("urgency_note", ""),
            "disclaimer":    data.get("disclaimer",
                "This analysis is AI-generated and not a substitute for professional medical advice."),
        }
    except Exception as exc:
        _log.error("Analysis failed: %s", exc)
        raise HTTPException(500, "Could not complete analysis. Please try again.")


@router.get("/catalog")
def get_catalog():
    return {"tests": LAB_CATALOG}
