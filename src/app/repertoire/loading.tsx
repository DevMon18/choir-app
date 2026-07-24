import React from 'react';

export default function RepertoireLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Header skeleton */}
      <div
        className="glass-container"
        style={{
          height: '80px',
          borderRadius: '16px',
          marginBottom: '20px',
          background: 'rgba(11, 77, 36, 0.05)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
      {/* Search & Filter bar skeleton */}
      <div
        style={{
          height: '44px',
          borderRadius: '22px',
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.4)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
      {/* Song Cards grid skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="glass-container"
            style={{
              height: '100px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.4)',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          />
        ))}
      </div>
    </div>
  );
}
