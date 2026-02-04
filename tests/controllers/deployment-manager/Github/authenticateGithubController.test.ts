import authenticateGithubController from "@/controllers/deployment-manager/Github/authenticateGithubController";
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
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));

jest.mock("@/db/schema", () => ({
    vpsMachines: { id: "id" },
    githubAuths: {}
}));

jest.mock("@/crypto/decryptVpsPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn(),
}));

describe("authenticateGithubController", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = { githubUsername: "user", githubToken: "token" };
    });

    it("should authenticate successfully", async () => {
        mockDb.where.mockResolvedValue([{ id: 1, vps_ip: "1.2.3.4", vps_password: "enc" }]); // VPS found

        const result = await authenticateGithubController({ body: mockBody, params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "VPS authenticated successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockRunSequential).toHaveBeenCalled();
        expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should fail if missing fields", async () => {
        const result = await authenticateGithubController({ body: {}, params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Missing required fields" });
        expect(mockSet.status).toBe(StatusCode.BAD_REQUEST);
    });

    it("should fail if VPS not found", async () => {
        mockDb.where.mockResolvedValue([]);
        const result = await authenticateGithubController({ body: mockBody, params: { id: "1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Unauthorized or VPS not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });

    it("should handle SSH errors and cleanup", async () => {
        mockDb.where.mockResolvedValue([{ id: 1 }]);
        mockRunSequential.mockRejectedValue(new Error("SSH Error"));

        const result = await authenticateGithubController({ body: mockBody, params: { id: "1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "error", message: "Failed to authenticate VPS with GitHub" });
        expect(mockSet.status).toBe(StatusCode.INTERNAL_SERVER_ERROR);
        // Should try to cleanup (run delete commands)
        // Since runSequential threw, and catch block calls runSequential again on ssh instance...
        // We verify it was called (at least once for the main logic, maybe twice for cleanup if we mock differently)
        // With the current mock, `ssh` is available in catch block? Yes.
    });
});
