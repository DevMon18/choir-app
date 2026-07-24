import React from 'react';

export default function ChatLoading() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px' }}>
      {/* Top Header skeleton */}
      <div
        style={{
          height: '60px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '16px',
          animation: 'pulse 1.5s infinite ease-in-out',
        }}
      />
      {/* Chat messages list skeleton */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'flex-end' }}>
        <div style={{ width: '60%', height: '48px', borderRadius: '16px', background: 'rgba(0,0,0,0.05)', alignSelf: 'flex-start', animation: 'pulse 1.5s infinite ease-in-out' }} />
        <div style={{ width: '50%', height: '48px', borderRadius: '16px', background: 'rgba(11, 77, 36, 0.1)', alignSelf: 'flex-end', animation: 'pulse 1.5s infinite ease-in-out' }} />
        <div style={{ width: '70%', height: '48px', borderRadius: '16px', background: 'rgba(0,0,0,0.05)', alignSelf: 'flex-start', animation: 'pulse 1.5s infinite ease-in-out' }} />
      </div>
    </div>
  );
}
