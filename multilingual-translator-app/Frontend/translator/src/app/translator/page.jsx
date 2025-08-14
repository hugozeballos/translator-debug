/* Copyright 2024 Centro Nacional de Inteligencia Artificial (CENIA, Chile). All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License. */
'use client'

import { useState , useEffect, useContext} from 'react'
import "./translator.css"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faThumbsDown , faThumbsUp , faArrowsRotate, faArrowRightArrowLeft, faArrowRight, faLock } from "@fortawesome/free-solid-svg-icons";
import Card from "../components/card/card.jsx"
import FeedbackModal from '../components/feedbackModal/feedbackModal.jsx'
import api from '../api';
import LangsModal from '../components/langsModal/langsModal.jsx'
import { API_ENDPOINTS, ASR_ENABLED, isTranslationRestricted, MAX_WORDS_TRANSLATION } from '../constants';
import { VARIANT_LANG  } from "@/app/constants";
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAnalytics } from '@/hooks/useAnalytics';
import { AuthContext } from '../contexts';
import { useRouter } from 'next/navigation';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
// importaciones para ASr

import { faMicrophone, faPlus } from "@fortawesome/free-solid-svg-icons";
import { AUTOFILL_TRANSCRIPT, MAX_AUDIO_MB } from '../constants';
import { useRef } from 'react';
import { asrTranscribe } from '../asrApi';


