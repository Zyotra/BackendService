import deployLatestCommitFrontendController from "@/controllers/ui-service/deployLatestCommitController";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockRunSequential = jest.fn();
const mockConnect = jest.fn();
const mockExec = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        runSequential: mockRunSequential,
        exec: mockExec,
        close: mockClose
    }));
});

const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn()
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    deployments: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));

jest.mock("@/utils/getMachineDetail", () => jest.fn());
import getMachineDetail from "@/utils/getMachineDetail";

jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));
jest.mock("@/repoActions/saveLog", () => ({ saveLog: jest.fn() }));
jest.mock("@/repoActions/copyAssets", () => jest.fn().mockResolvedValue(true));
jest.mock("@/ws/socketManager", () => ({ emitLog: jest.fn() }));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("deployLatestCommitFrontendController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should deploy latest commit for frontend successfully", async () => {
        mockDb.limit.mockResolvedValueOnce([{
            deploymentId: "dep1",
            vpsIp: "1.2.3.4",
            repoUrl: "url",
            framework: "react",
            subFolder: ""
        }]);
        (getMachineDetail as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc" });
        mockExec.mockResolvedValue({ output: "Reload Success" });

        const result = await deployLatestCommitFrontendController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Frontend deployment initiated" });
        expect(mockRunSequential).toHaveBeenCalled();
        expect(mockExec).toHaveBeenCalledWith(expect.stringMatching(/nginx -s reload/));
    });

    it("should fail if deployment record not found", async () => {
        mockDb.limit.mockResolvedValueOnce([]); // Not found
        const result = await deployLatestCommitFrontendController({ params: { id: "dep1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Deployment record not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
