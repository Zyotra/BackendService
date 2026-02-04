import getAccessTokenController from "@/controllers/auth-service/getAccessTokenController";
import { StatusCode } from "@/types/types";

// Mock dependencies
jest.mock("@/auth-modules/jwt/verifyTokens", () => ({
    verifyRefreshToken: jest.fn(),
}));

jest.mock("@/auth-modules/jwt/generateTokens", () => ({
    generateAccessToken: jest.fn().mockResolvedValue("new_mock_access_token"),
}));

import { verifyRefreshToken } from "@/auth-modules/jwt/verifyTokens";

describe("getAccessTokenController", () => {
    let mockSet: any;
    let mockCookie: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockCookie = {
            refreshToken: { value: "valid_refresh_token" },
            accessToken: { set: jest.fn() },
        };
    });

    it("should return new access token if refresh token is valid", async () => {
        (verifyRefreshToken as jest.Mock).mockResolvedValue({ status: true, userId: "123" });

        const result = await getAccessTokenController({ set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({
            message: "New access token generated",
            accessToken: "new_mock_access_token"
        });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockCookie.accessToken.set).toHaveBeenCalled();
    });

    it("should return unauthorized if no refresh token", async () => {
        mockCookie.refreshToken = {};

        const result = await getAccessTokenController({ set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({ message: "No refresh token provided" });
        expect(mockSet.status).toBe(StatusCode.UNAUTHORIZED);
    });

    it("should return unauthorized if refresh token is invalid", async () => {
        (verifyRefreshToken as jest.Mock).mockResolvedValue(false);

        const result = await getAccessTokenController({ set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({ message: "Invalid refresh token" });
        expect(mockSet.status).toBe(StatusCode.UNAUTHORIZED);
    });
});