export default function Translator() {

  const [srcText, setSrcText] = useState('');
  const [showSrcTextMessage, setShowSrcTextMessage] = useState(false);
  const [dstText, setDstText] = useState('');
  const [srcLang, setSrcLang] = useState({
    "name": "Español",
    "writing": "Latn",
    "code": "spa_Latn",
    "dialect": null
  });
  const [dstLang, setDstLang] = useState(VARIANT_LANG === 'arn'? {
    "name": "Huilliche Azümchefe",
    "writing": "a0",
    "code": 'arn_a0_h',
    "dialect": "n"
  } : {
    "name": "Rapa Nui",
    "writing": "Latn",
    "code": "rap_Latn",
    "dialect": null
  });

  // para boton de grabacion
  const [isRecording, setIsRecording] = useState(false);
  const [asrStatus, setAsrStatus] = useState('idle');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  // Para evitar que se dispare la traduccion
  const [suppressNextAutoTranslate, setSuppressNextAutoTranslate] = useState(false)

  
  const [langModalMode, setLangModalMode] = useState(false);
  const [modalBtnSide, setModalBtnSide] = useState('');

  const [feedbackData, setFeedbackData] = useState(null);
  const [modelData, setModelData] = useState(null);

  const [loadingState, setLoadingState] = useState(false);
  const [copyReady, setCopyReady] = useState(false);

  const [showDevModal, setShowDevModal] = useState(true);

  const router = useRouter()

  const [isMobile, setIsMobile] = useState(false);

  const { trackEvent } = useAnalytics();
  const currentUser = useContext(AuthContext);

  // Check if translation is restricted for current user
  const translationRestricted = isTranslationRestricted(currentUser);
  const [translationRestrictedDialogOpen, setTranslationRestrictedDialogOpen] = useState(translationRestricted);

  const getLangs = async (code, script, dialect) => {
    let params = {};

    if (code !== null) {
      params.code = code;
    }
    if (script !== null) {
        params.script = script;
    }
    if (dialect !== null) {
      params.dialect = dialect;
    }
    try {
      const res = await api.get(API_ENDPOINTS.LANGUAGES,
        {
          params: params
        }
      );
      console.log(res.data);
      return res.data;
    } catch (error) {
      console.log('Error getting languages');
    }
  }  

  const handleSrcLang = lang =>{
    setSrcLang(lang);
  };

  const handleDstLang = lang => {
    setDstLang(lang);
  };

  const handleLangModalBtnLeft = () => {
    setModalBtnSide('left');
    setLangModalMode(true);
  };

  const handleLangModalBtnRight = () => {
    setModalBtnSide('right');
    setLangModalMode(true);
  };

  const handleCrossLang = async () => {

    if(loadingState === false){

      setLoadingState(true);
      setSrcText(dstText);
      setSrcLang(dstLang);
      setDstLang(srcLang);
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDstText(srcText);
      setLoadingState(false);
      trackEvent('button_cross_lang_click', {
        src_lang: srcLang,
        dst_lang: dstLang,
        page: 'translator'
      });
    }
  };
 
  const handleSelectedLangModal = (lang) => {
    if (modalBtnSide === 'left'){
      setSrcLang(lang);
    }
    else{
      setDstLang(lang);
    }
    setModalBtnSide('');
    setLangModalMode(false);
  };

  const handleNegativeFeedback = () => {
    if (dstText.length != 0 && !loadingState){
      setFeedbackData({
        'src_text': srcText,
        'dst_text': dstText,
        'src_lang': srcLang,
        'dst_lang': dstLang,
        'suggestion': dstText
      });
    }
  };

  const handlePositiveFeedback = async () => {
    if (dstText.length != 0 && !loadingState){

      try {

        await api.post(
          API_ENDPOINTS.SUGGESTIONS+'accept_translation/',
          {
            src_text: srcText,
            dst_text: dstText,
            src_lang: srcLang,
            dst_lang: dstLang,
            model_name: modelData.modelName,
            model_version: modelData.modelVersion
          },
        );

        toast("Sugerencia enviada con éxito",{
          description: "Gracias por su retroalimentación",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
    },
        });
        trackEvent('positive_feedback_submit_success', {
          model_name: modelData.modelName,
          model_version: modelData.modelVersion,
          page: 'translator'
        });
      } catch(error) {
          if (error.response.status === 401){
            toast("Error",{
              description: "Debe ingresar su usuario para ocupar todas las funcionalidades de la aplicación",
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            })
          }
          console.log(error) 
          trackEvent('positive_feedback_submit_error', {
            page: 'translator',
            error: error.response.status
          });
      }
    }
  };

  const handleTranslate = async () => {
    translate();
    trackEvent('translation_button_click', {
      page: 'translator'
    });
  }

  const handleLogin = () => {
    router.push('/login');
  }

  function limitWordsPreserveLines(text, maxWords) {
    let wordCount = 0;
    let inWord = false; // if we are in a word
    let i = 0;
    for (; i < text.length; i++) {
      if (/\S/.test(text[i])) { // not whitespace
        if (!inWord) { // then start of a word
          wordCount++;
          inWord = true;
          if (wordCount > maxWords) break;
        }
      } else { // then end of a word 
        inWord = false;
      }
    }
    return text.slice(0, i);
  }

  const handleSrcText = (text) => {
    console.log(text);
    console.log(text.trim().split(/\n+/).length);
    const textList = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = textList.length;
    console.log(wordCount);
    // if the text is longer than the max words, limit the text to the max words
    // while preserving the structure (newlines)
    if (wordCount > MAX_WORDS_TRANSLATION){
      text = limitWordsPreserveLines(text, MAX_WORDS_TRANSLATION);
      setSrcText(text);
      setShowSrcTextMessage(true);
      setTimeout(() => {
        setShowSrcTextMessage(false);
        console.log(text.split(/\n+/).length);
      }, 3000);
    }
    else{
      setShowSrcTextMessage(false);
      setSrcText(text);
      console.log(text.split(/\n+/).length);
    }

  }

  const handleCopyText = async () => {
    if (dstText && dstText.length > 0) {
      try {
        await navigator.clipboard.writeText(dstText);
        setCopyReady(true);
        setTimeout(() => {
          setCopyReady(false);
        }, 2000);
      }
      catch (error) {
        toast("Error al copiar", {
          description: "No se pudo copiar el texto al portapapeles",
          cancel: {
            label: 'Cerrar',
            onClick: () => console.log('Pop up cerrado'),
          },
        });
      }
    }
  } 

  function getPreferredMime() {
    if (typeof window !== 'undefined' && window.MediaRecorder && MediaRecorder.isTypeSupported) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) return 'audio/ogg;codecs=opus';
    }
    return 'audio/webm';
  }

  function inferHintFromSrcLang() {
    const code = (srcLang?.code || '').toLowerCase();
    if (code.includes('spa')) return 'spa_Latn';
    if (code.includes('rap')) return 'rap_Latn';
    if (code.includes('arn')) return 'arn_Latn';
    if (VARIANT_LANG === 'rap') return 'rap_Latn';
    if (VARIANT_LANG === 'arn') return 'arn_Latn';
    return 'spa_Latn';
  }

  async function handleTranscribeBlob(blob, filename = 'audio.webm') {
    const maxBytes = (Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB ?? 25)) * 1024 * 1024;
    if (blob.size > maxBytes) {
      setAsrStatus('error');
      toast(`El archivo supera ${process.env.NEXT_PUBLIC_MAX_AUDIO_MB || 25} MB.`);
      return;
    }

    const hint = inferHintFromSrcLang();
    setAsrStatus('transcribing');

    try {
      // 👇 aquí usamos el backend real
      const data = await asrTranscribe(blob, hint); // { transcript, detected_language, ... }
      const transcript = data?.transcript || '';

      if (AUTOFILL_TRANSCRIPT !== false) {
        // evita el auto-translate del useEffect
        setSuppressNextAutoTranslate(true);
        setSrcText(transcript);
      }
      setAsrStatus('done');
      toast('Transcripción lista.');
    } catch (err) {
      console.error(err);
      setAsrStatus('error');
      toast('Error al transcribir.', {
        description: err?.response?.data?.error || 'Reintenta con otro archivo.',
      });
    }
  }

  const translate = async () => {
    if(translationRestricted){
      setTranslationRestrictedDialogOpen(true);
      return;
    }
    if(!loadingState){
      if(srcText.length === 0){
        setDstText('');
      }
      else{

        setLoadingState(true);
        
        const startTime = performance.now();
        try {
          // Add timer for long-running request
          let timeoutId = setTimeout(() => {
            toast("La traducción está tardando más tiempo de lo esperado...", {
              description: "Por favor, espere un momento mientras el modelo se carga",
              duration: 20000,
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            });
          }, 5000);
          const res = await api.post(
            API_ENDPOINTS.TRANSLATION,
            {
              src_text: srcText,
              src_lang: srcLang,
              dst_lang: dstLang,
            },
          );
          
          setDstText(res.data.dst_text);
          setModelData({
            modelName: res.data.model_name,
            modelVersion: res.data.model_version
          });
          clearTimeout(timeoutId);
          const endTime = performance.now();
          const translationTime = endTime - startTime;
          trackEvent('translation_success', {
            src_text: srcText.slice(0, 100),
            dst_text: res.data.dst_text.slice(0, 100),
            src_lang: srcLang,
            dst_lang: dstLang,
            model_name: res.data.model_name,
            model_version: res.data.model_version,
            translation_time_ms: translationTime,
            is_timeout: translationTime > 5000,
            is_mobile: window.innerWidth <= 850,
            is_question: srcText.includes('?'),
            word_count: srcText.split(/\s+/).length,
            page: 'translator'
          });
        } 
        catch (error) {
          console.log(error)
          if (error.response.status === 400){
            toast("Error",{
              description: "Por favor reintente la traducción",
              cancel: {
                label: 'Cerrar',
                onClick: () => console.log('Pop up cerrado'),
              },
            })
            trackEvent('translation_error', {
              status: error.response.status,
              page: 'translator'
            }); 
          }
          console.log('Error in translation')
        } 
        finally {
          setLoadingState(false);

        }
        
      }
    }
    else{
      setLoadingState(false);
    }

  }


  async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Tu navegador no soporta grabación de audio.');
      return;
    }
    const mime = getPreferredMime();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: mime });

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const ext = mime.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunksRef.current, { type: mime.includes('ogg') ? 'audio/ogg' : 'audio/webm' });
      recorder.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      await handleTranscribeBlob(blob, `grabacion.${ext}`);
    };

    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setAsrStatus('recording');
    recorder.start();
    toast('Grabación iniciada.');
  }

  function stopRecording() {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
      toast('Grabación detenida.');
    }
  }


  useEffect(() => {
    // Don't auto-translate if translation is restricted and user is not authenticated
    if (translationRestricted) {
      setTranslationRestrictedDialogOpen(true);
      return;
    }

    // ⛔️ Salta la auto-traducción una sola vez si venimos de ASR
    if (suppressNextAutoTranslate) {
      setSuppressNextAutoTranslate(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      translate();
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [srcText, srcLang, dstLang, translationRestricted, suppressNextAutoTranslate]);

  return (
    <div className="translator-container">

      <Dialog open={showDevModal} onOpenChange={setShowDevModal}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>Modelo en fase de desarrollo</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
          El traductor se encuentra en desarrollo y esta es su <strong>primera versión operativa</strong>.
            Se encuentra en un proceso de <strong>mejora continua</strong>, por lo que puede cometer errores o
            producir resultados inesperados. Agradecemos su comprensión y su retroalimentación,
            que nos ayuda a mejorar su precisión y utilidad.
          </p>
        </div>
        </DialogContent>
      </Dialog>
      <Dialog open={translationRestrictedDialogOpen} onOpenChange={setTranslationRestrictedDialogOpen}>
      <DialogContent className='h-fit w-1/2 gap-y-4 py-5 max-[850px]:w-3/4'>
        <DialogHeader>
          <DialogTitle>Acceso restringido</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>
            El traductor se encuentra en una fase preliminar de prueba por lo que 
            debe <strong>iniciar sesión</strong> para usar el traductor en esta versión.
          </p>
        </div>
        <div className="flex justify-center">
          <Button 
            className='bg-[#068cdc1a] 
                text-default text-xs font-bold 
                hover:bg-default hover:text-white' 
            onClick={() => handleLogin()}
          >
            Iniciar sesión
          </Button>
        </div>
        </DialogContent>
      </Dialog>
      
      <TooltipProvider>
        <div className="relative">
          <Card
            side={"left"}
            srcText={srcText}
            lang={srcLang}
            handleSrcText={handleSrcText}
            handleSrcLang={handleSrcLang}
            showTextMessage={showSrcTextMessage}
            handleLangModalBtn={handleLangModalBtnLeft}
          />

          {ASR_ENABLED && (
            <div className="asr-controls absolute right-4 bottom-4 z-[3] flex gap-2 items-center max-[850px]:right-3 max-[850px]:bottom-3">
              {/* Botón para grabar (UI solamente) */}
              <button
                type="button"
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition"
                onClick={async () => {
                  if (translationRestricted) {
                    setTranslationRestrictedDialogOpen(true);
                    return;
                  }
                  if (!isRecording) {
                    try {
                      await startRecording();
                    } catch (e) {
                      setAsrStatus('error');
                      toast('No se pudo iniciar la grabación.');
                    }
                  } else {
                    stopRecording();
                  }
                }}
                aria-label="Grabar audio"
                title="Grabar audio"
                disabled={loadingState} // no grabar mientras se traduce
                style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
              >
                <FontAwesomeIcon
                  icon={faMicrophone}
                  className="fa-lg"
                  color={isRecording ? "#d40000" : "#0a8cde"}
                />
              </button>

              {/* Botón para subir archivo (UI con input oculto) */}
              <label
                className="w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white shadow-[0px_0px_hsla(0,100%,100%,0.333)] hover:scale-110 transition cursor-pointer"
                title="Subir audio"
                aria-label="Subir audio"
              >
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  onChange={async (e) => {
                    if (translationRestricted) {
                      setTranslationRestrictedDialogOpen(true);
                      e.currentTarget.value = "";
                      return;
                    }
                    const files = e.currentTarget.files;
                    if (!files || files.length === 0) return;
                    const file = files[0];
                    e.currentTarget.value = "";

                    setAsrStatus('uploading');

                    try {
                      const okTypes = ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4'];

                      if (file.type && !okTypes.includes(file.type)) {
                        toast('Formato no soportado. Sube webm/ogg/mp3/wav.');
                        setAsrStatus('error');
                        return;
                      }
                      await handleTranscribeBlob(file, file.name || 'audio.subido');
                    } catch (err) {
                      console.error(err);
                      setAsrStatus('error');
                      toast('No se pudo procesar el archivo.');
                    }
                  }}
                />
                <FontAwesomeIcon icon={faPlus} className="fa-lg" color="#0a8cde" />
              </label>
            </div>
          )}
        </div>



        <div
          className="delayed-fade-in w-[40px] h-[40px] rounded-full flex justify-center items-center bg-white absolute max-[850px]:top-1/2 max-[850px]:left-[45px] left-1/2 top-[100px] z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005]"
          onClick={() => handleCrossLang()}
        >
          <FontAwesomeIcon
            icon={faArrowRightArrowLeft }
            className={`fa-xl max-[850px]:rotate-90 transform transition-all duration-300 hover:scale-110`}
            color="#0a8cde"
          />
        </div>

        <div
          className={`delayed-fade-in w-[50px] h-[50px] rounded-full flex justify-center items-center bg-white absolute left-1/2 top-1/2 z-[2] cursor-pointer shadow-[0px_0px_hsla(0,100%,100%,0.333)] transform transition-all duration-300 hover:scale-110 hover:shadow-[8px_8px_#0005] ${translationRestricted ? 'opacity-50' : ''}`}
          onClick={() => handleTranslate()}
          style={{ pointerEvents: loadingState ? 'none' : 'auto' }}
        >
          <FontAwesomeIcon
            icon={loadingState ? faArrowsRotate : (translationRestricted ? faLock : faArrowRight)}
            className={`fa-2xl transform transition-all duration-300 hover:scale-110 max-[850px]:rotate-90 ${translationRestricted ? 'opacity-50' : ''}`}
            color={translationRestricted ? "#666" : "#0a8cde"}
            style={loadingState ? { animation: 'spin 1s linear infinite' } : {}}
          />
        </div>

        <Card
          side={"right"}
          dstText={dstText}
          lang={dstLang}
          handleDstLang={handleDstLang}
          handleLangModalBtn={handleLangModalBtnRight}
          handleCopyText={handleCopyText}
          copyReady={copyReady}
        />
      </TooltipProvider>

      <div className="translator-footer">

        {translationRestricted ? (<></>) : (
          <>
            <strong>¿Qué te ha parecido esta traducción?</strong>

            <FontAwesomeIcon
              icon={faThumbsUp}
              size="lg"
              onClick={() => handlePositiveFeedback()}
            />

            <FontAwesomeIcon
              icon={faThumbsDown}
              size="lg"
              onClick={() => handleNegativeFeedback()}
            />
          </>
        )}

      </div>

      <LangsModal
        isOpen={langModalMode}
        langModalSelected={modalBtnSide === 'right'? dstLang : srcLang}
        handleCloseModal={setLangModalMode}
        handleSelectedLanguage={handleSelectedLangModal}
      />

      <FeedbackModal
        editingTranslation={feedbackData}
        setEditingTranslation={setFeedbackData}
        modelData={modelData}
        suggestionId={null}
      />
      
    </div>
  );
}