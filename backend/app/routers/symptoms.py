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


LAB_CATALOG = [
    {"code": "FBC",          "name": "Full Blood Count (FBC)",               "price": 950,  "indicates": "infection, anaemia, dengue, blood disorders, fever workup"},
    {"code": "ESR",          "name": "Erythrocyte Sedimentation Rate (ESR)", "price": 600,  "indicates": "chronic inflammation, autoimmune, TB, arthritis"},
    {"code": "CRP",          "name": "C-Reactive Protein (CRP)",             "price": 1450, "indicates": "acute bacterial infection, inflammation severity monitoring"},
    {"code": "LFT",          "name": "Liver Function Test (LFT)",            "price": 2800, "indicates": "jaundice, RUQ pain, hepatitis, alcohol history, nausea with abdominal pain"},
    {"code": "RFT",          "name": "Renal Function Test (RFT)",            "price": 3200, "indicates": "kidney disease, electrolyte imbalance, hypertension, oedema"},
    {"code": "FBS",          "name": "Fasting Blood Sugar (FBS)",            "price": 600,  "indicates": "diabetes screening, fatigue, frequent urination, excessive thirst"},
    {"code": "HBA1C",        "name": "Glycated Haemoglobin (HbA1c)",         "price": 2200, "indicates": "diabetes monitoring, unexplained fatigue with urinary symptoms"},
    {"code": "TFT",          "name": "Thyroid Function Test (T3, T4, TSH)",  "price": 3800, "indicates": "fatigue, weight change, hair loss, cold intolerance, palpitations, anxiety"},
    {"code": "LIPID",        "name": "Lipid Profile",                        "price": 2200, "indicates": "cardiovascular risk, chest pain, age >40, family history of heart disease"},
    {"code": "UFR",          "name": "Urine Full Report (UFR)",              "price": 700,  "indicates": "UTI, burning urination, flank pain, diabetes, kidney stones, frequent urination"},
    {"code": "ECG",          "name": "Electrocardiogram (ECG)",              "price": 1600, "indicates": "chest pain, palpitations, shortness of breath, dizziness, fainting"},
    {"code": "CXRAY",        "name": "Chest X-Ray",                          "price": 2200, "indicates": "persistent cough, chest pain, shortness of breath, suspected pneumonia or TB"},
    {"code": "VITD",         "name": "Vitamin D (25-OH)",                    "price": 3800, "indicates": "bone or muscle pain, fatigue, muscle weakness, recurrent infections"},
    {"code": "DENGUE",       "name": "Dengue NS1 Antigen",                   "price": 2800, "indicates": "fever within first 5 days, thrombocytopenia, severe body aches, tropical fever"},
    {"code": "STOOL",        "name": "Stool Full Report",                    "price": 850,  "indicates": "diarrhoea, blood in stool, parasites, abdominal pain with bowel changes"},
    {"code": "URICACID",     "name": "Serum Uric Acid",                      "price": 900,  "indicates": "gout, hot swollen joint (esp. big toe), kidney stones, joint pain"},
    {"code": "CREATININE",   "name": "Serum Creatinine",                     "price": 850,  "indicates": "kidney function screen, reduced urine output, flank pain"},
    {"code": "ELECTROLYTES", "name": "Serum Electrolytes",                   "price": 1800, "indicates": "dehydration, vomiting, diarrhoea, muscle cramps, weakness"},
    {"code": "FERRITIN",     "name": "Serum Ferritin",                       "price": 2600, "indicates": "iron deficiency anaemia, fatigue, pallor, hair loss, heavy periods"},
    {"code": "VITB12",       "name": "Vitamin B12",                          "price": 3200, "indicates": "numbness or tingling in hands/feet, fatigue, anaemia, memory issues"},
    {"code": "HB",           "name": "Haemoglobin (Hb)",                     "price": 600,  "indicates": "anaemia screen, fatigue, pallor, breathlessness, heavy bleeding"},
    {"code": "BLOODFILM",    "name": "Peripheral Blood Film",                "price": 1200, "indicates": "malaria, dengue, haematological disease, abnormal FBC result"},
    {"code": "MALARIA",      "name": "Malaria Antigen Test",                 "price": 2400, "indicates": "cyclical fever (alternate days), travel to endemic area, chills with rigors"},
    {"code": "WIDAL",        "name": "Widal Test (Typhoid)",                 "price": 1600, "indicates": "prolonged fever >1 week, rose spots, relative bradycardia, typhoid exposure"},
    {"code": "URINE_CS",     "name": "Urine Culture & Sensitivity",          "price": 2200, "indicates": "recurrent UTI, fever with urinary symptoms, antibiotic selection"},
]

