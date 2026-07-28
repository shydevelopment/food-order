import { Resend } from 'resend';

// ดึงค่า API Key จากไฟล์ .env.local
export const resend = new Resend(process.env.RESEND_API_KEY);