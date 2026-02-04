import deleteProjectsController from "@/controllers/web-service/deleteProjectsController";
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
    limit: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn(),
    delete: jest.fn().mockReturnThis(),
};

jest.mock("@/db/client", () => ({
    db: mockDb
}));
jest.mock("@/db/schema", () => ({
    activityLogs: {},
    deployments: {}
}));
jest.mock("drizzle-orm", () => ({
    eq: jest.fn(),
    and: jest.fn()
}));

jest.mock("@/utils/getMachineDetail", () => jest.fn());
import getMachineDetail from "@/utils/getMachineDetail";

jest.mock("@/repoActions/getRepoName", () => jest.fn().mockReturnValue("repo"));
jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));
jest.mock("@/utils/unlinkDomain", () => jest.fn().mockResolvedValue(true));

describe("deleteProjectsController", () => {
    let mockSet: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
    });

    it("should delete web service project successfully (node/default)", async () => {
        mockDb.limit.mockResolvedValueOnce([{
            id: "proj1",
            vpsIp: "1.2.3.4",
            domain: "test.com",
            repoUrl: "url",
            projectType: "webservice",
            framework: "node",
            deploymentId: "dep1"
        }]);
        (getMachineDetail as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc" });

        const result = await deleteProjectsController({ params: { id: "proj1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Project deleted successfully" });
        expect(mockSet.status).toBe(StatusCode.OK);
        expect(mockRunSequential).toHaveBeenCalled();
        expect(mockDb.delete).toHaveBeenCalled();
    });

    it("should delete UI project successfully", async () => {
        mockDb.limit.mockResolvedValueOnce([{
            id: "proj1",
            vpsIp: "1.2.3.4",
            domain: "test.com",
            repoUrl: "url",
            projectType: "ui",
            deploymentId: "dep1"
        }]);
        (getMachineDetail as jest.Mock).mockResolvedValue({ vps_ip: "1.2.3.4", vps_password: "enc" });

        const result = await deleteProjectsController({ params: { id: "proj1" }, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", message: "Project deleted successfully" });
        expect(mockRunSequential).toHaveBeenCalled();
    });

    it("should fail if project not found", async () => {
        mockDb.limit.mockResolvedValueOnce([]); // Not found
        const result = await deleteProjectsController({ params: { id: "proj1" }, userId: "1", set: mockSet } as any);
        expect(result).toMatchObject({ status: "error", message: "Project not found" });
        expect(mockSet.status).toBe(StatusCode.NOT_FOUND);
    });
});