_CODE_MAP = {t["code"]: t for t in LAB_CATALOG}


# Symptom-specific clinical question guidance
_CLINICAL: dict[str, dict] = {
    "headache": {
        "red_flag": "Did this headache come on suddenly within seconds like a thunderclap, or is it the worst headache of your life?",
        "char_q": "How would you describe the headache?",
        "char_opts": ["Throbbing or pulsating on one side", "Tight band-like pressure around the whole head", "Sharp stabbing pain", "Dull constant ache on both sides", "Pressure and pain behind one eye"],
        "assoc_opts": ["Nausea or vomiting", "Sensitivity to light (hurts to look at bright light)", "Sensitivity to loud sounds", "Neck stiffness or pain", "Visual disturbances before it starts (aura)", "Fever or chills", "Eye redness or watering", "None of these"],
        "trigger_q": "What brings on or worsens the headache?",
        "trigger_opts": ["Stress or tension", "Bright lights or screens", "Lack of sleep", "Certain foods, alcohol, or caffeine withdrawal", "Physical activity or straining", "Hormonal changes (e.g. menstruation)", "Nothing specific"],
        "differentials": ["Tension-type headache", "Migraine (with or without aura)", "Cluster headache", "Sinusitis or sinus pressure", "Hypertension-related headache"],
    },
    "chest": {
        "red_flag": "Is the pain crushing or squeezing and spreading to your jaw, left arm, or shoulder, with sweating or shortness of breath?",
        "char_q": "How would you describe the chest pain?",
        "char_opts": ["Crushing or heavy pressure", "Sharp stabbing (worse when breathing in)", "Burning sensation (worse after meals or lying down)", "Tight band across the chest", "Dull aching discomfort"],
        "assoc_opts": ["Shortness of breath", "Sweating or cold clammy skin", "Palpitations or racing heartbeat", "Nausea or dizziness", "Pain when pressing the chest wall", "Cough (with or without sputum)", "Fever", "None of these"],
        "trigger_q": "When does the chest pain occur or get worse?",
        "trigger_opts": ["During physical exertion or exercise", "When lying flat or bending over after eating", "After a heavy meal", "When breathing in deeply (pleuritic)", "At rest with no clear trigger", "During stress or anxiety"],
        "differentials": ["Musculoskeletal chest wall pain", "Gastric reflux (GERD)", "Anxiety or panic attack", "Pleurisy", "Angina pectoris"],
    },
    "abdomen": {
        "red_flag": "Is the pain severe and constant (not in waves), and does pressing your abdomen make it much worse or feel rigid?",
        "char_q": "How would you describe the abdominal pain?",
        "char_opts": ["Cramping or colicky (comes and goes in waves)", "Burning or gnawing in upper abdomen", "Sharp constant pain in one spot", "Dull persistent ache", "Bloating and pressure throughout abdomen"],
        "assoc_opts": ["Nausea or vomiting", "Loose stools or diarrhoea", "Constipation", "Blood in stool or black tarry stools", "Fever or chills", "Bloating or excessive gas", "Loss of appetite", "None of these"],
        "trigger_q": "Is the pain related to eating or anything else?",
        "trigger_opts": ["Gets worse after eating", "Gets better after eating (hunger pain)", "Gets worse on an empty stomach", "Worse with movement or walking", "Unrelated to food — happens at any time"],
        "differentials": ["Gastritis or peptic ulcer disease", "Irritable bowel syndrome (IBS)", "Appendicitis (right lower abdomen)", "Urinary tract infection", "Gallstones or biliary colic"],
    },
    "back": {
        "red_flag": "Do you have numbness or weakness in both legs, or any difficulty controlling your bladder or bowels?",
        "char_q": "How would you describe the back pain?",
        "char_opts": ["Dull constant ache in lower back", "Sharp pain that worsens with movement", "Pain shooting down one leg (sciatica)", "Pain spreading to the groin or lower abdomen", "Morning stiffness that eases with movement during the day"],
        "assoc_opts": ["Pain radiating down one or both legs", "Numbness or tingling in legs or feet", "Fever or chills", "Burning pain when urinating", "Recent fall or injury to the back", "Worsens at night even lying still", "None of these"],
        "trigger_q": "What makes the back pain worse?",
        "trigger_opts": ["Bending forward", "Sitting for long periods", "Standing or walking for a while", "Lying flat at night", "Lifting or physical exertion", "Nothing specific"],
        "differentials": ["Lumbar muscle strain or sprain", "Lumbar disc prolapse with nerve root compression", "Kidney stones or kidney infection (pyelonephritis)", "Ankylosing spondylitis", "Osteoporotic compression fracture"],
    },
    "fever": {
        "red_flag": "Do you have a high fever with a stiff neck, severe headache, or a rash that does not fade when you press it?",
        "char_q": "How has the fever been?",
        "char_opts": ["Continuous high fever that doesn't break", "Fever that spikes then settles each day", "Fever every other day (cyclical)", "Mild low-grade fever", "Fever with severe shaking chills and sweating episodes"],
        "assoc_opts": ["Severe body aches or joint pains", "Rash on skin", "Nausea or vomiting", "Cough or sore throat", "Diarrhoea", "Bleeding gums or nose bleeds", "Severe headache", "None of these"],
        "trigger_q": "Have you had any of the following recently?",
        "trigger_opts": ["Travel to a rural, forested, or rural area", "Mosquito bites", "Close contact with a sick person", "Eating outside food or street food", "None of these"],
        "differentials": ["Dengue fever", "Typhoid fever", "Malaria", "Viral upper respiratory infection (flu)", "Bacterial infection"],
    },
    "urinary": {
        "red_flag": "Do you have fever, pain in the back or side (flank), or blood visible in your urine?",
        "char_q": "What best describes your main urinary problem?",
        "char_opts": ["Burning or stinging when passing urine", "Needing to urinate very frequently (every hour or less)", "Difficulty starting or maintaining urine flow", "Feeling unable to hold urine (leakage)", "Visible blood in urine"],
        "assoc_opts": ["Lower abdominal or pelvic pain", "Lower back or flank pain", "Fever or chills", "Cloudy, foul-smelling, or dark urine", "Nausea or vomiting", "None of these"],
        "trigger_q": "Is the urinary problem related to anything?",
        "trigger_opts": ["Worse at night (waking up multiple times)", "Started after sexual intercourse", "Related to fluid intake (too much or too little)", "Happens more under stress", "No clear trigger"],
        "differentials": ["Urinary tract infection (UTI)", "Kidney stones (urolithiasis)", "Pyelonephritis (kidney infection)", "Overactive bladder syndrome", "Benign prostatic hyperplasia (males, age >50)"],
    },
    "fatigue": {
        "red_flag": "Have you had unexplained weight loss, night sweats, or are you too weak to carry out basic daily activities?",
        "char_q": "How would you describe the tiredness?",
        "char_opts": ["Always exhausted even after a full night's sleep", "Mainly tired in the afternoons", "Physical weakness — hard to climb stairs or lift things", "Mental tiredness and poor concentration", "Breathless or dizzy with mild activity"],
        "assoc_opts": ["Pale skin or feeling cold all the time", "Hair loss", "Weight gain or intolerance to cold (thyroid)", "Feeling low, hopeless, or depressed", "Palpitations or dizziness on standing", "Night sweats", "None of these"],
        "trigger_q": "When did the fatigue start or what may have triggered it?",
        "trigger_opts": ["After a viral illness (e.g. flu, COVID-19)", "Gradually developed over months", "After a major stressful event or life change", "Related to poor diet or not eating enough", "No clear cause"],
        "differentials": ["Iron-deficiency anaemia", "Thyroid dysfunction (hypothyroidism)", "Type 2 diabetes", "Depression or chronic stress", "B12 or Vitamin D deficiency"],
    },
    "skin": {
        "red_flag": "Is the rash spreading very fast, or do you have fever, breathing difficulty, or swelling of the face, lips, or throat?",
        "char_q": "How would you describe the skin change?",
        "char_opts": ["Raised red itchy bumps (hives/urticaria)", "Flat red patches that don't rise above skin level", "Blisters or skin peeling", "Dry, scaly, or thickened patches", "Darkening or pigmentation change"],
        "assoc_opts": ["Severe itching", "Fever", "Joint pains", "Swelling of lips or face", "Started after taking a new medication", "Exposure to new soaps, cosmetics, or plants", "None of these"],
        "trigger_q": "What may have triggered the skin problem?",
        "trigger_opts": ["New food or known allergy", "New medication or supplement", "Contact with plants, chemicals, metals, or jewellery", "After sun or heat exposure", "Stress or emotional upset", "No clear trigger"],
        "differentials": ["Allergic reaction or urticaria (hives)", "Eczema / atopic dermatitis", "Psoriasis", "Drug hypersensitivity reaction", "Dengue rash"],
    },
    "respiratory": {
        "red_flag": "Are you struggling to breathe even while sitting still, or do your lips or fingertips look bluish?",
        "char_q": "How would you describe your breathing problem or cough?",
        "char_opts": ["Dry cough with no phlegm", "Wet cough — white or clear sputum", "Wet cough — yellow or green sputum", "Wheezing (whistling sound when breathing out)", "Shortness of breath even at rest"],
        "assoc_opts": ["Fever or night sweats", "Sharp chest pain when breathing in", "Coughing up blood", "Runny or blocked nose and sore throat", "Loss of smell or taste", "None of these"],
        "trigger_q": "When does the breathing problem get worse?",
        "trigger_opts": ["During exercise or physical activity", "At night or early morning", "In dusty, smoky, or cold environments", "When lying flat", "No clear trigger"],
        "differentials": ["Viral upper respiratory infection (cold/flu)", "Asthma or reactive airways", "Pneumonia", "Allergic rhinitis", "COVID-19"],
    },
}


