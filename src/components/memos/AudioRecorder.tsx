import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mic, RotateCcw, Square } from 'lucide-react';
import { AudioRecording, useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface AudioRecorderProps {
  onTranscriptChange: (text: string) => void;
  onRecordingChange: (recording: AudioRecording | null) => void;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Static weights give the level bars an organic waveform shape
const LEVEL_BARS = [0.15, 0.4, 0.7, 1, 0.85, 0.55, 0.3, 0.65, 0.9, 0.45];

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onTranscriptChange,
  onRecordingChange,
}) => {
  const recorder = useAudioRecorder();
  const speech = useSpeechRecognition();
  const [recording, setRecording] = useState<AudioRecording | null>(null);

  // Live transcript fills the memo text while recording (like iOS)
  useEffect(() => {
    if (recorder.state === 'recording' && speech.transcript) {
      onTranscriptChange(speech.transcript);
    }
  }, [speech.transcript, recorder.state, onTranscriptChange]);

  if (!recorder.supported) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        Voice recording isn't supported in this browser — type your memo below.
      </p>
    );
  }

  const handleStart = async () => {
    await recorder.start();
    if (speech.supported) {
      speech.start();
    }
  };

  const handleStop = async () => {
    speech.stop();
    try {
      const rec = await recorder.stop();
      setRecording(rec);
      onRecordingChange(rec);
    } catch {
      // stop() rejected because recording never started
    }
  };

  const handleDiscard = () => {
    setRecording(null);
    onRecordingChange(null);
    speech.reset();
    recorder.reset();
  };

  return (
    <div className="bg-gray-50 p-3 rounded-lg space-y-3">
      {recorder.state === 'idle' && (
        <button
          type="button"
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Mic className="w-4 h-4" />
          Record Voice Memo
        </button>
      )}

      {recorder.state === 'recording' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600 font-medium">
              <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              Recording
            </div>
            <span className="font-mono text-lg">{formatDuration(recorder.elapsedSeconds)}</span>
          </div>
          <div className="flex items-end justify-center gap-1 h-10">
            {LEVEL_BARS.map((weight, i) => (
              <span
                key={i}
                className="w-2 bg-blue-600 rounded transition-all duration-100"
                style={{
                  height: `${Math.max(15, Math.min(100, recorder.audioLevel * weight * 160))}%`,
                }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            {speech.supported
              ? 'Listening — your words appear in the text box below'
              : "Live transcription isn't supported in this browser — type your memo below"}
          </p>
          <button
            type="button"
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Square className="w-4 h-4" />
            Stop Recording
          </button>
        </>
      )}

      {recorder.state === 'stopped' && recording && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Recording ready ({formatDuration(recording.durationSeconds)})
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Re-record
          </button>
        </div>
      )}

      {recorder.error && <p className="text-sm text-red-600">{recorder.error}</p>}
    </div>
  );
};
