import getMySQLTableList from "@/controllers/storage-service/MySQL/getMySQLTableList";
import { StatusCode } from "@/types/types";

// Mock dependencies
const mockListTables = jest.fn();
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
        listTables: mockListTables
    }));
});

jest.mock("@/controllers/storage-service/MySQL/deployMySQL", () => ({
    verifyMachine: jest.fn()
}));
import { verifyMachine } from "@/controllers/storage-service/MySQL/deployMySQL";

jest.mock("@/utils/decryptPassword", () => jest.fn().mockReturnValue("decrypted"));

describe("getMySQLTableList", () => {
    let mockSet: any;
    let mockBody: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSet = { status: 0 };
        mockBody = {
            databaseName: "mydb",
            vpsId: "1",
            vpsIp: "1.2.3.4",
            username: "user",
            password: "pass"
        };
    });

    // Need valid req.vpsId... 
    it("should return table list", async () => {
        (verifyMachine as jest.Mock).mockResolvedValue({
            status: true,
            machine: { vps_ip: "1.2.3.4", vps_password: "enc" }
        });
        mockListTables.mockResolvedValue(["table1", "table2"]);

        const result = await getMySQLTableList({ body: mockBody, userId: "1", set: mockSet } as any);

        expect(result).toMatchObject({ status: "success", data: ["table1", "table2"] });
        expect(mockSet.status).toBe(StatusCode.OK);
    });
});