def _pick_context(symptoms: list[str], body_areas: dict) -> dict:
    combined = (" ".join(symptoms) + " " + str(body_areas)).lower()
    priority = [
        ("chest",       ["chest pain", "chest", "palpitation"]),
        ("headache",    ["headache", "head", "migraine", "dizziness"]),
        ("fever",       ["fever", "chills", "temperature", "dengue"]),
        ("respiratory", ["cough", "breath", "shortness", "throat", "respiratory"]),
        ("abdomen",     ["abdomen", "abdominal", "stomach", "nausea", "vomiting", "diarrhea", "diarrh"]),
        ("back",        ["back pain", "back", "lower-back", "spine", "sciatica"]),
        ("urinary",     ["urinary", "urination", "urine", "bladder", "frequent"]),
        ("fatigue",     ["fatigue", "weakness", "tired", "exhausted"]),
        ("skin",        ["skin", "rash", "itching", "itch"]),
    ]
    for key, kws in priority:
        if any(kw in combined for kw in kws):
            return _CLINICAL[key]
    return {}


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
    duration: str = ""


class AnalyzeRequest(BaseModel):
    symptoms: list[str]
    body_areas: dict[str, list[str]]
    patient_name: str
    age: str
    gender: str
    duration: str = ""
    answers: dict[str, str]


