import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

export interface JWTPayload {
  sub:      string
  email:    string
  role:     'user' | 'admin'
  planCode: string
}

export const jwtUtils = {
  async sign(payload: JWTPayload, expiresIn = '15m'): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(secret)
  },

  async verify(token: string): Promise<JWTPayload | null> {
    try {
      const { payload } = await jwtVerify(token, secret)
      return payload as unknown as JWTPayload
    } catch {
      return null
    }
  },
}
