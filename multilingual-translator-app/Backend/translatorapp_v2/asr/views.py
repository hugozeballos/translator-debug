from django.shortcuts import render

# Create your views here.
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

# Si usas pydantic settings en settings.APP_SETTINGS, lo referimos abajo.
# accepted_mime: lista de mimes
# asr_max_bytes: entero
# asr_provider: 'mock' por ahora

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])  # sin auth por ahora
def transcribe(request):
    file = request.FILES.get('file')
    if not file:
        return Response({"error": "file is required"}, status=status.HTTP_400_BAD_REQUEST)

    # Validación de tamaño
    max_bytes = getattr(settings.ASR_SETTINGS, 'asr_max_bytes', 25 * 1024 * 1024)
    if file.size > max_bytes:
        return Response({"error": "file too large"}, status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE)

    # Validación de MIME
    accepted = set(getattr(settings.ASR_SETTINGS, 'asr_accepted_mime', ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4']))
    content_type = file.content_type or ''
    if content_type not in accepted:
        return Response({"error": "unsupported media type", "content_type": content_type}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)

    source_lang_hint = request.data.get('source_lang_hint')  # opcional

    # Provider mock
    # Aquí podrías ramificar por proveedor real en el futuro
    transcript = f"[mock] Transcripción de '{file.name}'"
    resp = {
        "transcript": transcript,
        "detected_language": source_lang_hint or "spa_Latn",
        "duration_ms": 0,
        "confidence": 1.0,
        "provider": "mock",
    }
    return Response(resp, status=status.HTTP_200_OK)