@router.post("/questions")
def generate_questions(req: QuestionsRequest):
    symptoms_str = ", ".join(req.symptoms)
    areas_str    = "; ".join(
        f"{s}: {', '.join(a)}" for s, a in req.body_areas.items() if a
    ) or "not specified"
    first_name   = req.patient_name.split()[0] if req.patient_name else "the patient"
    ctx          = _pick_context(req.symptoms, req.body_areas)

    guidance = ""
    if ctx:
        guidance = f"""
CLINICAL GUIDANCE FOR THESE SYMPTOMS — use this directly when writing the questions:
• Red flag question to use for q1: "{ctx['red_flag']}"
• Character question for q3: "{ctx['char_q']}"
  Options for q3: {json.dumps(ctx['char_opts'])}
• Associated symptoms for q4: {json.dumps(ctx['assoc_opts'])}
• Trigger question for q5: "{ctx['trigger_q']}"
  Options for q5: {json.dumps(ctx['trigger_opts'])}
• Likely differentials: {', '.join(ctx['differentials'])}
"""

    prompt = f"""You are an experienced clinician conducting a structured triage intake at Nawaloka Hospital, Sri Lanka.

Patient: {req.patient_name}, {req.age} years old, {req.gender}
Reported symptoms: {symptoms_str}
Body areas affected: {areas_str}
Duration: {req.duration or "not yet known"}
{guidance}
Generate 5 clinical intake questions tailored EXACTLY to this patient's symptoms. Return JSON:

{{
  "potential_differentials": [
    "Most likely condition in plain English",
    "Second most likely",
    "Third",
    "Fourth",
    "Fifth (important to rule out)"
  ],
  "questions": [
    {{
      "id": "q1",
      "text": "<copy the red flag question from the CLINICAL GUIDANCE above — adapt wording to fit the exact symptoms if needed>",
      "type": "yesno",
      "options": ["Yes", "No"]
    }},
    {{
      "id": "q2",
      "text": "{first_name}, how long have you been experiencing these symptoms?",
      "type": "single",
      "options": ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "1 to 4 weeks", "More than a month or comes and goes"]
    }},
    {{
      "id": "q3",
      "text": "<copy the character question from CLINICAL GUIDANCE above>",
      "type": "single",
      "options": <paste the q3 options array from CLINICAL GUIDANCE — each must be a separate string>
    }},
    {{
      "id": "q4",
      "text": "Do you also have any of the following?",
      "type": "multi",
      "options": <paste the associated symptoms array from CLINICAL GUIDANCE — each must be a separate string>
    }},
    {{
      "id": "q5",
      "text": "<copy the trigger question from CLINICAL GUIDANCE above>",
      "type": "multi",
      "options": <paste the trigger options array from CLINICAL GUIDANCE — each must be a separate string>
    }}
  ]
}}

CRITICAL RULES:
- Use the clinical guidance above DIRECTLY — do not write generic questions
- Each option in q3/q4/q5 must be a separate string in the array
- potential_differentials must be plain language ordered most to least likely
- If no guidance was provided, use your clinical knowledge to generate symptom-specific questions"""

    try:
        result = _llm().invoke([HumanMessage(content=prompt)])
        data   = json.loads(result.content)
        return {
            "potential_differentials": data.get("potential_differentials", []),
            "questions":               data.get("questions", []),
        }
    except Exception as exc:
        _log.error("Questions generation failed: %s", exc)
        raise HTTPException(500, "Could not generate questions. Please try again.")


