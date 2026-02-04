import stopMySQLController from "@/controllers/deployment-manager/Storage/stopMySQLController";
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

describe("stopMySQLController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should stop mysql successfully", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]);

        await stopMySQLController({ params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(mockRunSequential).toHaveBeenCalledWith(expect.arrayContaining(["sudo systemctl stop mysql"]));
    });

    it("should fail if VPS not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await stopMySQLController({ params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ message: "Invalid machine details or unauthorized machine selected." });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
