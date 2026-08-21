import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { validatePasswordPolicy } from '@/lib/password-policy';

export async function POST(req: NextRequest) {
  try {
    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'กรุณาระบุ userId และรหัสผ่านใหม่' },
        { status: 400 }
      );
    }

    const passwordPolicyError = validatePasswordPolicy(newPassword);
    if (passwordPolicyError) {
      return NextResponse.json(
        { error: passwordPolicyError },
        { status: 400 }
      );
    }

    // สร้าง Client ด้วย Service Role Key เพื่อสิทธิ์ในการเปลี่ยน Password
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในระบบ';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
