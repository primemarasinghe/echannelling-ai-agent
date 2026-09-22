"""Retrieval-augmented generation.

The model receives ONLY the retrieved chunks as context. It is instructed to
answer from them or refuse. It is never asked to recall e-Channelling policy
from its own training.
"""
import time

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from app.config import get_settings
from app.services.retrieval import format_context, retrieve

settings = get_settings()

SYSTEM_PROMPT = """You are the e-Channelling assistant for Sri Lanka Telecom.
You answer customer questions about appointments, fees, refunds and policies.

You will be given CONTEXT containing passages from approved e-Channelling policy
documents. These passages are your only permitted source of information.

RULES:
1. Answer using ONLY facts stated in the CONTEXT. Never add information from your
   own knowledge, even if you are confident it is correct.
2. If the CONTEXT does not contain the answer, say exactly this and nothing more:
   "I don't have information about that in the e-Channelling knowledge base. Let me
   connect you with a customer service officer who can help."
3. The CONTEXT may contain passages that are related to the topic but do not
   actually answer the question. In that case, still refuse using the sentence above.
   Being on the same subject is not the same as answering the question.
4. If CONTEXT is the text NO_RELEVANT_KNOWLEDGE_FOUND, refuse using the sentence above.
5. Never invent amounts, time limits, phone numbers or percentages. If a figure is
   not in the CONTEXT, it does not exist.
6. If the CONTEXT contains different answers for different situations, state both
   and name the situation each applies to. Do not pick one silently.

STYLE:
- Short and clear. Two to four sentences for most answers.
- Amounts as Rs. 3,500.
- Do not mention "context", "passages", "documents" or "the knowledge base" in a
  successful answer. Just answer.
"""

USER_PROMPT = """CONTEXT:
{context}

QUESTION: {question}"""


def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_chat_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )


def build_chain():
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", USER_PROMPT),
    ])
    return prompt | get_llm() | StrOutputParser()


def answer(question: str) -> dict:
    started = time.perf_counter()

    chunks = retrieve(question)
    context = format_context(chunks)

    chain = build_chain()
    text = chain.invoke({"context": context, "question": question})

    return {
        "answer": text,
        "sources": [
            {"doc_id": c.doc_id, "title": c.title,
             "snippet": c.content[:300], "score": c.score}
            for c in chunks
        ],
        "retrieved_count": len(chunks),
        "latency_ms": int((time.perf_counter() - started) * 1000),
    }