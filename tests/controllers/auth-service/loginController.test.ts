import loginController from "@/controllers/auth-service/loginController";
import { StatusCode } from "@/types/types";
import bcrypt from "bcryptjs";

// Mock dependencies
const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    users: { id: "users.id", email: "users.email", password: "users.password" }
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
    compare: jest.fn(),
}));

jest.mock("@/auth-modules/jwt/generateTokens", () => ({
    generateAccessToken: jest.fn().mockResolvedValue("mock_access_token"),
    generateRefreshToken: jest.fn().mockResolvedValue("mock_refresh_token"),
}));

describe("loginController", () => {
    let mockSet: any;
    let mockCookie: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockCookie = {
            refreshToken: { set: jest.fn() },
            accessToken: { set: jest.fn() },
        };
        mockBody = { email: "test@example.com", password: "password123" };
    });

    it("should return success and tokens for valid credentials", async () => {
        const mockUser = { id: 1, email: "test@example.com", password: "hashed_password" };
        mockDb.where.mockResolvedValue([mockUser]);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        const result = await loginController({ body: mockBody, set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({
            message: "Login successful",
            userId: 1,
            accessToken: "mock_access_token"
        });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockCookie.refreshToken.set).toHaveBeenCalled();
        expect(mockCookie.accessToken.set).toHaveBeenCalled();
    });

    it("should return forbidden for user not found", async () => {
        mockDb.where.mockResolvedValue([]);

        const result = await loginController({ body: mockBody, set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({ message: "Invalid email or password" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });

    it("should return forbidden for invalid password", async () => {
        const mockUser = { id: 1, email: "test@example.com", password: "hashed_password" };
        mockDb.where.mockResolvedValue([mockUser]);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        const result = await loginController({ body: mockBody, set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({ message: "Invalid email or password" });
        expect(mockSet.status).toBe(StatusCode.FORBIDDEN);
    });

    it("should handle unexpected errors", async () => {
        mockDb.where.mockRejectedValue(new Error("DB Error"));

        const result = await loginController({ body: mockBody, set: mockSet, cookie: mockCookie } as any);

        expect(result).toEqual({ message: "An error occurred during login" });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
    });
});
