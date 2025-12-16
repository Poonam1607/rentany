import { useState } from 'react';
import { requestOtp } from '../services/auth';

export function LoginView({ onSendOtp }: { onSendOtp: (phone: string) => void }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    try {
      setLoading(true);
      await requestOtp(phone);
      onSendOtp(phone);
    } catch (err) {
      alert('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="p-6 border rounded w-80">
        <h1 className="text-xl font-semibold mb-4">Login</h1>

        <input
          className="border p-2 w-full mb-4"
          placeholder="Enter phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <button
          onClick={handleSendOtp}
          disabled={loading}
          className="bg-black text-white px-4 py-2 w-full rounded"
        >
          {loading ? 'Sending...' : 'Send OTP'}
        </button>
      </div>
    </div>
  );
}