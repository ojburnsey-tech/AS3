# api/app.py — Flask backend: PDF upload → pdfplumber → Claude → JSON BoQ

import os                          # os gives access to environment variables (like Environment.GetEnvironmentVariable in C#)
import io                          # io.BytesIO is an in-memory byte buffer — like MemoryStream in C#
import re                          # re is Python's regex module — like System.Text.RegularExpressions in C#
import json                        # json parses/serialises JSON — like System.Text.Json in C#
import difflib                     # difflib is a stdlib module for comparing sequences; used for fuzzy string matching
import pdfplumber                  # third-party library that opens PDFs and extracts text page by page
import anthropic                   # official Anthropic Python SDK — wraps the Claude REST API
from flask import Flask, request, jsonify, send_file, session, send_from_directory  # session = server-signed cookie dict, like HttpContext.Session in ASP.NET
from flask_cors import CORS        # CORS middleware so the React SPA (different port in dev) can call this API
from supabase import create_client # supabase-py v2 — wraps the Supabase REST API for auth
from rates import RATES_DB         # our local dict of 2025-2026 UK construction rates (material + labour per unit)
from export_pdf import generate_boq_pdf  # ReportLab PDF generator for the /export endpoint

app = Flask(__name__)              # create the Flask app instance; __name__ tells Flask the root path (like WebApplication.CreateBuilder in C#)

# Flask sessions are signed cookies; SECRET_KEY is the signing key.
# Without it sessions cannot be trusted.  Set this env var in production —
# the urandom fallback regenerates on every restart, invalidating all sessions.
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY') or os.urandom(32)

# supports_credentials=True allows the browser to send cookies on cross-origin
# requests (needed when the React SPA and this API run on different ports).
# Flask-CORS responds with the requesting Origin instead of '*' when this is set.
CORS(app, supports_credentials=True)

# ── Supabase client ───────────────────────────────────────────────────────────────────
# The anon key is sufficient for client-side auth operations (sign up, sign in).
# Read from environment so the key never appears in source — like IConfiguration in C#.
_SB_URL = os.environ.get('SUPABASE_URL', '')
_SB_KEY = os.environ.get('SUPABASE_ANON_KEY', '')
# create_client returns None-safe — we guard every usage with `if not _supabase` below
_supabase = create_client(_SB_URL, _SB_KEY) if (_SB_URL and _SB_KEY) else None


def _auth_error_msg(exc: Exception) -> str:
    """Extract a readable sentence from a supabase-py / gotrue exception.
    gotrue wraps errors as JSON strings; fall back to the raw str() if parsing fails."""
    raw = str(exc)
    try:
        data = json.loads(raw)                         # gotrue may wrap: {"code":..., "message":"..."}
        return data.get('message') or data.get('msg') or raw
    except Exception:
        return raw or "Authentication failed."

SYSTEM_PROMPT = (                  # module-level constant so the prompt is defined once and never duplicated (like static readonly string in C#)
    "You are a UK quantity surveyor. Given the following text extracted from a "
    "construction drawing or specification, produce a Bill of Quantities broken "
    "down by trade (groundworks, brickwork, blockwork, carpentry, roofing, "
    "plastering, electrical first fix, plumbing first fix, plastering, decorating). "
    "For each trade, list line items with a description, estimated quantity, unit "
    "(m, m², m³, nr, item), and leave rate as 0.00 for now. "
    "Return valid JSON only, no preamble or markdown."
)                                  # Python allows implicit string concatenation inside parentheses — no + operator needed

# ── Rate-matching helpers ─────────────────────────────────────────────────────────────
# These run once at module load time — like a static constructor in C#.
# We pre-compute token sets for every RATES_DB key so we don't repeat the work
# on every incoming request.

_STOP = frozenset([                # words too common to be useful for matching
    'to', 'in', 'of', 'the', 'a', 'and', 'for', 'with', 'at', 'on', 'per', 'by', 'or',
])

def _tokenise(text):
    """Lower-case, strip punctuation, remove stop words → frozenset of tokens."""
    clean = re.sub(r'[^a-z0-9\s]', ' ', text.lower())   # keep only alphanumeric + spaces
    return frozenset(w for w in clean.split() if w not in _STOP and len(w) > 1)

# Dict[key → frozenset of tokens] — computed once, reused on every request
_RATES_TOKENS = {key: _tokenise(key.replace('_', ' ')) for key in RATES_DB}


