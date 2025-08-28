import { Response } from "express"

export interface AuthTokens {
    accessToken? : string,
    refreshToken?: string
}

export const setAuthCookie = (res: Response, tokenInfo: AuthTokens) =>{

    if (tokenInfo.accessToken) {
        res.cookie("accessToken", tokenInfo.accessToken,{
            httpOnly : true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site, 'lax' for localhost
        })
    }

    if (tokenInfo.refreshToken) {
        res.cookie("refreshToken", tokenInfo.refreshToken, {
            httpOnly : true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site, 'lax' for localhost
        })
    }
}