import api from './api';
import { API_ENDPOINTS } from './constants';

export async function asrTranscribe(file: File | Blob, sourceLangHint?: string) {
  const form = new FormData();
  form.append('file', file);
  if (sourceLangHint) form.append('source_lang_hint', sourceLangHint);

  // OJO: aquí sobrescribimos el Content-Type del interceptor
  const res = await api.post(
    API_ENDPOINTS.ASR_TRANSCRIBE,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data; // { transcript, detected_language, ... }
}