def _match_rate(description):
    """
    Find the closest RATES_DB entry for a free-text description.
    Uses Jaccard similarity on normalised token sets — no extra dependencies.
    Returns (matched_key, rate_dict) or (None, None) if no confident match found.

    Jaccard similarity = |intersection| / |union|  — ranges 0.0 (no overlap) to 1.0 (identical).
    C# equivalent: intersect.Count() / (double)union.Count()
    """
    desc_toks = _tokenise(description)
    if not desc_toks:                    # guard: empty description after normalisation
        return None, None

    best_key   = None
    best_score = 0.0

    for key, key_toks in _RATES_TOKENS.items():
        if not key_toks:
            continue
        intersection = len(desc_toks & key_toks)   # & on frozensets = set intersection
        if intersection == 0:
            continue                                # skip if no common tokens at all
        union = len(desc_toks | key_toks)          # | on frozensets = set union
        score = intersection / union               # Jaccard coefficient
        if score > best_score:
            best_score = score
            best_key   = key

    # Require Jaccard ≥ 0.10 — at least ~1-in-9 tokens must overlap.
    # Lower than 0.15 to handle verbose descriptions like "common brickwork in stretcher bond"
    # whose extra tokens (stretcher, bond) dilute the score against the shorter RATES_DB key.
    if best_score >= 0.10 and best_key:
        return best_key, RATES_DB[best_key]
    return None, None


def _enrich_boq(boq_data):
    """
    Walk the Claude JSON (regardless of its outer shape) and apply RATES_DB rates to
    every line item in place.  Adds material_rate, labour_rate, rate, line_total,
    and rate_source to each item dict.  Returns the same object (mutated).
    """
    # Normalise the outer structure to a flat list of trade-group dicts.
    # Claude may return [{trade, items}], {groundworks:[...]}, {bill_of_quantities:[...]}, etc.
    # isinstance() checks the runtime type — like 'is' / 'as' in C#.
    if isinstance(boq_data, list):
        groups = boq_data                          # already [{trade, items}]
    elif isinstance(boq_data, dict):
        if 'bill_of_quantities' in boq_data:       # wrapper key used by some Claude outputs
            groups = boq_data['bill_of_quantities']
        elif 'trades' in boq_data:
            groups = boq_data['trades']
        else:
            # Keys are trade names, values are item lists — convert to uniform list
            groups = [{'trade': k, 'items': v}
                      for k, v in boq_data.items() if isinstance(v, list)]
    else:
        return boq_data                            # unexpected shape — pass through untouched

    for group in groups:                           # iterate each trade section
        items = group.get('items') or group.get('line_items') or []
        for item in items:                         # iterate each line item within the trade
            desc = item.get('description') or item.get('desc') or ''
            qty  = float(item.get('quantity') or item.get('qty') or 0)

            matched_key, rate_entry = _match_rate(desc)

            if rate_entry:
                mat = rate_entry['material_rate']               # £ per unit, materials only
                lab = rate_entry['labour_rate']                 # £ per unit, labour only
                item['material_rate'] = mat
                item['labour_rate']   = lab
                item['rate']          = round(mat + lab, 2)    # all-in rate per unit
                item['line_total']    = round((mat + lab) * qty, 2)  # rate × qty
                item['rate_source']   = matched_key            # which RATES_DB key was matched
            else:
                # No match found — leave rates at zero so the QS can fill them in manually
                item['material_rate'] = 0.00
                item['labour_rate']   = 0.00
                item['rate']          = 0.00
                item['line_total']    = 0.00
                item['rate_source']   = None                   # signals no automatic match

    return boq_data   # return the same object so callers can chain: data = _enrich_boq(data)


# ── Auth routes ──────────────────────────────────────────────────────────────────────

@app.route("/login", methods=["GET"])      # GET /login serves the standalone HTML login page
def login_page():
    # send_from_directory serves a file from a directory — like PhysicalFileResult in C# MVC.
    # os.path.abspath(__file__) gives the absolute path to app.py; dirname gives its folder.
    return send_from_directory(os.path.dirname(os.path.abspath(__file__)), 'login.html')


@app.route("/login", methods=["POST"])     # POST /login authenticates and writes the JWT to the session
def login():
    if not _supabase:                      # guard: fail clearly if env vars are missing
        return jsonify({"error": "Auth not configured — set SUPABASE_URL and SUPABASE_ANON_KEY."}), 503

    body     = request.get_json(force=True, silent=True) or {}   # parse JSON body; {} if empty
    email    = (body.get('email')    or '').strip()               # .strip() removes accidental whitespace
    password =  body.get('password') or ''
    if not email or not password:          # validate before hitting Supabase to save a round-trip
        return jsonify({"error": "email and password are required."}), 400

    try:
        # sign_in_with_password is synchronous in supabase-py; it POSTs to Supabase's /auth/v1/token
        res = _supabase.auth.sign_in_with_password({"email": email, "password": password})

        # Store tokens in the Flask session cookie (signed with SECRET_KEY, not encrypted).
        # This is equivalent to writing to HttpContext.Session in ASP.NET Core.
        session['access_token']  = res.session.access_token   # JWT; expires in ~1 h by default
        session['refresh_token'] = res.session.refresh_token  # long-lived; used to renew the JWT
        session['user_id']       = res.user.id                # Supabase user UUID
        session['user_email']    = res.user.email

        return jsonify({"message": "Logged in.", "email": res.user.email}), 200

    except Exception as exc:
        return jsonify({"error": _auth_error_msg(exc)}), 401   # 401 Unauthorized on bad credentials


