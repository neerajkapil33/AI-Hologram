import React, { useEffect, useState } from 'react';

export type SpatialBreakoutProps = { onChange?: (active: boolean) => void };

/** UI control for the first Spatial/Hologram Breakout mode. The actual avatar engine
 * listens for the window event so this stays independent of the AI conversation layer. */
export default function SpatialBreakout({ onChange }: SpatialBreakoutProps) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onSpatial = (event: Event) => {
      const next = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
      setActive(next);
      onChange?.(next);
    };
    window.addEventListener('neeraj:spatial-breakout', onSpatial);
    return () => window.removeEventListener('neeraj:spatial-breakout', onSpatial);
  }, [onChange]);
  const toggle = () => {
    const next = !active;
    setActive(next);
    onChange?.(next);
    window.dispatchEvent(new CustomEvent('neeraj:spatial-breakout', { detail: { active: next } }));
  };
  return <button type="button" className={`spatial-breakout-toggle ${active ? 'active' : ''}`} onClick={toggle} aria-pressed={active}>
    <span className="spatial-breakout-dot" />
    <span><b>{active ? 'SPATIAL BREAKOUT' : 'SPATIAL MODE'}</b><small>{active ? 'AVATAR EXTENDS BEYOND SCREEN' : 'MAKE NEERAJ STEP OUT'}</small></span>
    <strong>{active ? 'ON' : 'OFF'}</strong>
  </button>;
}
