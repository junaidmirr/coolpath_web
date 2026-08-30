import React, { useState, useRef, useEffect } from 'react';
import { getActiveBaseUrl, fetchSmartSearchSuggestions } from '../services/api';

export interface GeoResult {
  display_name: string;
  lat: number;
  lng: number;
}

interface LocationSearchProps {
  label: string;
  value: string;           // Human-readable location name shown in the box
  onSelect: (result: GeoResult) => void;
  pinColor?: 'green' | 'red';
  disabled?: boolean;
  originLat?: number;      // To support smart search proximity calculations
  originLng?: number;
}

const LocationSearch: React.FC<LocationSearchProps> = ({
  label,
  value,
  onSelect,
  pinColor = 'green',
  disabled,
  originLat,
  originLng
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const baseUrl = await getActiveBaseUrl();
        if (label === 'Destination' && originLat !== undefined && originLng !== undefined) {
          // Trigger intelligent proximity ring search + Gemini re-ranking
          const smartResults = await fetchSmartSearchSuggestions(q, originLat, originLng);
          setResults(smartResults || []);
        } else {
          // Standard Nominatim geocoder
          const resp = await fetch(`${baseUrl}/api/geocode?q=${encodeURIComponent(q)}`);
          const data = await resp.json();
          // Map Nominatim output format to result layout
          const standardResults = (data.results || []).map((item: any) => ({
            id: item.place_name,
            place_name: item.display_name,
            lat: item.lat,
            lng: item.lng
          }));
          setResults(standardResults);
        }
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400); // 400ms debounce
  };

  const handleSelect = (r: any) => {
    setQuery('');
    setOpen(false);
    setResults([]);
    onSelect({
      display_name: r.place_name,
      lat: r.lat,
      lng: r.lng
    });
  };

  const dotColor = pinColor === 'green' ? '#10b981' : '#ef4444';

  return (
    <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0
        }} />
        {label}
      </label>

      {/* Selected location display */}
      {value && !query && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${dotColor}33`,
          borderRadius: '6px 6px 0 0',
          fontSize: '13px',
          color: pinColor === 'green' ? '#10b981' : '#f43f5e',
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
        </div>
      )}

      <input
        type="text"
        placeholder={value ? 'Search to change location…' : 'Type a place name or address…'}
        value={query}
        onChange={handleChange}
        disabled={disabled}
        style={{
          borderRadius: value && !query ? '0 0 6px 6px' : '6px',
          borderTop: value && !query ? 'none' : undefined,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          color: '#f8fafc',
          outline: 'none',
          padding: '10px 12px',
          fontSize: '14px',
          width: '100%',
          transition: 'border-color 0.2s'
        }}
        onFocus={() => query.length >= 2 && setOpen(true)}
      />

      {loading && (
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          fontSize: '12px',
          color: '#94a3b8'
        }}>
          Searching…
        </div>
      )}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0d1b2a',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          maxHeight: '260px',
          overflowY: 'auto'
        }}>
          {results.map((r, i) => (
            <button
              key={r.id || i}
              onClick={() => handleSelect(r)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: '#e2e8f0',
                borderBottom: i < results.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                lineHeight: 1.4,
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '360px' }}>
                  {r.place_name}
                </span>
                {r.badge_label && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: r.badge_label.includes('Best Choice') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    color: r.badge_label.includes('Best Choice') ? '#10b981' : '#94a3b8',
                    border: `1px solid ${r.badge_label.includes('Best Choice') ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.15)'}`
                  }}>
                    {r.badge_label}
                  </span>
                )}
              </div>
              {r.reasoning && (
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  Reason: {r.reasoning}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {open && results.length === 0 && !loading && query.length >= 2 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0d1b2a',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '12px 14px',
          fontSize: '13px',
          color: '#94a3b8',
          zIndex: 1000
        }}>
          No results found for "{query}"
        </div>
      )}
    </div>
  );
};

export default LocationSearch;
