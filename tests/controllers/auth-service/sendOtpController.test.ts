import sendOtpController from "@/controllers/auth-service/sendOtpController";
import { StatusCode } from "@/types/types";
import sendEmail from "@/auth-modules/mail/sendEmail";

// Mock dependencies
const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    users: { email: "users.email" }
}));

jest.mock("@/auth-modules/mail/sendEmail", () => jest.fn());

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("sendOtpController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { email: "newuser@example.com" };
    });

    it("should send OTP if email is not registered", async () => {
        mockDb.limit.mockResolvedValue([]); // User does not exist

        const result = await sendOtpController({ body: mockBody, set: mockSet } as any);

        expect(result).toEqual({ message: "OTP sent successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(sendEmail).toHaveBeenCalledWith({ to: "newuser@example.com" });
    });

    it("should fail if email is already registered", async () => {
        mockDb.limit.mockResolvedValue([{ id: 1 }]); // User exists

        const result = await sendOtpController({ body: mockBody, set: mockSet } as any);

        expect(result).toEqual({ message: "Email is already registered" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should fail if email is missing", async () => {
        const result = await sendOtpController({ body: {}, set: mockSet } as any);

        expect(result).toEqual({ message: "Email is required" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });
});
