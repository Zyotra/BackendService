import { Context } from "elysia";
import { StatusCode } from "../../types/types";
import { generateAccessToken } from "../../auth-modules/jwt/generateTokens";
import { verifyRefreshToken } from "../../auth-modules/jwt/verifyTokens";
const getAccessTokenController = async ({ set, cookie }: Context) => {
    const refreshToken = cookie.refreshToken?.value as string;
    if (!refreshToken) {
        set.status = StatusCode.UNAUTHORIZED;
        return {
            message: "No refresh token provided"
        }
    }
    const isValid = await verifyRefreshToken(refreshToken);
    if (!isValid || isValid.status === false) {
        set.status = StatusCode.UNAUTHORIZED;
        return {
            message: "Invalid refresh token"
        }
    }
    const userId = isValid.userId;
    const isProd = process.env.NODE_ENV === 'production'? true : false;
    const accessToken = await generateAccessToken(userId);
    cookie.accessToken.set({
        value: accessToken,
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        domain: isProd ? "zyotrabackend.yadavram.com.np" : undefined,
        path: '/',
        maxAge: 15 * 60,
    });
    set.status = StatusCode.OK;
    return {
        message: "New access token generated",
        accessToken
    }
}
export default getAccessTokenController