import registerController from "@/controllers/auth-service/registerController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockTx = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(),
    delete: jest.fn().mockReturnThis(),
};

const mockDb = {
    transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockTx);
    }),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    otps: { id: "otps.id", email: "otps.email", otp: "otps.otp", expiresAt: "otps.expiresAt" },
    users: { email: "users.email", password: "users.password", name: "users.name" }
}));

jest.mock("@/auth-modules/hashPassword", () => jest.fn().mockResolvedValue("hashed_password"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("registerController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            email: "test@example.com",
            password: "password123",
            name: "Test User",
            otp: "123456"
        };
    });

    it("should register user successfully if OTP is valid", async () => {
        mockTx.limit.mockResolvedValue([{ id: 1, expiresAt: new Date(Date.now() + 10000) }]); // Valid OTP

        const result = await registerController({ body: mockBody, set: mockSet } as any);

        expect(result).toEqual({ message: "User registered successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockTx.insert).toHaveBeenCalled();
        expect(mockTx.delete).toHaveBeenCalled();
    });

    it("should fail if OTP is invalid", async () => {
        mockTx.limit.mockResolvedValue([]); // OTP not found

        const result = await registerController({ body: mockBody, set: mockSet } as any);

        expect(result).toEqual({ message: "Invalid OTP" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should fail if OTP is expired", async () => {
        mockTx.limit.mockResolvedValue([{ id: 1, expiresAt: new Date(Date.now() - 10000) }]); // Expired

        const result = await registerController({ body: mockBody, set: mockSet } as any);

        expect(result).toEqual({ message: "OTP expired" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should fail if missing fields", async () => {
        const result = await registerController({ body: {}, set: mockSet } as any);

        expect(result).toEqual({ message: "Email, password, name, and OTP are required" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