@app.route("/signup", methods=["POST"])    # POST /signup registers a new Supabase user
def signup():
    if not _supabase:
        return jsonify({"error": "Auth not configured — set SUPABASE_URL and SUPABASE_ANON_KEY."}), 503

    body     = request.get_json(force=True, silent=True) or {}
    email    = (body.get('email')    or '').strip()
    password =  body.get('password') or ''
    if not email or not password:
        return jsonify({"error": "email and password are required."}), 400
    if len(password) < 6:                 # Supabase enforces 6-char minimum; check here for a clear message
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    try:
        res = _supabase.auth.sign_up({"email": email, "password": password})

        # res.session is set immediately if Supabase email confirmation is disabled.
        # If confirmation is required, res.session is None — user must verify first.
        if res.session:
            session['access_token']  = res.session.access_token
            session['refresh_token'] = res.session.refresh_token
            session['user_id']       = res.user.id
            session['user_email']    = res.user.email
            return jsonify({"message": "Account created. You are now signed in."}), 201

        return jsonify({"message": "Account created. Check your email to confirm, then sign in."}), 201

    except Exception as exc:
        return jsonify({"error": _auth_error_msg(exc)}), 400   # 400 Bad Request (e.g. email already in use)


@app.route("/logout", methods=["POST"])    # POST /logout clears the Flask session
def logout():
    # session.clear() removes all keys from the signed cookie — like Session.Clear() in ASP.NET.
    # The Supabase JWT expires on its own (default 3600 s); we do not call supabase.auth.sign_out()
    # here because that would require setting the per-request session on the shared client.
    session.clear()
    return jsonify({"message": "Logged out."}), 200


@app.route("/me", methods=["GET"])         # lightweight session-check endpoint for the frontend
def me():
    if not session.get('access_token'):    # no session → 401 so the SPA knows to redirect to /login
        return jsonify({"error": "Not authenticated."}), 401
    return jsonify({"email": session.get('user_email'), "user_id": session.get('user_id')}), 200


