'use client';

import React, { useState } from 'react';

interface ProvisioningFormProps {
  createLoading: boolean;
  onCreateUser: (input: {
    email: string;
    fullName: string;
    role: 'director' | 'treasurer' | 'secretary' | 'member';
  }) => void;
}

export const ProvisioningForm = ({ createLoading, onCreateUser }: ProvisioningFormProps) => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'director' | 'treasurer' | 'secretary' | 'member'>('member');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateUser({ email, fullName, role });
    setEmail('');
    setFullName('');
    setRole('member');
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 items-end">
      <div className="input-group !mb-0">
        <label className="input-label" htmlFor="createName">Full Name</label>
        <input
          id="createName"
          type="text"
          className="input-field"
          placeholder="E.g., Brother Jude"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={createLoading}
        />
      </div>
      
      <div className="input-group !mb-0">
        <label className="input-label" htmlFor="createEmail">Email Address</label>
        <input
          id="createEmail"
          type="email"
          className="input-field"
          placeholder="e.g., jude@choir.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={createLoading}
        />
      </div>

      <div className="input-group !mb-0">
        <label className="input-label" htmlFor="createRole">Assigned Role</label>
        <select
          id="createRole"
          className="input-field bg-white cursor-pointer"
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          disabled={createLoading}
        >
          <option value="member">Member</option>
          <option value="secretary">Secretary</option>
          <option value="treasurer">Treasurer</option>
          <option value="director">Director</option>
        </select>
      </div>

      <button
        type="submit"
        className={`btn btn-primary ${createLoading ? 'btn-disabled' : ''} w-full h-[45px]`}
        disabled={createLoading}
      >
        {createLoading ? 'Creating...' : 'Provision'}
      </button>
    </form>
  );
};
