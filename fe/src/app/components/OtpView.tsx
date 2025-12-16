import { useState } from 'react';
import { verifyOtp } from '../services/auth';

export function OtpView({
  phone,
  onSuccess,
}: {
  phone: string;
  onSuccess: (session: any) => void;
}) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    try {
      setLoading(true);
      const session = await verifyOtp(phone, otp);
      onSuccess(session);
    } catch (err) {
      alert('Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="p-6 border rounded w-80">
        <h1 className="text-xl font-semibold mb-4">Verify OTP</h1>

        <input
          className="border p-2 w-full mb-4"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
        />

        <button
          onClick={handleVerify}
          disabled={loading}
          className="bg-black text-white px-4 py-2 w-full rounded"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </div>
  );
}
