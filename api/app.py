# api/app.py — Flask backend: PDF upload → pdfplumber → Claude → JSON BoQ

import os                          # os gives access to environment variables (like Environment.GetEnvironmentVariable in C#)
import io                          # io.BytesIO is an in-memory byte buffer — like MemoryStream in C#
import json                        # json parses/serialises JSON — like System.Text.Json in C#
import pdfplumber                  # third-party library that opens PDFs and extracts text page by page
import anthropic                   # official Anthropic Python SDK — wraps the Claude REST API
from flask import Flask, request, jsonify  # Flask = web framework; request = current HTTP request; jsonify = creates a JSON Response
from flask_cors import CORS        # CORS middleware so the React SPA (different port in dev) can call this API

app = Flask(__name__)              # create the Flask app instance; __name__ tells Flask the root path (like WebApplication.CreateBuilder in C#)
CORS(app)                          # allow all origins on every route — equivalent to app.UseCors() in ASP.NET Core

SYSTEM_PROMPT = (                  # module-level constant so the prompt is defined once and never duplicated (like static readonly string in C#)
    "You are a UK quantity surveyor. Given the following text extracted from a "
    "construction drawing or specification, produce a Bill of Quantities broken "
    "down by trade (groundworks, brickwork, blockwork, carpentry, roofing, "
    "plastering, electrical first fix, plumbing first fix, plastering, decorating). "
    "For each trade, list line items with a description, estimated quantity, unit "
    "(m, m², m³, nr, item), and leave rate as 0.00 for now. "
    "Return valid JSON only, no preamble or markdown."
)                                  # Python allows implicit string concatenation inside parentheses — no + operator needed

@app.route("/process", methods=["POST"])   # decorator registers this function as POST /process handler — like [HttpPost("process")] in C# Web API
def process_pdf():                         # Flask calls this function when a matching request arrives
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

    return jsonify(boq_data), 200                  # serialise the Python dict/list back to a JSON HTTP response — like return Ok(boqData) in C# Web API

if __name__ == "__main__":                         # only runs when executed directly (python app.py), not when imported by a WSGI server — like a Program.Main guard in C#
    app.run(debug=True, port=5001)                 # start the Flask dev server on port 5001; debug=True enables hot-reload (never use in production)
