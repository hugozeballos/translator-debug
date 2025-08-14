# POST /api/asr/transcribe/

**Content-Type:** multipart/form-data

## Campos (form-data)
- file: (obligatorio) audio `audio/webm|audio/ogg|audio/mpeg|audio/wav`
- source_lang_hint: (opcional) `spa_Latn | rap_Latn | arn_Latn`

## 200 OK (JSON)
{
  "transcript": "texto transcrito",
  "detected_language": "spa_Latn",
  "duration_ms": 0,
  "confidence": 1.0,
  "provider": "mock"
}

## Errores
- 400: falta `file`
- 413: archivo supera límite
- 415: MIME no soportado
- 422: audio no decodificable
- 500: error interno proveedor
