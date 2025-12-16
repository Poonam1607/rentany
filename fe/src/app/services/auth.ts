const API_BASE_URL = 'http://localhost:3000'; // change if BE runs elsewhere

export async function requestOtp(phone: string) {
  const res = await fetch(`${API_BASE_URL}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    throw new Error('Failed to send OTP');
  }

  return res.json();
}

export async function verifyOtp(phone: string, otp: string) {
  const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });

  if (!res.ok) {
    throw new Error('Invalid OTP');
  }

  return res.json(); // should return session/user
}