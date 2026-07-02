import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  durationSeconds: number;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, durationSeconds }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onError = () => setError(true);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setError(true));
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(duration, time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  };

  if (error) {
    return (
      <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
        Unable to load audio for this memo.
      </p>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={currentTime}
        onChange={(e) => seek(Number(e.target.value))}
        className="w-full h-6 accent-blue-600 cursor-pointer"
        aria-label="Seek"
      />
      <div className="flex justify-between text-xs text-gray-500 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div className="flex items-center justify-center gap-8">
        <button
          type="button"
          onClick={() => seek(currentTime - 15)}
          className="p-2 text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          aria-label="Back 15 seconds"
        >
          <RotateCcw className="w-5 h-5" />
          <span className="text-xs">15</span>
        </button>
        <button
          type="button"
          onClick={togglePlay}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={() => seek(currentTime + 15)}
          className="p-2 text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          aria-label="Forward 15 seconds"
        >
          <span className="text-xs">15</span>
          <RotateCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
