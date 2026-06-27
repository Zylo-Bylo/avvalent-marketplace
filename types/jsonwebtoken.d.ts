declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
  }

  export interface JwtPayload {
    [key: string]: unknown;
    exp?: number;
    iat?: number;
  }

  export type VerifyOptions = Record<string, unknown>;

  export function sign(payload: string | object | Buffer, secretOrPrivateKey: string, options?: SignOptions): string;
  export function verify(token: string, secretOrPublicKey: string, options?: VerifyOptions): JwtPayload | string;

  const jsonwebtoken: {
    sign: typeof sign;
    verify: typeof verify;
  };
  export default jsonwebtoken;
}
