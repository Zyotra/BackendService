import unauthenticateGithubController from "@/controllers/deployment-manager/Github/unauthenticateGithubController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockRunSequential = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        runSequential: mockRunSequential,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: {},
    githubAuths: {}
}));

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("unauthenticateGithubController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should unauthenticate successfully", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]);

        const result = await unauthenticateGithubController({ params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "VPS unauthenticated from GitHub successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockRunSequential).toHaveBeenCalled(); // clean up commands
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should fail if VPS not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await unauthenticateGithubController({ params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Unauthorized or VPS not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
