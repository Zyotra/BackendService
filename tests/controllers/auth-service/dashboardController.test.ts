import dashboardController from "@/controllers/auth-service/dashboardController";
import { StatusCode } from "@/types/types";

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
    users: { id: "users.id", email: "users.email", name: "users.name" }
}));

jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
}));

describe("dashboardController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should return welcome message and user data if user exists", async () => {
        const userId = 1;
        const mockUser = { id: 1, email: "test@example.com", name: "Test User" };
        mockDb.where.mockResolvedValue([mockUser]);

        const result = await dashboardController({ set: mockSet, userId } as any);

        expect(result).toEqual({
            message: "Welcome to the dashboard",
            userEmail: mockUser.email,
            userName: mockUser.name
        });
        expect(mockSet.status).toBe(StatusCode.OK);
    });

    it("should return User not found if user does not exist", async () => {
        const userId = 999;
        mockDb.where.mockResolvedValue([]);

        const result = await dashboardController({ set: mockSet, userId } as any);

        expect(result).toEqual({ message: "User not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
