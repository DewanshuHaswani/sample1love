import { useEffect, useState } from 'react';
import ElasticSlider from './ElasticSlider';

export function VolumeSlider() {
  const [volume, setVolume] = useState(40);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleReady = (event: Event) => {
      const customEvent = event as CustomEvent<{ showToggle?: boolean; volume?: number }>;
      if (customEvent.detail?.showToggle === false) {
        setVisible(false);
        return;
      }

      setVisible(true);
      setVolume(Math.round((customEvent.detail?.volume ?? 0.4) * 100));
    };

    const handleVolumeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ volume?: number }>;
      setVolume(Math.round((customEvent.detail?.volume ?? 0.4) * 100));
    };

    window.addEventListener('wedding-audio-ready', handleReady);
    window.addEventListener('wedding-audio-volume', handleVolumeChange);
    return () => {
      window.removeEventListener('wedding-audio-ready', handleReady);
      window.removeEventListener('wedding-audio-volume', handleVolumeChange);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="music-toggle-wrapper">
      <ElasticSlider
        defaultValue={volume}
        startingValue={0}
        maxValue={100}
        isStepped
        stepSize={5}
        leftIcon={<span className="elastic-slider-icon elastic-slider-icon--empty" aria-hidden="true" />}
        rightIcon={<span className="elastic-slider-icon elastic-slider-icon--empty" aria-hidden="true" />}
        onChange={(nextValue) => {
          setVolume(nextValue);
          window.dispatchEvent(
            new CustomEvent('wedding-audio-set-volume', {
              detail: {
                volume: nextValue / 100,
              },
            })
          );
        }}
      />
    </div>
  );
}
