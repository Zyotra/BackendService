import runMySQLQuery from "@/controllers/storage-service/MySQL/runMySQLQuery";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockExecuteQuery = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock("@/SSHClient/SSHClient", () => {
    return jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        close: mockClose
    }));
});

jest.mock("@/HelperClasses/mySQLHelper", () => {
    return jest.fn().mockImplementation(() => ({
        executeQuery: mockExecuteQuery
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("runMySQLQuery", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            databaseName: "mydb",
            query: "SELECT * FROM table",
            vpsId: "1",
            vpsIp: "1.2.3.4",
            username: "user",
            password: "pass"
        };
    });

    it("should execute query", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockExecuteQuery.mockResolvedValue([{ id: 1 }]);

        const result = await runMySQLQuery({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ message: "success", rows: [{ id: 1 }] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
