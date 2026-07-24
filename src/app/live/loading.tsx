import React from 'react';

export default function LiveLoading() {
  return (
    <div style={{ padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      {/* Top Live Session Bar skeleton */}
      <div
        className="glass-container"
        style={{
          height: '70px',
          borderRadius: '16px',
          marginBottom: '20px',
          background: 'rgba(11, 77, 36, 0.05)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
      {/* Live Lyrics Sheet Skeleton */}
      <div
        className="glass-container"
        style={{
          height: '420px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.4)',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
    </div>
  );
}