@app.route("/process", methods=["POST"])   # decorator registers this function as POST /process handler — like [HttpPost("process")] in C# Web API
def process_pdf():                         # Flask calls this function when a matching request arrives
    if not session.get('access_token'):    # guard: reject unauthenticated requests before doing any work
        return jsonify({"error": "Authentication required. Please sign in.", "login_url": "/login"}), 401

    if "file" not in request.files:        # request.files is a dict of uploaded files keyed by form field name (like IFormFileCollection in C#)
        return jsonify({"error": "No 'file' field in request. POST multipart/form-data with field name 'file'."}), 400  # 400 Bad Request

    uploaded_file = request.files["file"]  # retrieve the FileStorage object for the field named "file"
    if uploaded_file.filename == "":       # empty filename means the browser sent the field but no file was selected
        return jsonify({"error": "Empty filename — no file was selected."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):   # validate extension; .lower() normalises casing so "Drawing.PDF" is accepted
        return jsonify({"error": "Only PDF files are accepted."}), 415            # 415 Unsupported Media Type

    pdf_bytes = uploaded_file.read()       # read the entire upload into bytes in memory — never written to disk (like reading a Stream into byte[] in C#)
    pdf_buffer = io.BytesIO(pdf_bytes)     # wrap bytes in BytesIO so pdfplumber can treat it like a seekable file (like new MemoryStream(bytes) in C#)

    try:                                   # try/except is Python's equivalent of try/catch in C#
        with pdfplumber.open(pdf_buffer) as pdf:          # 'with' guarantees the PDF is closed even on exception — like C# 'using'
            pages_text = [page.extract_text() or "" for page in pdf.pages]  # list comprehension: extract text from every page; replace None with "" (like LINQ Select in C#)
        full_text = "\n\n".join(pages_text)               # join all pages with double newline so Claude sees page breaks (like String.Join in C#)
    except Exception as exc:               # catch any pdfplumber error (corrupt file, password-protected PDF, etc.)
        return jsonify({"error": f"Failed to read PDF: {exc}"}), 422  # 422 Unprocessable Entity; f"..." is Python's interpolated string (like $"..." in C#)

    if not full_text.strip():              # .strip() removes whitespace; empty result means a scanned image PDF with no OCR text layer
        return jsonify({"error": "No text could be extracted. The PDF may be a scanned image without an OCR text layer."}), 422

    api_key = os.environ.get("ANTHROPIC_API_KEY")  # read the key from the environment — never hard-code secrets in source (like Environment.GetEnvironmentVariable in C#)
    if not api_key:                                 # fail fast with a clear message if the variable is missing
        return jsonify({"error": "ANTHROPIC_API_KEY environment variable is not set on the server."}), 500

    client = anthropic.Anthropic(api_key=api_key)  # create the SDK client with the key — like new AnthropicClient(apiKey) in a hypothetical C# SDK

    try:
        response = client.messages.create(         # call the Messages API — a synchronous HTTP POST to the Claude endpoint
            model="claude-sonnet-4-6",             # the specific Claude model to use
            max_tokens=4096,                       # maximum tokens Claude may generate; 4096 is enough for a detailed BoQ
            system=SYSTEM_PROMPT,                  # system prompt is a top-level kwarg in Anthropic SDK (NOT a {"role":"system"} entry — that is the OpenAI convention)
            messages=[                             # messages is a list of conversation turns; here just one user turn with no prior history
                {
                    "role": "user",                # "user" is the caller/human role — equivalent to UserChatMessage in a C# OpenAI SDK
                    "content": full_text,          # the extracted PDF text is the entire user message for Claude to analyse
                }
            ],
        )
    except anthropic.APIStatusError as exc:        # APIStatusError covers 4xx/5xx responses from the Claude API (bad key, rate limit, server error)
        return jsonify({"error": f"Claude API error {exc.status_code}: {exc.message}"}), 502  # 502 Bad Gateway — this server got an error from an upstream service
    except anthropic.APIConnectionError as exc:    # APIConnectionError means the network call to Anthropic failed entirely (DNS failure, timeout, etc.)
        return jsonify({"error": f"Could not reach Claude API: {exc}"}), 503  # 503 Service Unavailable

    raw_text = response.content[0].text            # response.content is a list of ContentBlock objects; [0] is the first (usually only) block; .text is the generated string
    raw_text = raw_text.strip()                    # strip whitespace/newlines Claude may have emitted before the JSON

    try:
        boq_data = json.loads(raw_text)            # parse Claude's string output as JSON — like JsonSerializer.Deserialize<object>(rawText) in C#
    except json.JSONDecodeError as exc:            # handle the case where Claude ignored the instruction and added markdown fences or a preamble
        return jsonify({"error": f"Claude returned non-JSON output: {exc}", "raw": raw_text}), 502  # include raw output so the developer can debug

    boq_data = _enrich_boq(boq_data)               # look up rates in RATES_DB and add material_rate, labour_rate, line_total to every item

    return jsonify(boq_data), 200                  # serialise the Python dict/list back to a JSON HTTP response — like return Ok(boqData) in C# Web API

@app.route("/export",   methods=["POST"])   # original route kept for backward compatibility
@app.route("/download", methods=["POST"])   # new route used by the frontend Download PDF button
def export_pdf():                           # Flask calls this for both URLs; stacking decorators is supported and idiomatic
    # request.get_json() parses the JSON body — like JsonSerializer.Deserialize in C#
    # force=True accepts the body even if Content-Type is not application/json
    # silent=True returns None instead of raising an exception on parse failure
    boq_json = request.get_json(force=True, silent=True)
    if not boq_json:                       # guard: body was empty or not valid JSON
        return jsonify({"error": "Request body must be a JSON BoQ object."}), 400

    try:
        pdf_bytes = generate_boq_pdf(boq_json)   # build the PDF; returns raw bytes
    except ValueError as exc:             # raised by generate_boq_pdf if JSON has no trade groups
        return jsonify({"error": str(exc)}), 422
    except Exception as exc:              # catch any unexpected ReportLab error
        return jsonify({"error": f"PDF generation failed: {exc}"}), 500

    # Wrap the bytes in a BytesIO so send_file can stream it as a download.
    # send_file is equivalent to File(bytes, "application/pdf", "filename.pdf") in C# MVC.
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,                # triggers "Save As" in the browser (Content-Disposition: attachment)
        download_name='bill-of-quantities.pdf',
    )


if __name__ == "__main__":                         # only runs when executed directly (python app.py), not when imported by a WSGI server — like a Program.Main guard in C#
    app.run(debug=True, port=5001)                 # start the Flask dev server on port 5001; debug=True enables hot-reload (never use in production)
