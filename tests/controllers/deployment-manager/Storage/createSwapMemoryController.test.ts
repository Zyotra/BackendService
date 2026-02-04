import createSwapMemoryController from "@/controllers/deployment-manager/Storage/createSwapMemoryController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockRunSequential = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        runSequential: mockRunSequential,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: {}
}));

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("createSwapMemoryController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { vpsId: 1, memory: 2 };
    });

    it("should create swap memory successfully", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]);

        await createSwapMemoryController({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(mockRunSequential).toHaveBeenCalled();
    });

    it("should fail if memory invalid", async () => {
        mockBody.memory = 10; // > 8
        const result = await createSwapMemoryController({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "You cannot create swap memory more than 8 GB or less than 1 GB" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should fail if VPS not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await createSwapMemoryController({ body: mockBody, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Invalid machine details or unauthorized machine selected." });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
