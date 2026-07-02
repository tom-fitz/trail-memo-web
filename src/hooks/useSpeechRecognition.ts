import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API is not in TypeScript's DOM lib — minimal declarations.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const SpeechRecognitionImpl: SpeechRecognitionConstructor | undefined =
  (window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }).SpeechRecognition ??
  (window as Window & { webkitSpeechRecognition?: SpeechRecognitionConstructor })
    .webkitSpeechRecognition;

export const useSpeechRecognition = () => {
  const supported = !!SpeechRecognitionImpl;
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const activeRef = useRef(false);

  const start = useCallback(() => {
    if (!SpeechRecognitionImpl || activeRef.current) return;
    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript((finalTextRef.current + interim).trim());
    };
    recognition.onerror = () => {
      // e.g. 'no-speech' — onend fires next and restarts while active
    };
    recognition.onend = () => {
      // Chrome ends recognition after silence; keep it running while recording
      if (activeRef.current) {
        try {
          recognition.start();
        } catch {
          // already restarted
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    activeRef.current = true;
    finalTextRef.current = '';
    setTranscript('');
    recognition.start();
    setIsListening(true);
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
    },
    []
  );

  return { supported, isListening, transcript, start, stop, reset };
};
