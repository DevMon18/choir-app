import React from 'react';

export default function SongDetailLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Song title banner skeleton */}
      <div
        className="glass-container"
        style={{
          height: '120px',
          borderRadius: '16px',
          marginBottom: '20px',
          background: 'rgba(11, 77, 36, 0.05)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
      {/* Lyrics body skeleton */}
      <div
        className="glass-container"
        style={{
          height: '400px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.4)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
    </div>
  );
}
