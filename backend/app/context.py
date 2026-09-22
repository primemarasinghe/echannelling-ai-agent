from contextvars import ContextVar

# Set once per request (in chat.py) so tools can read it without it being
# threaded through every function signature.
session_key_var: ContextVar[str] = ContextVar("session_key", default="unknown")
