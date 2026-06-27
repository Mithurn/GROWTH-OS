import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface AuthRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  next();
}

// Soft auth — attaches userId if token present, continues either way
export async function softAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) req.userId = user.id;
  }
  next();
}