@router.post("/analyze")
def analyze_symptoms(req: AnalyzeRequest):
    symptoms_str = ", ".join(req.symptoms)
    areas_str    = "; ".join(
        f"{s}: {', '.join(a)}" for s, a in req.body_areas.items() if a
    ) or "not specified"
    qa_str       = "\n".join(f"Q: {q}\nA: {a}" for q, a in req.answers.items())

    # First question is always the red flag question
    qa_items         = list(req.answers.items())
    red_flag_yes     = bool(qa_items) and "yes" in qa_items[0][1].lower()

    catalog_str = "\n".join(
        f"- {t['code']}: {t['name']} (Rs. {t['price']}) — for: {t['indicates']}"
        for t in LAB_CATALOG
    )

    prompt = f"""You are a clinical decision support system at Nawaloka Hospital, Sri Lanka.

Patient: {req.patient_name}, {req.age} years old, {req.gender}
Duration: {req.duration or "not specified"}
Symptoms: {symptoms_str}
Body areas: {areas_str}
RED FLAG ANSWER: {"YES — treat this as potentially serious" if red_flag_yes else "No red flags reported"}

Patient's answers to clinical intake questions:
{qa_str}

AVAILABLE LAB TESTS — recommend ONLY tests indicated by this patient's specific presentation:
{catalog_str}

Return JSON:
{{
  "conditions": [
    {{
      "name": "Condition name",
      "likelihood": "High|Medium|Low",
      "description": "One sentence — reference the patient's specific answers to explain why this is likely"
    }}
  ],
  "lab_tests": [
    {{
      "code": "EXACT_CODE_FROM_CATALOG",
      "reason": "One sentence — specific clinical reason tied to this patient's symptoms and answers"
    }}
  ],
  "specialist": "Exact specialist type (e.g. Neurologist, Cardiologist, Gastroenterologist, General Physician)",
  "urgency": "Routine|Soon|Urgent",
  "urgency_note": "One sentence explaining urgency based on the red flag answer and severity",
  "disclaimer": "This analysis is AI-generated and not a substitute for professional medical advice."
}}

RULES — follow strictly:
Conditions:
- List 2–4 conditions only, most likely first
- Likelihood must be based on this patient's specific answers, not just symptoms alone
- description must reference what the patient said (e.g. "The throbbing unilateral pain with light sensitivity is classic for migraine")

Lab tests:
- {"RED FLAG TRIGGERED — include appropriate urgent diagnostic tests in addition to standard workup" if red_flag_yes else "No red flags — standard diagnostic workup only"}
- Recommend 3–6 tests maximum — only those directly indicated by the presentation
- A test's "for:" column must match something in this patient's presentation before recommending it
- Do not pad with generic tests just to seem thorough

Urgency:
- "Urgent": red flag answer YES, or classic emergency (crushing chest pain radiating to arm, thunderclap headache, etc.)
- "Soon": symptoms >1 week, moderate-severe, possible systemic illness
- "Routine": mild, short duration, no red flags, no systemic features"""

    try:
        result   = _llm().invoke([HumanMessage(content=prompt)])
        data     = json.loads(result.content)

        enriched = []
        for lt in data.get("lab_tests", []):
            code = lt.get("code", "").upper()
            if code in _CODE_MAP:
                entry = {k: v for k, v in _CODE_MAP[code].items() if k != "indicates"}
                enriched.append({**entry, "reason": lt.get("reason", ""), "selected": True})

        return {
            "conditions":   data.get("conditions", []),
            "lab_tests":    enriched,
            "specialist":   data.get("specialist", "General Practitioner"),
            "urgency":      data.get("urgency", "Routine"),
            "urgency_note": data.get("urgency_note", ""),
            "disclaimer":   data.get("disclaimer",
                "This analysis is AI-generated and not a substitute for professional medical advice."),
        }
    except Exception as exc:
        _log.error("Analysis failed: %s", exc)
        raise HTTPException(500, "Could not complete analysis. Please try again.")


@router.get("/catalog")
def get_catalog():
    return {"tests": LAB_CATALOG}
