# translator-debug

A local development and debugging workspace for **multilingual-translator-app**, the Rapa Nui (`rap_Latn`) ⇄ Spanish (`spa_Latn`) machine translation platform. Rather than a separate CLI tool, this repository is a working copy of the full application — Django REST backend, Next.js frontend, and NLLB translation-model server — used to run the stack locally, reproduce bugs, and verify fixes end to end before they land upstream.

Part of a Rapa Nui language translator project built during a contract with CENIA (Centro Nacional de Inteligencia Artificial, Chile's national AI research center), alongside sibling repos `asr-service` and `CentrodatosRapaNui`. The commit history here shows it was actively used to build/debug the `app_asr` speech-transcription module (`multilingual-translator-app/Backend/translatorapp_v2/asr`) and to fix frontend UI/component issues.

## Repository layout

- `multilingual-translator-app/Backend/translatorapp_v2` — Django REST backend: user/auth management, invitations, language catalog, translation cache and suggestion review, and the `asr` app.
- `multilingual-translator-app/Frontend/translator` — Next.js frontend for the translator UI.
- `multilingual-translator-app/Model` — model-serving service (`server.py`, `model.py`, `client.py`) that exposes the translation model over PyTriton.
- `codigos.txt` — the developer's personal local setup notes (DB bootstrap commands, superuser credentials, activation/run commands). Not intended for production use.
- `.venv` — a committed Python virtual environment; not authoritative, recreate your own per the setup below.

## Tech stack

- **Backend**: Python, Django 5.1, Django REST Framework, PostgreSQL (`psycopg2`), `pytest` / `pytest-django`
- **Frontend**: Next.js 14, React 18, Tailwind CSS, Radix UI, NextUI, Axios
- **Translation model serving**: [PyTriton](https://github.com/triton-inference-server/pytriton) serving a Hugging Face NLLB-200 model (`CenIA/nllb-200-3.3B-spa-rap`)
- **ASR**: a Django app (`asr`) exposing `POST /api/asr/transcribe/`; in this snapshot it returns a mocked transcript (`provider: "mock"`) rather than calling a real speech-to-text backend

## Usage

The three services are run independently and wired together via environment variables.

**1. Model server** (`multilingual-translator-app/Model`):
```bash
pip install -r requirements.txt
python server.py --model-name CenIA/nllb-200-3.3B-spa-rap
```
Listens on port `8015` by default (`--port`, `--gpu`, `--optimize`, `--num-copies` are also available). Note: PyTriton only supports Ubuntu 22+/Debian 11+/Rocky Linux 9+/RHEL UBI 9+. Sanity-check it with `python client.py --model-name CenIA--nllb-200-3.3B-spa-rap --port 8015`.

**2. Backend** (`multilingual-translator-app/Backend/translatorapp_v2`):
```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Requires a PostgreSQL database and a `.env` file with, at minimum: `DB_PASSWORD`, `DB_USER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `VARIANT` (`arn` or `rap`), `SECRET_KEY`, `APP_FRONTEND_URL`, `APP_INFERENCE_MODEL_NAME`/`APP_INFERENCE_MODEL_URL` and `APP_RAW_INFERENCE_MODEL_NAME`/`APP_RAW_INFERENCE_MODEL_URL` (pointing at the model server), plus email/superuser settings for invitations. Runs on port `8000`.

Run the backend test suite (pytest + pytest-django, configured via `pytest.ini`):
```bash
pytest
```

**3. Frontend** (`multilingual-translator-app/Frontend/translator`):
```bash
npm i
npm run dev
```
Requires a `.env` with `NEXT_PUBLIC_API_URL` pointing at the backend (and optionally `NEXT_PUBLIC_VARIANT`, `NEXT_PUBLIC_TRANSLATION_REQUIRES_AUTH`). Runs on port `3000`; open `http://127.0.0.1:3000`.

**Debugging the ASR endpoint**: send a `multipart/form-data` request with a `file` field (`audio/webm|ogg|mpeg|wav`) and optional `source_lang_hint` to `POST /api/asr/transcribe/`. See `multilingual-translator-app/Backend/translatorapp_v2/docs/asr_transcribe_contract.md` for the full request/response contract and error codes.

## Deployment

The upstream app ships GitHub Actions workflows (`multilingual-translator-app/.github/workflows`) to deploy the backend, frontend, and model service to GCP independently; see those workflow files for the required secrets/variables.
